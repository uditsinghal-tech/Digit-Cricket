import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { motion, type Variants } from 'framer-motion'
import {
  sampleQuestions,
  shuffleOptionOrder,
  type QuizDifficultyChoice,
  type QuizQuestion,
} from '../quiz/questions'
import { submitContest, type ContestGrade } from '../api/client'

// One entry in the per-session-shuffled question list. We hold the original
// QuizQuestion plus a permutation of [0..3] that maps the displayed-option
// slot back to the original option index. So if `displayOrder = [2,0,3,1]`,
// the option shown in slot 0 is `question.options[2]`, etc. This way the
// QuizResult can recompute correctness without keeping the answer text.
export type QuizSessionEntry = {
  question: QuizQuestion
  displayOrder: [number, number, number, number]
  selectedDisplayIndex: number | null
}

// Final payload handed to the result screen. Carries everything the result
// needs: the questions in the order they were shown, the shuffled display
// order per question, and the user's selection per question.
export type QuizResult = {
  entries: QuizSessionEntry[]
  totalQuestions: number
  correctCount: number
  // Per-entry correctness, aligned to `entries`. Computed locally for
  // normal quizzes (from correctIndex); returned by the server for
  // contest quizzes (whose questions carry no answer key client-side).
  correctFlags: boolean[]
  // Wall-clock seconds from the quiz mounting to Finish (or the last
  // question timing out).
  durationSeconds: number
}

const QUESTIONS_PER_QUIZ = 10

// Per-question think-time. Mirrors the cricket match's ball timer: a
// circular countdown that starts green and flips to red once the player
// is in the final stretch. If the timer runs out before the player
// commits to an answer (or while it sits on the current selection), the
// quiz auto-advances to the next question, or finishes the quiz on the
// last one.
const QUESTION_TIMER_SECONDS = 15
const QUESTION_TIMER_WARNING = 5

