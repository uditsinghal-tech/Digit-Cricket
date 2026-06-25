import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import LinearProgress from '@mui/material/LinearProgress'
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
}

const QUESTIONS_PER_QUIZ = 10

type Props = {
  playerName: string
  // Which slice of the question bank to draw from. Picked one screen
  // earlier on the QuizDifficultyScreen.
  difficulty: QuizDifficultyChoice
  onFinish: (result: QuizResult) => void
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
export default function QuizScreen({ playerName, difficulty, onFinish, onBack }: Props) {
  // Initial-session computation: pick 10 random questions matched to the
  // chosen difficulty band ('mixed' draws from the whole bank) and shuffle
  // each one's option slots. Held in useState (initialised lazily) so the
  // same 10 questions persist across re-renders within the session.
  const [entries, setEntries] = useState<QuizSessionEntry[]>(() =>
    sampleQuestions(QUESTIONS_PER_QUIZ, difficulty).map((q) => ({
      question: q,
      displayOrder: shuffleOptionOrder(),
      selectedDisplayIndex: null,
    })),
  )
  const [currentIndex, setCurrentIndex] = useState(0)

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

  // Tallies correct answers and hands the final payload to the parent.
  // Unanswered questions count as wrong (the user chose not to answer).
  const handleFinish = useMemo(
    () => () => {
      const correctCount = entries.reduce((sum, e) => {
        if (e.selectedDisplayIndex === null) return sum
        const originalIndex = e.displayOrder[e.selectedDisplayIndex]
        return originalIndex === e.question.correctIndex ? sum + 1 : sum
      }, 0)
      onFinish({ entries, totalQuestions: entries.length, correctCount })
    },
    [entries, onFinish],
  )

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
            <Typography
              variant="caption"
              sx={{ opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              {current.question.difficulty}
            </Typography>
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
                variant="contained"
                color="success"
                startIcon={<CheckCircleOutlineIcon />}
              >
                Finish Quiz
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

          <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'text.secondary' }}>
            Back to mode selection
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}
