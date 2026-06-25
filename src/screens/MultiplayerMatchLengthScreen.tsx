import { useEffect } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { motion, type Variants } from 'framer-motion'
import { useMultiplayer } from '../multiplayer/useMultiplayer'
import type { BallsPerInnings } from '../game/types'

type Props = {
  playerName: string
  onMatchLengthSet: (count: BallsPerInnings) => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// Multiplayer-aware match-length picker. Host sees the 6-ball / 12-ball
// tiles; joiner sees a waiting indicator. Once the host picks, a MATCH_LENGTH
// network message goes to the joiner so both sides adopt the same value
// before the next phase of the game.
export default function MultiplayerMatchLengthScreen({ playerName, onMatchLengthSet }: Props) {
  const { isHost, opponentName, subscribe, send } = useMultiplayer()

  // Joiner-only: subscribe to incoming MATCH_LENGTH and forward the value
  // up to App so the global ballsPerInnings state stays in sync.
  useEffect(() => {
    if (isHost) return
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'MATCH_LENGTH') {
        onMatchLengthSet(msg.balls)
      }
    })
    return unsubscribe
  }, [isHost, subscribe, onMatchLengthSet])

  // Host-only: fires when the host clicks 6 or 12. Broadcasts the choice and
  // immediately advances the host's own UI so both peers move together.
  const handlePick = (count: BallsPerInnings) => {
    send({ type: 'MATCH_LENGTH', balls: count })
    onMatchLengthSet(count)
  }

  return (
    <motion.div
      key="multiplayer-match-length-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box sx={{ width: '100%', maxWidth: 480, px: 3, py: 6, textAlign: 'center' }}>
        {isHost ? (
          <HostView playerName={playerName} opponentName={opponentName} onPick={handlePick} />
        ) : (
          <JoinerView playerName={playerName} opponentName={opponentName} />
        )}
      </Box>
    </motion.div>
  )
}

// Host's view: title + two tile buttons. A small chip reminds them their
// opponent is waiting for them to choose.
function HostView({
  playerName,
  opponentName,
  onPick,
}: {
  playerName: string
  opponentName: string | null
  onPick: (count: BallsPerInnings) => void
}) {
  return (
    <Stack spacing={4} alignItems="center">
      <Stack spacing={1} alignItems="center">
        <Typography variant="h4" component="h1" className="title">
          Match length
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.75 }}>
          You're hosting, {playerName} — pick how many balls per innings.
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          color="secondary"
          label={`${opponentName ?? 'Opponent'} is waiting`}
          sx={{ mt: 0.5 }}
        />
      </Stack>

      <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
        <LengthButton count={6} label="6 Ball Game" sub="1 over" onClick={onPick} />
        <LengthButton count={12} label="12 Ball Game" sub="2 overs" onClick={onPick} />
      </Stack>
    </Stack>
  )
}

// Joiner's view: a waiting spinner. There's nothing for them to do until
// the MATCH_LENGTH message arrives; useEffect above will navigate them
// forward as soon as it does.
function JoinerView({
  playerName,
  opponentName,
}: {
  playerName: string
  opponentName: string | null
}) {
  return (
    <Stack spacing={4} alignItems="center">
      <Stack spacing={1} alignItems="center">
        <Typography variant="h4" component="h1" className="title">
          Match length
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.75 }}>
          Hi {playerName} — your host is choosing.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <CircularProgress size={22} color="secondary" />
        <Typography variant="body1">
          Waiting for <strong>{opponentName ?? 'host'}</strong> to pick…
        </Typography>
      </Stack>
    </Stack>
  )
}

// Tile button for a match-length choice — mirrors the singleplayer
// MatchLengthScreen's LengthButton so the two flows feel like siblings.
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