type Props = {
  playerName: string
  // Which slice of the question bank to draw from. Picked one screen
  // earlier on the QuizDifficultyScreen. Ignored when `customQuestions`
  // is supplied.
  difficulty: QuizDifficultyChoice
  // Optional pre-loaded set of questions (used by the Customize Quiz
  // flow after Gemini generates a tailored set). When provided we use
  // these verbatim and skip the local-bank sample.
  customQuestions?: QuizQuestion[]
  // Set for a contest run. Its presence switches Finish to server-side
  // grading: the answers, coupon, email, and time are POSTed and the
  // score comes back from the backend instead of being computed locally.
  couponCode?: string
  // The signed-in email, sent with a contest submission. Unused for
  // Play For Fun / custom quizzes (which never touch the backend).
  email?: string
  onFinish: (result: QuizResult) => void
  // Called instead of onFinish when a contest run is graded by the server.
  onContestFinish?: (grade: ContestGrade) => void
  onBack: () => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// The active quiz screen. Mounts once per session — samples 10 fresh
// questions, shuffles each one's option order, and walks the user through
// them one at a time with Previous / Next. The Finish Quiz button only
// shows on the last card; before that the rightmost button is Next.
export default function QuizScreen({
  playerName,
  difficulty,
  customQuestions,
  couponCode,
  email,
  onFinish,
  onContestFinish,
  onBack,
}: Props) {
  // Initial-session computation. If a custom set was supplied (Customize
  // Quiz path) use it verbatim; otherwise sample 10 random questions
  // from the bundled bank matched to the chosen difficulty band.
  // Held in useState (initialised lazily) so the same questions persist
  // across re-renders within the session.
  const [entries, setEntries] = useState<QuizSessionEntry[]>(() => {
    const source =
      customQuestions && customQuestions.length > 0
        ? customQuestions
        : sampleQuestions(QUESTIONS_PER_QUIZ, difficulty)
    return source.map((q) => ({
      question: q,
      displayOrder: shuffleOptionOrder(),
      selectedDisplayIndex: null,
    }))
  })
  // Quiz start timestamp, captured once on mount. Used to report total
  // time spent when the quiz finishes.
  const startedAt = useRef(Date.now())
  const [currentIndex, setCurrentIndex] = useState(0)
  // Per-question countdown shown as a circular dial above the options.
  // Reset every time `currentIndex` changes (in the timer effect below).
  const [secondsLeft, setSecondsLeft] = useState<number>(QUESTION_TIMER_SECONDS)
  // Contest submit state: while a grade request is in flight the Finish
  // button shows a spinner label, and a failed submit surfaces an error
  // with the button re-enabled so the player can retry.
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const current = entries[currentIndex]
  const isLast = currentIndex === entries.length - 1
  const isFirst = currentIndex === 0
  const totalAnswered = entries.filter((e) => e.selectedDisplayIndex !== null).length
  const progressPct = ((currentIndex + 1) / entries.length) * 100

  // Records the user's selection for the current question. Compared to the
  // shuffled display order (not the original options), so the result page
  // can map back to whether the answer was correct.
  const handleSelect = (displayIndex: number) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === currentIndex ? { ...e, selectedDisplayIndex: displayIndex } : e)),
    )
  }

  // Walks back one question. Selections are preserved so the user can
  // change their answer if they want to.
  const handlePrevious = () => {
    if (!isFirst) setCurrentIndex((i) => i - 1)
  }

  // Walks forward one question. Disabled on the last card — the Finish
  // Quiz button takes over there.
  const handleNext = () => {
    if (!isLast) setCurrentIndex((i) => i + 1)
  }

  // The player's chosen ORIGINAL option index per question (null = skipped),
  // in the served order — this is what the contest grader needs.
  const selectedOriginalIndexes = (): (number | null)[] =>
    entries.map((e) => (e.selectedDisplayIndex === null ? null : e.displayOrder[e.selectedDisplayIndex]))

  // Finishes the quiz. Play For Fun / custom quizzes are graded locally
  // against each question's correctIndex — no backend call, exactly as
  // before the backend existed. Contest quizzes (couponCode set) carry no
  // answer key: the coupon, answers, email, and time are POSTed and the
  // server returns the summary score. Unanswered questions count as wrong.
  const handleFinish = useMemo(
    () => async () => {
      if (submitting) return
      const durationSeconds = Math.round((Date.now() - startedAt.current) / 1000)

      if (couponCode) {
        setSubmitting(true)
        setSubmitError(null)
        try {
          const grade = await submitContest({
            couponCode,
            answers: selectedOriginalIndexes(),
            email: email ?? '',
            timeSeconds: durationSeconds,
          })
          onContestFinish?.(grade)
        } catch (err) {
          setSubmitError(err instanceof Error ? err.message : 'Could not submit your answers. Try again.')
          setSubmitting(false)
        }
        return
      }

      const correctFlags = entries.map((e) => {
        if (e.selectedDisplayIndex === null) return false
        const originalIndex = e.displayOrder[e.selectedDisplayIndex]
        return originalIndex === e.question.correctIndex
      })
      onFinish({
        entries,
        totalQuestions: entries.length,
        correctCount: correctFlags.filter(Boolean).length,
        correctFlags,
        durationSeconds,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, onFinish, onContestFinish, couponCode, email, submitting],
  )

  // Ref-mirror of the "what to do when the timer fires" callback. The
  // setTimeout scheduled inside the timer effect runs 15 seconds later;
  // by then the render that scheduled it is stale (entries / currentIndex
  // may have moved on). Reading the latest behaviour out of a ref means
  // the auto-advance always reflects the current question, not the one
  // that was visible when the timer started.
  const advanceRef = useRef<() => void>(() => {})
  useEffect(() => {
    advanceRef.current = () => {
      if (isLast) handleFinish()
      else setCurrentIndex((i) => i + 1)
    }
  })

  // Per-question countdown. Resets to QUESTION_TIMER_SECONDS whenever the
  // visible question changes, ticks down once per second for display, and
  // (independently) schedules a one-shot timeout that fires the auto-
  // advance after the full window. The two are kept independent so a slow
  // render doesn't delay the actual deadline.
  useEffect(() => {
    setSecondsLeft(QUESTION_TIMER_SECONDS)
    const tick = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(s - 1, 0))
    }, 1000)
    const fire = window.setTimeout(() => {
      advanceRef.current()
    }, QUESTION_TIMER_SECONDS * 1000)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(fire)
    }
  }, [currentIndex])

  return (
    <motion.div
      key="quiz-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box sx={{ width: '100%', maxWidth: 600, px: 3, py: 4, textAlign: 'center' }}>
        <Stack spacing={3} alignItems="stretch">
          <Stack spacing={1} alignItems="center">
            <Typography variant="h5" component="h1" className="title">
              Cricket Quiz
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              Question {currentIndex + 1} of {entries.length} · {totalAnswered} answered ·{' '}
              {playerName}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progressPct}
              color="secondary"
              sx={{ height: 6, borderRadius: 3, width: '100%', mt: 1 }}
            />
          </Stack>

          <Box
            sx={{
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: 2,
              p: 2.5,
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(6px)',
              textAlign: 'left',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography
                variant="caption"
                sx={{ opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                {current.question.difficulty}
              </Typography>
              <QuizTimer secondsLeft={secondsLeft} />
            </Stack>
            <Typography variant="body1" sx={{ mt: 0.5, mb: 2, fontWeight: 600 }}>
              {current.question.question}
            </Typography>

            <RadioGroup
              value={current.selectedDisplayIndex === null ? '' : String(current.selectedDisplayIndex)}
              onChange={(e) => handleSelect(Number(e.target.value))}
            >
              {current.displayOrder.map((originalIdx, displayIdx) => (
                <FormControlLabel
                  key={displayIdx}
                  value={String(displayIdx)}
                  control={<Radio color="secondary" />}
                  label={current.question.options[originalIdx]}
                  sx={{
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: 1.5,
                    px: 1.5,
                    py: 0.25,
                    mb: 0.75,
                    ml: 0,
                    mr: 0,
                  }}
                />
              ))}
            </RadioGroup>
          </Box>

          <Stack direction="row" spacing={1} justifyContent="space-between">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handlePrevious}
              disabled={isFirst}
              variant="outlined"
            >
              Previous
            </Button>

            {isLast ? (
              <Button
                onClick={handleFinish}
                disabled={submitting}
                variant="contained"
                color="success"
                startIcon={<CheckCircleOutlineIcon />}
              >
                {submitting ? 'Submitting…' : 'Finish Quiz'}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                endIcon={<ArrowForwardIcon />}
                variant="contained"
                color="secondary"
              >
                Next
              </Button>
            )}
          </Stack>

          {submitError && (
            <Alert severity="error" sx={{ textAlign: 'left' }}>
              {submitError}
            </Alert>
          )}

          <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'text.secondary' }}>
            Back to mode selection
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}

