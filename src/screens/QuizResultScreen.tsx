import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import HomeIcon from '@mui/icons-material/Home'
import { motion, type Variants } from 'framer-motion'
import type { QuizResult } from './QuizScreen'

// Final summary screen for the cricket quiz. Lists every question the
// player answered (or skipped) with a green tick or red cross, alongside
// the option THEY chose (or "Skipped"). Deliberately does NOT reveal the
// correct answer — that's per the product requirement, so a wrong answer
// stays a learning prompt rather than a freebie.

type Props = {
  result: QuizResult
  onTryAgain: () => void
  onHome: () => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

export default function QuizResultScreen({ result, onTryAgain, onHome }: Props) {
  const { entries, totalQuestions, correctCount } = result
  const percentage = Math.round((correctCount / totalQuestions) * 100)
  const headline = headlineFor(percentage)

  return (
    <motion.div
      key="quiz-result-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box sx={{ width: '100%', maxWidth: 640, px: 3, py: 4 }}>
        <Stack spacing={3} alignItems="stretch">
          <Stack spacing={1} alignItems="center">
            <Typography variant="h4" component="h1" className="title">
              {headline}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              You scored {correctCount} / {totalQuestions}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              That's {percentage}% — review every question below.
            </Typography>
          </Stack>

          <Stack spacing={1.25}>
            {entries.map((entry, idx) => {
              const { question, displayOrder, selectedDisplayIndex } = entry
              const wasSelected = selectedDisplayIndex !== null
              const selectedOriginalIdx = wasSelected ? displayOrder[selectedDisplayIndex] : -1
              const isCorrect =
                wasSelected && selectedOriginalIdx === question.correctIndex
              const selectedText = wasSelected
                ? question.options[selectedOriginalIdx]
                : 'Skipped (no answer)'

              return (
                <Box
                  key={question.id}
                  sx={{
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: 2,
                    p: 1.5,
                    background: 'rgba(15, 23, 42, 0.55)',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    {isCorrect ? (
                      <CheckCircleIcon sx={{ color: '#22c55e', mt: 0.25 }} />
                    ) : (
                      <CancelIcon sx={{ color: '#ef4444', mt: 0.25 }} />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          opacity: 0.65,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        Q{idx + 1} · {question.difficulty}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {question.question}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          opacity: 0.85,
                          color: isCorrect ? '#86efac' : wasSelected ? '#fca5a5' : 'inherit',
                        }}
                      >
                        Your answer: {selectedText}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              )
            })}
          </Stack>

          <Stack direction="row" spacing={1.5} justifyContent="center">
            <Button
              variant="contained"
              color="secondary"
              startIcon={<RestartAltIcon />}
              onClick={onTryAgain}
            >
              Try Again
            </Button>
            <Button variant="outlined" startIcon={<HomeIcon />} onClick={onHome}>
              Home
            </Button>
          </Stack>
        </Stack>
      </Box>
    </motion.div>
  )
}

// Picks a short headline based on the score percentage. Intentionally
// light so the screen reads encouraging at any score band.
function headlineFor(pct: number): string {
  if (pct === 100) return 'Perfect score!'
  if (pct >= 80) return 'Cricket buff!'
  if (pct >= 60) return 'Solid effort'
  if (pct >= 40) return 'Not bad — keep at it'
  if (pct >= 20) return 'There\'s always next round'
  return 'Tough round!'
}
