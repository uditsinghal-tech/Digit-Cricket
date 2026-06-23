import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import type { Side, TossOutcome, TossWinner } from '../game/types'

type Phase = 'choosing' | 'flipping' | 'revealed'

type Props = {
  playerName: string
  onComplete: (outcome: TossOutcome) => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

const FLIP_ROTATIONS = 4
const FLIP_DURATION = 2.2

// Coin lands heads or tails with 50/50 odds.
function pickRandomSide(): Side {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

// Coin toss screen. Player picks a side, a 3D coin spins for ~2.2s, the
// landing face decides the toss winner, then a Continue button hands the
// outcome up to the parent.
export default function CoinTossScreen({ playerName, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('choosing')
  const [userChoice, setUserChoice] = useState<Side | null>(null)
  const [result, setResult] = useState<Side | null>(null)

  const targetRotation = result === null ? 0 : 360 * FLIP_ROTATIONS + (result === 'tails' ? 180 : 0)

  const handlePick = (side: Side) => {
    setUserChoice(side)
    setResult(pickRandomSide())
    setPhase('flipping')
  }

  const handleContinue = () => {
    if (!userChoice || !result) return
    const winner: TossWinner = userChoice === result ? 'player' : 'computer'
    onComplete({ userChoice, result, winner })
  }

  const winner: TossWinner | null =
    userChoice && result ? (userChoice === result ? 'player' : 'computer') : null

  return (
    <motion.div
      key="coin-toss-screen"
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
              Toss time, {playerName}!
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.75 }}>
              Pick a side. The coin flips, the loser bowls first.
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
                phase === 'flipping'
                  ? { duration: FLIP_DURATION, ease: 'easeOut' }
                  : { duration: 0 }
              }
              onAnimationComplete={() => {
                if (phase === 'flipping') setPhase('revealed')
              }}
            >
              <CoinFace label="H" front />
              <CoinFace label="T" />
            </motion.div>
          </Box>

          <AnimatePresence mode="wait">
            {phase === 'choosing' && (
              <motion.div
                key="picker"
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
                    onClick={() => handlePick('heads')}
                    sx={{ flex: 1, py: 1.5, fontSize: '1rem' }}
                  >
                    Heads
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    size="large"
                    onClick={() => handlePick('tails')}
                    sx={{ flex: 1, py: 1.5, fontSize: '1rem' }}
                  >
                    Tails
                  </Button>
                </Stack>
              </motion.div>
            )}

            {phase === 'flipping' && (
              <motion.div
                key="flipping"
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

            {phase === 'revealed' && winner && result && userChoice && (
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
                      color: winner === 'player' ? 'primary.light' : 'secondary.light',
                      fontWeight: 600,
                    }}
                  >
                    {winner === 'player'
                      ? `You called ${userChoice} — you won the toss!`
                      : `You called ${userChoice}. Computer wins the toss.`}
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

// One face of the spinning coin. The back face is pre-rotated 180° on Y
// so backface-visibility hides whichever side isn't currently facing camera.
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