// Circular per-question countdown. SVG ring drains from full to empty as
// the seconds tick down, the centre digit shows the remaining whole
// seconds, and both flip from green to red once the player crosses into
// the final QUESTION_TIMER_WARNING-second window. Mirrors the cricket
// match's BallTimer in feel, smaller and lighter for the quiz screen.
function QuizTimer({ secondsLeft }: { secondsLeft: number }) {
  const isCritical = secondsLeft <= QUESTION_TIMER_WARNING
  const color = isCritical ? '#ef4444' : '#22c55e'
  const size = 52
  const stroke = 4.5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(1, secondsLeft / QUESTION_TIMER_SECONDS))
  const offset = circumference * (1 - progress)
  return (
    <motion.div
      animate={isCritical ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={
        isCritical
          ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 }
      }
      style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}
      aria-label={`${secondsLeft} seconds left to answer`}
    >
      <svg width={size} height={size}>
        {/* Track ring sitting underneath the live arc. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(148, 163, 184, 0.22)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Live countdown arc. Rotated -90deg so the empty end starts at
            12 o'clock and drains clockwise. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: 'stroke-dashoffset 1s linear, stroke 0.2s ease',
            filter: `drop-shadow(0 0 6px ${color}66)`,
          }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontWeight: 800,
            fontSize: '1rem',
            color,
            lineHeight: 1,
            textShadow: `0 0 6px ${color}55`,
            transition: 'color 0.2s ease, text-shadow 0.2s ease',
          }}
        >
          {secondsLeft}
        </Typography>
      </Box>
    </motion.div>
  )
}
