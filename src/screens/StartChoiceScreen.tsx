import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SportsCricketIcon from '@mui/icons-material/SportsCricket'
import QuizIcon from '@mui/icons-material/Quiz'
import { motion, type Variants } from 'framer-motion'

// Two top-level activity buttons shown right after the player enters their
// name: Play Cricket (the existing match flow) or Quiz (the new mode). Sits
// between PlayerNameScreen and ModeSelectionScreen for the cricket path, or
// straight to QuizScreen for the quiz path.

export type StartChoice = 'play' | 'quiz'

type Props = {
  playerName: string
  onSelect: (choice: StartChoice) => void
  onBack: () => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

export default function StartChoiceScreen({ playerName, onSelect, onBack }: Props) {
  return (
    <motion.div
      key="start-choice-screen"
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
              What's the plan?
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.75 }}>
              Hi {playerName}, fancy a match or a quick quiz?
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
            <ChoiceButton
              label="Play Cricket"
              sub="Pick a match"
              color="primary"
              icon={<SportsCricketIcon sx={{ fontSize: 36 }} />}
              onClick={() => onSelect('play')}
            />
            <ChoiceButton
              label="Cricket Quiz"
              sub="Cricket Expert? Let's find out"
              color="secondary"
              icon={<QuizIcon sx={{ fontSize: 36 }} />}
              onClick={() => onSelect('quiz')}
            />
          </Stack>

          <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'text.secondary' }}>
            Back to home page
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}

// Tile button shared between the two top-level activities. Icon stacked above
// label + sub-label, colour-keyed so the two read as distinct paths.
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
