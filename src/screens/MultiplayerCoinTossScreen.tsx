import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useMultiplayer } from '../multiplayer/useMultiplayer'
import type { Side, TossOutcome, TossWinner } from '../game/types'

type Props = {
  playerName: string
  onComplete: (outcome: TossOutcome) => void
}

// Three visible phases. 'awaiting' is "before the coin has anything to spin
// to": for the joiner it's the call-heads-or-tails view; for the host it's
// the "waiting for opponent" spinner. 'rolling' starts once both sides have
// the result. 'revealed' is when the animation has finished.
type Phase = 'awaiting' | 'rolling' | 'revealed'

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

const FLIP_ROTATIONS = 4
const FLIP_DURATION = 2.2

// Rolls a fair 50/50 heads-or-tails. Only the host calls this — the joiner
// receives the value over the wire so both sides land on the same face.
function rollCoinSide(): Side {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

// Multiplayer coin toss. Joiner calls (sends TOSS_CALL); host generates the
// random result (sends TOSS_RESULT); both peers animate the 3D coin to the
// same landing face and compute the same winner locally.
export default function MultiplayerCoinTossScreen({ playerName, onComplete }: Props) {
  const { isHost, opponentName, subscribe, send } = useMultiplayer()
  const [phase, setPhase] = useState<Phase>('awaiting')
  // `userChoice` is always the caller's call (the joiner). On the joiner it's
  // set on click; on the host it's set when TOSS_CALL arrives.
  const [userChoice, setUserChoice] = useState<Side | null>(null)
  const [result, setResult] = useState<Side | null>(null)

  // Subscribe to incoming network messages. Host listens for TOSS_CALL and
  // immediately rolls + broadcasts the result; joiner listens for TOSS_RESULT
  // and adopts it.
  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'TOSS_CALL' && isHost) {
        const rolled = rollCoinSide()
        setUserChoice(msg.side)
        setResult(rolled)
        setPhase('rolling')
        send({ type: 'TOSS_RESULT', result: rolled })
      }
      if (msg.type === 'TOSS_RESULT' && !isHost) {
        setResult(msg.result)
        setPhase('rolling')
      }
    })
    return unsubscribe
  }, [subscribe, send, isHost])

  // Joiner-only: clicking Heads or Tails fires the call message and stores
  // the choice locally. The screen stays in 'awaiting' until TOSS_RESULT
  // arrives a few hundred milliseconds later.
  const handleJoinerCall = (side: Side) => {
    setUserChoice(side)
    send({ type: 'TOSS_CALL', side })
  }

  // Continue button: derives the winner from each side's local perspective
  // and bubbles up the TossOutcome to App so the result can be persisted in
  // global state.
  const handleContinue = () => {
    if (!userChoice || !result) return
    // The joiner called. From the joiner's perspective: 'player' won if their
    // call matched. From the host's perspective: 'player' won if the joiner's
    // call did NOT match.
    const joinerWonToss = userChoice === result
    const winner: TossWinner = isHost
      ? joinerWonToss
        ? 'computer'
        : 'player'
      : joinerWonToss
        ? 'player'
        : 'computer'
    onComplete({ userChoice, result, winner })
  }

  // Final rotation in degrees: four full spins plus a half-turn iff the coin
  // landed tails. With both faces sharing the same parent <motion.div>, this
  // value makes the coin physically settle on the correct side at the end.
  const targetRotation = result === null ? 0 : 360 * FLIP_ROTATIONS + (result === 'tails' ? 180 : 0)

  // Local viewer of who won — used for the "you won" / "you lost" label
  // shown after reveal.
  const localWon =
    userChoice && result ? (isHost ? userChoice !== result : userChoice === result) : false

  return (
    <motion.div
      key="multiplayer-coin-toss-screen"
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
              Coin toss
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.75 }}>
              {subtitleFor({
                phase,
                isHost,
                userChoice,
                playerName,
                opponentName,
              })}
            </Typography>
          </Stack>

          <Box
            sx={{
              perspective: '1200px',
              display: 'flex',
              justifyContent: 'center',
              height: 200,
              alignItems: 'center',
            }}
          >
            <motion.div
              style={{
                width: 160,
                height: 160,
                position: 'relative',
                transformStyle: 'preserve-3d',
              }}
              animate={{ rotateY: targetRotation }}
              transition={
                phase === 'rolling' ? { duration: FLIP_DURATION, ease: 'easeOut' } : { duration: 0 }
              }
              onAnimationComplete={() => {
                if (phase === 'rolling') setPhase('revealed')
              }}
            >
              <CoinFace label="H" front />
              <CoinFace label="T" />
            </motion.div>
          </Box>

          <AnimatePresence mode="wait">
            {phase === 'awaiting' && !isHost && !userChoice && (
              <motion.div
                key="joiner-picker"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                style={{ width: '100%' }}
              >
                <Stack direction="row" spacing={2} justifyContent="center">
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => handleJoinerCall('heads')}
                    sx={{ flex: 1, py: 1.5, fontSize: '1rem' }}
                  >
                    Heads
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    size="large"
                    onClick={() => handleJoinerCall('tails')}
                    sx={{ flex: 1, py: 1.5, fontSize: '1rem' }}
                  >
                    Tails
                  </Button>
                </Stack>
              </motion.div>
            )}

            {phase === 'awaiting' && !isHost && userChoice && (
              <motion.div
                key="joiner-sent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CircularProgress size={20} />
                  <Typography variant="body1">
                    Called <strong>{userChoice}</strong> — waiting for the toss…
                  </Typography>
                </Stack>
              </motion.div>
            )}

            {phase === 'awaiting' && isHost && (
              <motion.div
                key="host-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CircularProgress size={20} color="secondary" />
                  <Typography variant="body1">
                    Waiting for <strong>{opponentName ?? 'opponent'}</strong> to call…
                  </Typography>
                </Stack>
              </motion.div>
            )}

            {phase === 'rolling' && (
              <motion.div
                key="rolling"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Typography variant="body1" sx={{ opacity: 0.8 }}>
                  Flipping…
                </Typography>
              </motion.div>
            )}

            {phase === 'revealed' && userChoice && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                style={{ width: '100%' }}
              >
                <Stack spacing={2} alignItems="center">
                  <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                    It&apos;s {result}!
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: localWon ? 'primary.light' : 'secondary.light',
                      fontWeight: 600,
                    }}
                  >
                    {localWon
                      ? `You won the toss, ${playerName}!`
                      : `${opponentName ?? 'Opponent'} won the toss.`}
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleContinue}
                    sx={{ py: 1.25, fontSize: '1rem', width: '100%' }}
                  >
                    Continue
                  </Button>
                </Stack>
              </motion.div>
            )}
          </AnimatePresence>
        </Stack>
      </Box>
    </motion.div>
  )
}

