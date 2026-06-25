import { useEffect } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import SportsCricketIcon from '@mui/icons-material/SportsCricket'
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball'
import { motion, type Variants } from 'framer-motion'
import { useMultiplayer } from '../multiplayer/useMultiplayer'
import type { Innings, Role, RoleDecision, TossOutcome } from '../game/types'

type Props = {
  playerName: string
  tossOutcome: TossOutcome
  onRoleSet: (decision: RoleDecision) => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// Maps `(chooser, role)` to the side that bats first. Same pure helper as
// the singleplayer screen — duplicated here so the multiplayer screen stays
// self-contained.
function deriveFirstInnings(chooser: 'player' | 'computer', role: Role): Innings {
  if (chooser === 'player') {
    return role === 'bat' ? 'player' : 'computer'
  }
  return role === 'bat' ? 'computer' : 'player'
}

// Multiplayer bat/bowl picker. The local player either won the toss (and
// therefore picks) or lost it (and waits for the opponent to broadcast
// ROLE_CHOICE). Both sides land at the same `RoleDecision` and bubble it up.
export default function MultiplayerBatOrBowlScreen({ playerName, tossOutcome, onRoleSet }: Props) {
  const { opponentName, subscribe, send } = useMultiplayer()
  // Local perspective: 'player' means me, so 'player' winner = I picked.
  const localWonToss = tossOutcome.winner === 'player'

  // Loser-only subscriber: listens for ROLE_CHOICE from the opponent.
  // Adopts the broadcast role and derives firstInnings from "opponent chose".
  useEffect(() => {
    if (localWonToss) return
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'ROLE_CHOICE') {
        onRoleSet({
          chooser: 'computer',
          role: msg.role,
          firstInnings: deriveFirstInnings('computer', msg.role),
        })
      }
    })
    return unsubscribe
  }, [localWonToss, subscribe, onRoleSet])

  // Winner click handler: broadcasts ROLE_CHOICE and immediately advances
  // the local UI. firstInnings derived from "I chose".
  const handlePick = (role: Role) => {
    send({ type: 'ROLE_CHOICE', role })
    onRoleSet({
      chooser: 'player',
      role,
      firstInnings: deriveFirstInnings('player', role),
    })
  }

  return (
    <motion.div
      key="multiplayer-bat-or-bowl-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box sx={{ width: '100%', maxWidth: 480, px: 3, py: 6, textAlign: 'center' }}>
        {localWonToss ? (
          <PickerView playerName={playerName} opponentName={opponentName} onPick={handlePick} />
        ) : (
          <WaitingView playerName={playerName} opponentName={opponentName} />
        )}
      </Box>
    </motion.div>
  )
}

// Toss winner's view: the title celebrates the win, then two large tile
// buttons let them pick Bat or Bowl. A small chip flags that the opponent
// is currently waiting on them.
function PickerView({
  playerName,
  opponentName,
  onPick,
}: {
  playerName: string
  opponentName: string | null
  onPick: (role: Role) => void
}) {
  return (
    <Stack spacing={4} alignItems="center">
      <Stack spacing={1} alignItems="center">
        <Typography variant="h4" component="h1" className="title">
          You won the toss, {playerName}!
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.75 }}>
          Pick what you want to do first.
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.6, mt: 0.5 }}>
          {opponentName ?? 'Your opponent'} is waiting.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} justifyContent="center">
        <RoleButton role="bat" onClick={() => onPick('bat')} />
        <RoleButton role="bowl" onClick={() => onPick('bowl')} />
      </Stack>
    </Stack>
  )
}

// Toss loser's view: title acknowledges the opponent won, plus a spinner
// while we wait for the ROLE_CHOICE message to arrive.
function WaitingView({
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
          Toss to {opponentName ?? 'opponent'}
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.75 }}>
          Hang tight, {playerName} — they're choosing what to do first.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <CircularProgress size={22} color="secondary" />
        <Typography variant="body1">Waiting for their pick…</Typography>
      </Stack>
    </Stack>
  )
}

// Tile button for the Bat/Bowl picker. Icon stacked above label,
// colour-keyed to match the rest of the app's primary/secondary palette.
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
