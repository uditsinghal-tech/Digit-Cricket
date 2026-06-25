import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { motion, type Variants } from 'framer-motion'
import type { QuizDifficultyChoice } from '../quiz/questions'

// Sits between the StartChoiceScreen (Play / Quiz pick) and the actual
// QuizScreen. Lets the user dial the difficulty of their 10-question
// session: Easy / Medium / Difficult (= hard band only) / Challenging
// (= mixed bag drawn from every band, including the niche "extreme"
// questions that aren't selectable as a single-band pick).

type Props = {
  playerName: string
  onSelect: (difficulty: QuizDifficultyChoice) => void
  onBack: () => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

export default function QuizDifficultyScreen({ playerName, onSelect, onBack }: Props) {
  return (
    <motion.div
      key="quiz-difficulty-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box sx={{ width: '100%', maxWidth: 520, px: 3, py: 6, textAlign: 'center' }}>
        <Stack spacing={4} alignItems="center">
          <Stack spacing={1} alignItems="center">
            <Typography variant="h4" component="h1" className="title">
              Pick a difficulty
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.75 }}>
              Hi {playerName}, please select a difficulty level
            </Typography>
          </Stack>

          <Stack spacing={1.5} sx={{ width: '100%' }}>
            <DifficultyButton
              label="Easy"
              sub="Beginner-friendly rules & famous players"
              color="success"
              onClick={() => onSelect('easy')}
            />
            <DifficultyButton
              label="Medium"
              sub="World Cup history, IPL, modern records"
              color="primary"
              onClick={() => onSelect('medium')}
            />
            <DifficultyButton
              label="Hard"
              sub="Deeper stats, specific matches, venues"
              color="warning"
              onClick={() => onSelect('hard')}
            />
            <DifficultyButton
              label="Challenging"
              sub="Mixed bag including niche / pre-2000 trivia"
              color="error"
              onClick={() => onSelect('mixed')}
            />
          </Stack>

          <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'text.secondary' }}>
            Back to mode selection
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}

// Wide tile button used for each of the four difficulty bands. Label on top,
// short hint underneath, MUI palette colour keyed by band so they read as a
// gentle gradient from "go easy" to "good luck".
function DifficultyButton({
  label,
  sub,
  color,
  onClick,
}: {
  label: string
  sub: string
  color: 'success' | 'primary' | 'warning' | 'error'
  onClick: () => void
}) {
  return (
    <Button
      variant="contained"
      color={color}
      size="large"
      onClick={onClick}
      sx={{
        py: 1.75,
        flexDirection: 'column',
        gap: 0.25,
        textTransform: 'none',
      }}
    >
      <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.78rem', opacity: 0.85 }}>{sub}</Typography>
    </Button>
  )
}