// Picks the right subtitle for the current state. Pulled out into its own
// function because the conditions are noisy and the inline JSX would suffer.
function subtitleFor({
  phase,
  isHost,
  userChoice,
  playerName,
  opponentName,
}: {
  phase: Phase
  isHost: boolean
  userChoice: Side | null
  playerName: string
  opponentName: string | null
}): string {
  if (phase !== 'awaiting') {
    return 'Watching the coin…'
  }
  if (isHost) {
    return `${opponentName ?? 'Your opponent'} is calling the toss.`
  }
  if (!userChoice) {
    return `Call heads or tails, ${playerName}.`
  }
  return 'Hang tight, the host is rolling the coin.'
}

// One side of the 3D coin. The back face is pre-rotated 180° on Y so
// backface-visibility hides whichever side isn't currently facing camera.
// Visually identical to the singleplayer CoinTossScreen's CoinFace —
// duplicated here to keep the multiplayer screen self-contained.
function CoinFace({ label, front = false }: { label: string; front?: boolean }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        backfaceVisibility: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: front
          ? 'radial-gradient(circle at 30% 30%, #fde68a, #f59e0b 60%, #b45309)'
          : 'radial-gradient(circle at 30% 30%, #e2e8f0, #94a3b8 60%, #475569)',
        boxShadow: '0 14px 28px rgba(0,0,0,0.45), inset 0 0 0 6px rgba(255,255,255,0.18)',
        transform: front ? undefined : 'rotateY(180deg)',
      }}
    >
      <Typography
        sx={{
          fontSize: 72,
          fontWeight: 800,
          color: front ? '#78350f' : '#1e293b',
          textShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}
