import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import SportsCricketIcon from '@mui/icons-material/SportsCricket'
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import type { Innings, Role, RoleDecision, TossOutcome } from '../game/types'

type Phase = 'choosing' | 'computing' | 'decided'

type Props = {
  playerName: string
  tossOutcome: TossOutcome
  onComplete: (decision: RoleDecision) => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

const COMPUTE_DELAY_MS = 1600

// Computer's bat-or-bowl choice when it wins the toss.
function pickRandomRole(): Role {
  return Math.random() < 0.5 ? 'bat' : 'bowl'
}

// Maps `(toss-winner, their chosen role)` to who actually bats first.
function deriveFirstInnings(chooser: 'player' | 'computer', role: Role): Innings {
  if (chooser === 'player') {
    return role === 'bat' ? 'player' : 'computer'
  }
  return role === 'bat' ? 'computer' : 'player'
}

// Bat-or-bowl decision screen. If the player won the toss they pick;
// otherwise the computer "thinks" for ~1.6s then reveals its own pick.
export default function BatOrBowlScreen({ playerName, tossOutcome, onComplete }: Props) {
  const playerWon = tossOutcome.winner === 'player'
  const [phase, setPhase] = useState<Phase>(playerWon ? 'choosing' : 'computing')
  const [computerRole, setComputerRole] = useState<Role | null>(null)

  useEffect(() => {
    if (phase !== 'computing') return
    const timer = setTimeout(() => {
      setComputerRole(pickRandomRole())
      setPhase('decided')
    }, COMPUTE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [phase])

  // Fires when the toss-winning player picks Bat or Bowl. Resolves the role
  // decision and hands it back up to the parent screen.
  const handlePlayerPick = (role: Role) => {
    onComplete({
      chooser: 'player',
      role,
      firstInnings: deriveFirstInnings('player', role),
    })
  }

  // Fires when the player acknowledges the computer's auto-pick. Same payload
  // shape as `handlePlayerPick`, just with chooser='computer'.
  const handleContinueAfterComputer = () => {
    if (!computerRole) return
    onComplete({
      chooser: 'computer',
      role: computerRole,
      firstInnings: deriveFirstInnings('computer', computerRole),
    })
  }

  return (
    <motion.div
      key="bat-or-bowl-screen"
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
              {playerWon ? `You won the toss, ${playerName}!` : 'Computer won the toss'}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.75 }}>
              {playerWon
                ? 'Pick what you want to do first.'
                : 'The computer is deciding what to do first.'}
            </Typography>
          </Stack>

          <AnimatePresence mode="wait">
            {playerWon && phase === 'choosing' && (
              <motion.div
                key="player-picker"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
                style={{ width: '100%' }}
              >
                <Stack direction="row" spacing={2} justifyContent="center">
                  <RoleButton role="bat" onClick={() => handlePlayerPick('bat')} />
                  <RoleButton role="bowl" onClick={() => handlePlayerPick('bowl')} />
                </Stack>
              </motion.div>
            )}

            {!playerWon && phase === 'computing' && (
              <motion.div
                key="computing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Stack spacing={2} alignItems="center">
                  <CircularProgress color="secondary" />
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    Computer is thinking…
                  </Typography>
                </Stack>
              </motion.div>
            )}

            {!playerWon && phase === 'decided' && computerRole && (
              <motion.div
                key="decided"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                style={{ width: '100%' }}
              >
                <Stack spacing={3} alignItems="center">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    {computerRole === 'bat' ? (
                      <SportsCricketIcon sx={{ fontSize: 36, color: 'secondary.light' }} />
                    ) : (
                      <SportsBaseballIcon sx={{ fontSize: 36, color: 'secondary.light' }} />
                    )}
                    <Typography variant="h6" sx={{ color: 'secondary.light' }}>
                      Computer chose to {computerRole} first
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>
                    That means <strong>you</strong> will {computerRole === 'bat' ? 'bowl' : 'bat'}{' '}
                    first.
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleContinueAfterComputer}
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

// Tile button for the Bat or Bowl choice. Icon stacked above the label,
// colour-keyed to player/computer accents for consistency.
function RoleButton({ role, onClick }: { role: Role; onClick: () => void }) {
  const isBat = role === 'bat'
  return (
    <Button
      variant="contained"
      color={isBat ? 'primary' : 'secondary'}
      size="large"
      onClick={onClick}
      sx={{
        flex: 1,
        py: 2,
        flexDirection: 'column',
        gap: 1,
        fontSize: '1.05rem',
      }}
    >
      {isBat ? (
        <SportsCricketIcon sx={{ fontSize: 32 }} />
      ) : (
        <SportsBaseballIcon sx={{ fontSize: 32 }} />
      )}
      {isBat ? 'Bat' : 'Bowl'}
    </Button>
  )
}
