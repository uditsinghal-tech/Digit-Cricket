import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { motion, type Variants } from 'framer-motion'
import type { BallsPerInnings } from '../game/types'

type Props = {
  playerName: string
  onSelect: (count: BallsPerInnings) => void
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
              Hi {playerName} — pick how many balls per innings.
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
            <LengthButton count={6} label="6 Ball Game" sub="1 over" onClick={onSelect} />
            <LengthButton count={12} label="12 Ball Game" sub="2 overs" onClick={onSelect} />
          </Stack>

          <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'text.secondary' }}>
            Back to mode selection
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}

// Tile button for a match-length choice. Big label on top, descriptor below.
// Colour-keyed (primary for 6, secondary for 12) so the two read as distinct picks.
function LengthButton({
  count,
  label,
  sub,
  onClick,
}: {
  count: BallsPerInnings
  label: string
  sub: string
  onClick: (count: BallsPerInnings) => void
}) {
  const isShort = count === 6
  return (
    <Button
      variant="contained"
      color={isShort ? 'primary' : 'secondary'}
      size="large"
      onClick={() => onClick(count)}
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
