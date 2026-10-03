import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CelebrationIcon from '@mui/icons-material/Celebration'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import { motion, type Variants } from 'framer-motion'
import { validateCoupon } from '../api/client'
import type { QuizQuestion } from '../quiz/questions'

type Props = {
  playerName: string
  // Guests have no account, so the contest asks them to sign in instead
  // of showing the coupon box. (The backend also refuses them: no session.)
  isGuest: boolean
  onSignIn: () => void
  // Play For Fun — keeps the existing sampled-quiz flow (difficulty picker).
  onPlayForFun: () => void
  // Contest coupon validated — hands back the fetched question set and the
  // code that unlocked it (needed again to submit answers for grading).
  onContestStart: (questions: QuizQuestion[], couponCode: string) => void
  onBack: () => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// Shown after the player picks "Cricket Quiz". Offers a casual quiz or a
// coupon-gated contest. The contest path validates the code against the
// backend and, on success, launches a quiz from the returned questions.
export default function QuizModeScreen({
  playerName,
  isGuest,
  onSignIn,
  onPlayForFun,
  onContestStart,
  onBack,
}: Props) {
  const [showCoupon, setShowCoupon] = useState(false)
  const [coupon, setCoupon] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleParticipate = async () => {
    const code = coupon.trim()
    if (!code || busy) return
    setBusy(true)
    setError(null)
    try {
      const questions = await validateCoupon(code)
      onContestStart(questions, code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not validate coupon. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      key="quiz-mode-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box sx={{ width: '100%', maxWidth: 480, px: 3, py: 6, textAlign: 'center' }}>
        <Stack spacing={4} alignItems="center">
          <Stack spacing={1} alignItems="center">
            <Typography variant="h4" component="h1" className="title">
              Cricket Quiz
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.75 }}>
              {playerName}, just for fun or playing to win?
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
            <ChoiceButton
              label="Play For Fun"
              sub="Casual quiz, no stakes"
              color="secondary"
              icon={<CelebrationIcon sx={{ fontSize: 36 }} />}
              onClick={onPlayForFun}
            />
            <ChoiceButton
              label="Participate in Contest"
              sub={isGuest ? 'Sign in required' : 'Enter a coupon to play'}
              color="primary"
              icon={<EmojiEventsIcon sx={{ fontSize: 36 }} />}
              onClick={() => {
                setShowCoupon(true)
                setError(null)
              }}
            />
          </Stack>

          {showCoupon && isGuest && (
            <Stack spacing={2} sx={{ width: '100%' }}>
              <Alert severity="info" sx={{ textAlign: 'left' }}>
                Please sign in and try. Contests need an account so your score counts on the
                leaderboard. Play For Fun works as a guest.
              </Alert>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={onSignIn}
                sx={{ py: 1.25 }}
              >
                Sign Up / Sign In
              </Button>
            </Stack>
          )}

          {showCoupon && !isGuest && (
            <Stack spacing={2} sx={{ width: '100%' }}>
              <TextField
                autoFocus
                fullWidth
                label="Coupon code"
                placeholder="Enter the code we sent you"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleParticipate()
                }}
                disabled={busy}
              />
              {error ? (
                <Alert severity="error" sx={{ textAlign: 'left' }}>
                  {error}
                </Alert>
              ) : (
                // The server counts the attempt the moment the quiz starts.
                <Alert severity="warning" sx={{ textAlign: 'left' }}>
                  One attempt only: 20 questions, 15 seconds each, no going back. Once you start,
                  closing or refreshing the page ends your attempt.
                  <br />
                  <br />
                  {/* Mirrors ContestScoring.java on the backend. */}
                  <b>Scoring (out of 100):</b> each question is worth 5 points. A wrong or skipped
                  answer scores 0. A correct answer scores 2.5 to 5: the faster you answer, the more
                  you get. So answer correctly first, then quickly.
                </Alert>
              )}
              <Button
                variant="contained"
                size="large"
                fullWidth
                disabled={coupon.trim().length === 0 || busy}
                onClick={handleParticipate}
                sx={{ py: 1.25 }}
              >
                {busy ? 'Starting…' : 'Start Contest'}
              </Button>
            </Stack>
          )}

          <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'text.secondary' }}>
            Back
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}

// Tile button matching the StartChoiceScreen tiles.
function ChoiceButton({
  label,
  sub,
  color,
  icon,
  onClick,
}: {
  label: string
  sub: string
  color: 'primary' | 'secondary'
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <Button
      variant="contained"
      color={color}
      size="large"
      onClick={onClick}
      sx={{ flex: 1, py: 2.5, flexDirection: 'column', gap: 0.75 }}
    >
      {icon}
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.75rem', opacity: 0.8 }}>{sub}</Typography>
    </Button>
  )
}
