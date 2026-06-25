import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import { motion, type Variants } from 'framer-motion'
import AnimatedFace, { type Mood } from '../components/AnimatedFace'
import { useSounds } from '../audio/useSounds'
import { useStadiumReaction } from '../stadium/useStadiumReaction'
import { useMultiplayer } from '../multiplayer/useMultiplayer'
import type { BallEvent, MatchResult } from '../game/types'

type Props = {
  result: MatchResult
  onPlayAgain: () => void
  onChangeName: () => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

const CONFETTI_COLORS = ['#38bdf8', '#a855f7', '#fbbf24', '#22c55e', '#f87171', '#fb923c']

// Final screen. Reveals the result with a staged animation, summarises both
// innings ball-by-ball, and offers Play Again (keep name) or Change Name (full reset).
// In multiplayer, Play Again is a handshake — both peers must click before
// the rematch actually starts.
export default function MatchResultScreen({ result, onPlayAgain, onChangeName }: Props) {
  const { playerName, playerScore, computerScore, winner, firstBatter, events, totalInnings } =
    result
  const { play } = useSounds()
  const { triggerReaction } = useStadiumReaction()
  const { status: multiplayerStatus, opponentName, send: sendNetwork, subscribe } = useMultiplayer()

  const isMultiplayer = multiplayerStatus === 'connected'

  const playerWon = winner === 'player'
  const isTie = winner === 'tie'
  const margin = Math.abs(playerScore - computerScore)

  // Multiplayer rematch handshake state. Both flags must be true before we
  // advance the screen. Local goes true on click; opponent goes true on the
  // incoming REMATCH_REQUEST message.
  const [localRequested, setLocalRequested] = useState(false)
  const [opponentRequested, setOpponentRequested] = useState(false)

  // Subscribes to the opponent's REMATCH_REQUEST while we're connected.
  // Unsubscribes on unmount / disconnect.
  useEffect(() => {
    if (!isMultiplayer) return
    return subscribe((msg) => {
      if (msg.type === 'REMATCH_REQUEST') {
        setOpponentRequested(true)
      }
    })
  }, [isMultiplayer, subscribe])

  // Once both sides have requested a rematch, fire the parent callback to
  // navigate back to the multiplayer coin toss.
  useEffect(() => {
    if (!isMultiplayer) return
    if (localRequested && opponentRequested) {
      onPlayAgain()
    }
  }, [isMultiplayer, localRequested, opponentRequested, onPlayAgain])

  // Play the celebration sound + fire the stadium visual reaction shortly
  // after mount so both land alongside the trophy spring-in. Tie matches stay
  // quiet — neither side gets to gloat.
  useEffect(() => {
    if (isTie) return
    const timer = setTimeout(() => {
      const kind = playerWon ? 'win' : 'lose'
      play(kind)
      triggerReaction(kind)
    }, 350)
    return () => clearTimeout(timer)
  }, [isTie, playerWon, play, triggerReaction])

  // Play Again click handler. In singleplayer the parent's callback fires
  // immediately. In multiplayer we send REMATCH_REQUEST and wait for the
  // opponent's request before advancing.
  const handlePlayAgainClick = () => {
    if (!isMultiplayer) {
      onPlayAgain()
      return
    }
    sendNetwork({ type: 'REMATCH_REQUEST' })
    setLocalRequested(true)
  }

  const headline = isTie ? "It's a tie!" : playerWon ? `${playerName} wins!` : 'Computer wins!'
  const subline = isTie
    ? `Both finished on ${playerScore}`
    : `by ${margin} run${margin === 1 ? '' : 's'}`

  const playerMood: Mood = isTie ? 'neutral' : playerWon ? 'happy' : 'sad'
  const computerMood: Mood = isTie ? 'neutral' : playerWon ? 'sad' : 'happy'

  // For a 4-innings test match the first batter plays innings 1 + 3 and
  // the second batter plays innings 2 + 4. Fold those pairs into one
  // events list per side so the existing two-column summary keeps working
  // regardless of format.
  const firstBatterInnings: (1 | 2 | 3 | 4)[] = totalInnings === 4 ? [1, 3] : [1]
  const secondBatterInnings: (1 | 2 | 3 | 4)[] = totalInnings === 4 ? [2, 4] : [2]
  const inningsOneEvents = events.filter((e) => firstBatterInnings.includes(e.innings))
  const inningsTwoEvents = events.filter((e) => secondBatterInnings.includes(e.innings))
  const firstBatterLabel = firstBatter === 'player' ? playerName : 'Computer'
  const secondBatterLabel = firstBatter === 'player' ? 'Computer' : playerName
  const firstInningsTotal = firstBatter === 'player' ? playerScore : computerScore
  const secondInningsTotal = firstBatter === 'player' ? computerScore : playerScore

  return (
    <motion.div
      key="match-result-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      {playerWon && <Confetti />}

      <Box
        sx={{
          width: '100%',
          maxWidth: 520,
          px: 2,
          py: 2,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Stack spacing={2} alignItems="stretch">
          <Stack alignItems="center" spacing={1}>
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 180, damping: 12 }}
            >
              <EmojiEventsIcon sx={{ fontSize: 72, color: 'warning.main' }} />
            </motion.div>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 220 }}
            >
              <Typography
                variant="h3"
                component="h1"
                className="title"
                sx={{ textAlign: 'center' }}
              >
                {headline}
              </Typography>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              <Typography variant="body1" sx={{ opacity: 0.85 }}>
                {subline}
              </Typography>
            </motion.div>
          </Stack>

          <Box
            sx={{
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: 2,
              p: 1.5,
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <Stack direction="row" justifyContent="space-around" alignItems="center">
              <PlayerResult
                name={playerName}
                score={playerScore}
                mood={playerMood}
                accent="primary"
                isWinner={playerWon && !isTie}
              />
              <Typography variant="h6" sx={{ opacity: 0.45 }}>
                vs
              </Typography>
              <PlayerResult
                name="Computer"
                score={computerScore}
                mood={computerMood}
                accent="secondary"
                isWinner={!playerWon && !isTie}
              />
            </Stack>
          </Box>

          <Stack spacing={1}>
            <InningsRow
              label={
                totalInnings === 4
                  ? `Innings 1+3 — ${firstBatterLabel}`
                  : `Innings 1 — ${firstBatterLabel}`
              }
              events={inningsOneEvents}
              total={firstInningsTotal}
              animationOffset={0.8}
            />
            <InningsRow
              label={
                totalInnings === 4
                  ? `Innings 2+4 — ${secondBatterLabel}`
                  : `Innings 2 — ${secondBatterLabel}`
              }
              events={inningsTwoEvents}
              total={secondInningsTotal}
              animationOffset={1.0}
            />
          </Stack>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Stack spacing={1}>
              <Button
                variant="contained"
                size="large"
                onClick={handlePlayAgainClick}
                disabled={isMultiplayer && localRequested}
                sx={{ py: 1.25, fontSize: '1rem' }}
              >
                {isMultiplayer && localRequested ? 'Waiting for opponent…' : 'Play again'}
              </Button>
              {isMultiplayer && localRequested && (
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                  <CircularProgress size={14} color="secondary" />
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    Waiting for {opponentName ?? 'opponent'} to confirm…
                  </Typography>
                </Stack>
              )}
              <Button variant="text" color="secondary" onClick={onChangeName}>
                {isMultiplayer ? 'Leave match' : 'Change name'}
              </Button>
            </Stack>
          </motion.div>
        </Stack>
      </Box>
    </motion.div>
  )
}

// One side of the final scoreboard card: optional trophy badge, name,
// mood-aware face (smile/frown/neutral), and the final score.
function PlayerResult({
  name,
  score,
  mood,
  accent,
  isWinner,
}: {
  name: string
  score: number
  mood: Mood
  accent: 'primary' | 'secondary'
  isWinner: boolean
}) {
  const variant = accent === 'primary' ? 'player' : 'computer'
  return (
    <Stack alignItems="center" spacing={0.5} sx={{ minWidth: 120 }}>
      <Box sx={{ height: 26, display: 'flex', alignItems: 'center' }}>
        {isWinner && (
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, type: 'spring' }}
          >
            <EmojiEventsIcon sx={{ fontSize: 22, color: 'warning.main' }} />
          </motion.div>
        )}
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.7, letterSpacing: '0.08em' }}>
        {name.toUpperCase()}
      </Typography>
      <AnimatedFace variant={variant} mood={mood} size={72} />
      <Typography variant="h3" sx={{ fontWeight: 800, color: `${accent}.light` }}>
        {score}
      </Typography>
    </Stack>
  )
}

