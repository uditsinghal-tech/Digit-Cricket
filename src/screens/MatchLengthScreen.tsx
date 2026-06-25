import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { motion, type Variants } from 'framer-motion'
import type { BallsPerInnings, TotalInnings } from '../game/types'

// A picked match shape: how many balls each innings and how many innings
// total. 2 innings = standard match; 4 innings = test match.
export type MatchLengthChoice = {
  ballsPerInnings: BallsPerInnings
  totalInnings: TotalInnings
}

type Props = {
  playerName: string
  onSelect: (choice: MatchLengthChoice) => void
  onBack: () => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// Sits between PlayerNameScreen and CoinTossScreen. Lets the player pick a
// quick 6-ball match or a longer 12-ball one before the toss begins.
export default function MatchLengthScreen({ playerName, onSelect, onBack }: Props) {
  return (
    <motion.div
      key="match-length-screen"
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
              Match length
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.75 }}>
              Hi {playerName}, pick how many balls per innings.
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
            <LengthButton
              label="6 Ball Game"
              sub="1 over, 2 innings"
              color="primary"
              onClick={() => onSelect({ ballsPerInnings: 6, totalInnings: 2 })}
            />
            <LengthButton
              label="12 Ball Game"
              sub="2 overs, 2 innings"
              color="secondary"
              onClick={() => onSelect({ ballsPerInnings: 12, totalInnings: 2 })}
            />
            <LengthButton
              label="Test Match"
              sub="6 balls, 4 innings"
              color="warning"
              onClick={() => onSelect({ ballsPerInnings: 6, totalInnings: 4 })}
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

// Tile button for one of the three match-format choices. Caller decides
// the colour (primary / secondary / warning) and the onClick payload — the
// button itself just renders the label + sub-label.
function LengthButton({
  label,
  sub,
  color,
  onClick,
}: {
  label: string
  sub: string
  color: 'primary' | 'secondary' | 'warning'
  onClick: () => void
}) {
  return (
    <Button
      variant="contained"
      color={color}
      size="large"
      onClick={onClick}
      sx={{
        flex: 1,
        py: 2.5,
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.78rem', opacity: 0.8 }}>{sub}</Typography>
    </Button>
  )
}