// One innings strip: who batted, total runs, and a row of per-ball pill chips.
function InningsRow({
  label,
  events,
  total,
  animationOffset,
}: {
  label: string
  events: BallEvent[]
  total: number
  animationOffset: number
}) {
  if (events.length === 0) return null
  return (
    <Box
      sx={{
        border: '1px solid rgba(148, 163, 184, 0.18)',
        borderRadius: 2,
        px: 1.25,
        py: 1,
        background: 'rgba(15, 23, 42, 0.4)',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.7, letterSpacing: '0.08em' }}>
          {label.toUpperCase()}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {total}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {events.map((event, index) => (
          <BallPill key={index} event={event} delay={animationOffset + index * 0.05} />
        ))}
      </Stack>
    </Box>
  )
}

// One ball outcome chip: green with the runs scored, or red "W" for a wicket.
function BallPill({ event, delay }: { event: BallEvent; delay: number }) {
  return (
    <motion.div
      initial={{ scale: 0, y: -8 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260 }}
    >
      <Chip
        label={event.isOut ? 'W' : event.runs}
        size="small"
        color={event.isOut ? 'error' : 'success'}
        sx={{ fontWeight: 700, minWidth: 34 }}
      />
    </motion.div>
  )
}

// Falling-particles overlay, mounted only when the player wins.
function Confetti() {
  const items = Array.from({ length: 28 }).map((_, i) => ({
    left: (i * 37) % 100,
    delay: (i * 0.08) % 1.6,
    duration: 3 + (i % 5) * 0.4,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + (i % 3) * 2,
    rotation: 360 + i * 23,
    shape: i % 2 === 0 ? ('50%' as const) : ('2px' as const),
  }))

  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ y: '-10vh', opacity: 0, rotate: 0 }}
          animate={{
            y: ['-10vh', '110vh'],
            opacity: [0, 1, 1, 0.5, 0],
            rotate: item.rotation,
          }}
          transition={{
            duration: item.duration,
            delay: item.delay,
            repeat: Infinity,
            ease: 'easeIn',
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: `${item.left}%`,
            width: item.size,
            height: item.size,
            background: item.color,
            borderRadius: item.shape,
            boxShadow: `0 0 6px ${item.color}88`,
          }}
        />
      ))}
    </Box>
  )
}
