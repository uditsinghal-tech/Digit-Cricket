import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useMachine } from '@xstate/react'
import { cricketMachine, deriveWinner, type CricketContext } from '../game/machine'
import AnimatedFace, { type Mood } from '../components/AnimatedFace'
import { useSounds } from '../audio/useSounds'
import { useStadiumReaction } from '../stadium/useStadiumReaction'
import { useMultiplayer } from '../multiplayer/useMultiplayer'
import {
  BALL_NUMBERS,
  type BallEvent,
  type BallNumber,
  type BallsPerInnings,
  type GameMode,
  type Innings,
  type MatchResult,
} from '../game/types'

type Props = {
  playerName: string
  // What to label the opposing side as in every UI element. "Computer" in
  // singleplayer; the live opponent's name in multiplayer.
  opponentName: string
  firstBatter: Innings
  ballsPerInnings: BallsPerInnings
  // Defaults to 'singleplayer'. In multiplayer the screen waits for both
  // picks (own + opponent's via PeerJS) before dispatching to the machine.
  mode?: GameMode
  onComplete: (result: MatchResult) => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// Picks a face mood for one side based on the latest ball: batter smiles
// on runs, frowns on out; bowler is the opposite. Neutral outside the reveal.
function deriveMood(perspective: Innings, ctx: CricketContext, isRevealing: boolean): Mood {
  if (!isRevealing || !ctx.lastBall) return 'neutral'
  const { isOut, batter } = ctx.lastBall
  if (batter === perspective) return isOut ? 'sad' : 'happy'
  return isOut ? 'happy' : 'sad'
}

// The active gameplay screen. Drives the cricket state machine and renders
// the scoreboard, picks area, outcome banner, and the 1-6 pick buttons.
// In singleplayer the local pick goes straight to the machine; in
// multiplayer it's exchanged with the opponent over PeerJS first.
export default function GameplayScreen({
  playerName,
  opponentName,
  firstBatter,
  ballsPerInnings,
  mode = 'singleplayer',
  onComplete,
}: Props) {
  const [state, send] = useMachine(cricketMachine, {
    input: { playerName, firstBatter, ballsPerInnings },
  })
  const { play } = useSounds()
  const { triggerReaction } = useStadiumReaction()
  const { subscribe, send: sendNetwork } = useMultiplayer()
  const lastPlayedBallRef = useRef<BallEvent | null>(null)

  const ctx = state.context
  const isMultiplayer = mode === 'multiplayer'
  const isAwaiting = state.matches('awaitingPick')
  const isRevealing = state.matches('revealing')
  const isComplete = state.matches('complete')
  const playerBatting = ctx.currentBatter === 'player'

  // --- Multiplayer pick collection ---
  // Both picks for the current ball live in a single state object so the
  // ball-transition reset is one setState call (and one eslint-disable).
  const [pendingPicks, setPendingPicks] = useState<{
    local: BallNumber | null
    opp: BallNumber | null
  }>({ local: null, opp: null })

  // Subscribes to inbound PICK messages in multiplayer mode and stashes
  // the opponent's pick locally. Auto-unsubscribes on unmount.
  useEffect(() => {
    if (!isMultiplayer) return
    return subscribe((msg) => {
      if (msg.type === 'PICK') {
        setPendingPicks((prev) => ({ ...prev, opp: msg.number }))
      }
    })
  }, [isMultiplayer, subscribe])

  // Once we have both picks AND the machine is ready for a new ball,
  // dispatch a single PICK with both picks. The machine processes the ball
  // and transitions to revealing.
  useEffect(() => {
    if (!isMultiplayer) return
    if (pendingPicks.local === null || pendingPicks.opp === null) return
    if (!isAwaiting) return
    send({ type: 'PICK', number: pendingPicks.local, opponentPick: pendingPicks.opp })
  }, [isMultiplayer, pendingPicks, isAwaiting, send])

  // After a ball is processed the machine increments `ballsThisInnings` (or
  // bumps `inningsNumber` at the innings switch). Either change marks the
  // start of a new ball, so clear the accumulator. The setState in an effect
  // is a legitimate sync of view state to machine state.
  useEffect(() => {
    if (!isMultiplayer) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingPicks({ local: null, opp: null })
  }, [isMultiplayer, ctx.ballsThisInnings, ctx.inningsNumber])

  // Match completion bubble-up. The machine transitions to `complete` after
  // the final ball; we package the final context into a MatchResult and hand
  // it to the parent so it can navigate to MatchResultScreen.
  useEffect(() => {
    if (!isComplete) return
    onComplete({
      playerName: ctx.playerName,
      firstBatter: ctx.firstBatter,
      ballsPerInnings: ctx.ballsPerInnings,
      playerScore: ctx.playerScore,
      computerScore: ctx.computerScore,
      winner: deriveWinner(ctx),
      events: ctx.events,
    })
  }, [isComplete, ctx, onComplete])

  // For wickets and boundaries, schedule the crowd-cheer + commentary AND the
  // stadium visual reaction to land alongside the OutcomeBanner ~1.1s into
  // the reveal. Regular runs ride on the ambient crowd alone.
  useEffect(() => {
    const ball = ctx.lastBall
    if (!isRevealing || !ball || ball === lastPlayedBallRef.current) return
    lastPlayedBallRef.current = ball
    if (!ball.isOut && ball.runs !== 4 && ball.runs !== 6) return
    const timer = setTimeout(() => {
      const kind = ball.isOut ? 'wicket' : ball.runs === 6 ? 'six' : 'four'
      play(kind)
      triggerReaction(kind)
    }, 1100)
    return () => clearTimeout(timer)
  }, [isRevealing, ctx.lastBall, play, triggerReaction])

  // Handles a 1-6 button press. In singleplayer the press dispatches PICK
  // straight to the machine. In multiplayer it stashes the local pick and
  // broadcasts it over the data channel; the machine waits for both picks.
  const handlePick = (n: BallNumber) => {
    if (isMultiplayer) {
      if (pendingPicks.local !== null) return // already picked this ball; ignore
      setPendingPicks((prev) => ({ ...prev, local: n }))
      sendNetwork({ type: 'PICK', number: n })
    } else {
      send({ type: 'PICK', number: n })
    }
  }

  const playerPick =
    ctx.lastBall && (playerBatting ? ctx.lastBall.batterPick : ctx.lastBall.bowlerPick)
  const computerPick =
    ctx.lastBall && (playerBatting ? ctx.lastBall.bowlerPick : ctx.lastBall.batterPick)

  const playerMood = deriveMood('player', ctx, isRevealing)
  const computerMood = deriveMood('computer', ctx, isRevealing)

  // In multiplayer, disable the buttons once the local player has picked
  // (waiting for the opponent). Singleplayer just uses the machine state.
  const buttonsDisabled =
    !isAwaiting || isComplete || (isMultiplayer && pendingPicks.local !== null)

  // Multiplayer-only "waiting for opponent" hint shown under the pick buttons
  // while the local player has picked but the opponent's pick hasn't arrived.
  const waitingForOpponent =
    isMultiplayer && isAwaiting && pendingPicks.local !== null && pendingPicks.opp === null

  return (
    <motion.div
      key="gameplay-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box sx={{ width: '100%', maxWidth: 520, px: 2, py: 1.5 }}>
        <Stack spacing={1.75} alignItems="stretch">
          <Scoreboard
            ctx={ctx}
            playerName={playerName}
            opponentName={opponentName}
            playerMood={playerMood}
            computerMood={computerMood}
          />

          <RoleBanner
            playerBatting={playerBatting}
            playerName={playerName}
            opponentName={opponentName}
          />

          <PicksDisplay
            playerName={playerName}
            opponentName={opponentName}
            playerPick={isRevealing ? playerPick : null}
            computerPick={isRevealing ? computerPick : null}
            isOut={isRevealing ? ctx.lastBall?.isOut === true : false}
          />

          <OutcomeBanner isRevealing={isRevealing} lastBall={ctx.lastBall} />

          <PickButtons
            disabled={buttonsDisabled}
            onPick={handlePick}
            playerBatting={playerBatting}
          />

          {waitingForOpponent && (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <CircularProgress size={16} color="secondary" />
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Waiting for {opponentName} to pick…
              </Typography>
            </Stack>
          )}
        </Stack>
      </Box>
    </motion.div>
  )
}

// Top panel: innings + target chips, both player cards, ball-progress bar.
function Scoreboard({
  ctx,
  playerName,
  opponentName,
  playerMood,
  computerMood,
}: {
  ctx: CricketContext
  playerName: string
  opponentName: string
  playerMood: Mood
  computerMood: Mood
}) {
  const progress = Math.min(ctx.ballsThisInnings / ctx.ballsPerInnings, 1) * 100
  return (
    <Box
      sx={{
        border: '1px solid rgba(148, 163, 184, 0.25)',
        borderRadius: 2,
        p: 1.25,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
        <Chip
          size="small"
          label={`Innings ${ctx.inningsNumber}`}
          color={ctx.inningsNumber === 1 ? 'primary' : 'secondary'}
          variant="outlined"
        />
        {ctx.target !== null && (
          <Chip size="small" label={`Target ${ctx.target}`} color="warning" variant="outlined" />
        )}
      </Stack>

      <Stack direction="row" justifyContent="space-around" alignItems="center" sx={{ mb: 0.75 }}>
        <PlayerCard label={playerName} score={ctx.playerScore} mood={playerMood} accent="primary" />
        <Typography variant="h6" sx={{ opacity: 0.45 }}>
          vs
        </Typography>
        <PlayerCard
          label={opponentName}
          score={ctx.computerScore}
          mood={computerMood}
          accent="secondary"
        />
      </Stack>

      <LinearProgress
        variant="determinate"
        value={progress}
        color={ctx.inningsNumber === 1 ? 'primary' : 'secondary'}
        sx={{ height: 5, borderRadius: 3 }}
      />
      <Typography variant="caption" sx={{ opacity: 0.6, mt: 0.5, display: 'block' }}>
        Ball {ctx.ballsThisInnings} of {ctx.ballsPerInnings}
      </Typography>
    </Box>
  )
}

// One side of the scoreboard: name on top, animated face below, score underneath.
function PlayerCard({
  label,
  score,
  mood,
  accent,
}: {
  label: string
  score: number
  mood: Mood
  accent: 'primary' | 'secondary'
}) {
  const variant = accent === 'primary' ? 'player' : 'computer'
  return (
    <Stack alignItems="center" spacing={0.25} sx={{ minWidth: 110 }}>
      <Typography variant="caption" sx={{ opacity: 0.7, letterSpacing: '0.08em' }}>
        {label.toUpperCase()}
      </Typography>
      <AnimatedFace variant={variant} mood={mood} size={52} />
      <AnimatedScore score={score} accent={accent} />
    </Stack>
  )
}

// Score number that slides+fades between values whenever the score changes.
function AnimatedScore({ score, accent }: { score: number; accent: 'primary' | 'secondary' }) {
  return (
    <Box sx={{ position: 'relative', minHeight: 30 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={score}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Typography variant="h5" sx={{ fontWeight: 800, color: `${accent}.light` }}>
            {score}
          </Typography>
        </motion.div>
      </AnimatePresence>
    </Box>
  )
}

// Two chips reminding the user who's batting and who's bowling this innings.
function RoleBanner({
  playerBatting,
  playerName,
  opponentName,
}: {
  playerBatting: boolean
  playerName: string
  opponentName: string
}) {
  return (
    <Stack direction="row" justifyContent="center" spacing={1} alignItems="center">
      <Chip
        size="small"
        label={playerBatting ? `${playerName} batting` : `${opponentName} batting`}
        color={playerBatting ? 'primary' : 'secondary'}
      />
      <Chip
        size="small"
        variant="outlined"
        label={playerBatting ? `${opponentName} bowling` : `${playerName} bowling`}
      />
    </Stack>
  )
}

// Side-by-side cards for the current ball's picks. Shows "?" while waiting
// and reveals the player's number first, then the opponent's, with a delay.
function PicksDisplay({
  playerName,
  opponentName,
  playerPick,
  computerPick,
  isOut,
}: {
  playerName: string
  opponentName: string
  playerPick: BallNumber | null | undefined
  computerPick: BallNumber | null | undefined
  isOut: boolean
}) {
  return (
    <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
      <PickCard label={playerName} pick={playerPick} accent="primary" isOut={isOut} delay={0} />
      <Typography variant="h6" sx={{ opacity: 0.4 }}>
        vs
      </Typography>
      <PickCard
        label={opponentName}
        pick={computerPick}
        accent="secondary"
        isOut={isOut}
        delay={0.6}
      />
    </Stack>
  )
}

// One pick card. Animates between the "?" placeholder and the revealed number,
// with the number tinted red when this ball was the wicket-taking one.
function PickCard({
  label,
  pick,
  accent,
  isOut,
  delay,
}: {
  label: string
  pick: BallNumber | null | undefined
  accent: 'primary' | 'secondary'
  isOut: boolean
  delay: number
}) {
  const accentColor = accent === 'primary' ? '#38bdf8' : '#a855f7'
  return (
    <Stack alignItems="center" spacing={0.5} sx={{ width: 100 }}>
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: 2.5,
          border: `2px solid ${accentColor}`,
          background: 'linear-gradient(160deg, rgba(15,23,42,0.7), rgba(15,23,42,0.95))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 20px ${accentColor}44`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {pick == null ? (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.55 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Typography variant="h3" sx={{ fontWeight: 900, color: accentColor }}>
                ?
              </Typography>
            </motion.div>
          ) : (
            <motion.div
              key={`pick-${pick}`}
              initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ delay, duration: 0.45, type: 'spring', stiffness: 220 }}
            >
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 900,
                  color: isOut ? '#f87171' : accentColor,
                }}
              >
                {pick}
              </Typography>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.7, letterSpacing: '0.08em' }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
  )
}

// OUT! / FOUR! / SIX! / +N runs chip that pops in once both pick cards are visible.
// Boundaries (4 and 6) get a distinct gradient banner; sixes get a spark burst on top.
function OutcomeBanner({
  isRevealing,
  lastBall,
}: {
  isRevealing: boolean
  lastBall: BallEvent | null
}) {
  const showOutcome = isRevealing && lastBall !== null
  const boundaryType: 'four' | 'six' | null =
    lastBall && !lastBall.isOut
      ? lastBall.runs === 6
        ? 'six'
        : lastBall.runs === 4
          ? 'four'
          : null
      : null
  return (
    <Box
      sx={{
        minHeight: 44,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {showOutcome && boundaryType === 'six' && <SparkBurst />}
      <AnimatePresence mode="wait">
        {showOutcome && lastBall && (
          <motion.div
            key={`outcome-${lastBall.innings}-${lastBall.runs}-${lastBall.isOut}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ delay: 1.1, duration: 0.35, type: 'spring', stiffness: 200 }}
            style={{ position: 'relative', zIndex: 1 }}
          >
            {lastBall.isOut ? (
              <Chip
                label="OUT!"
                color="error"
                sx={{
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  px: 2,
                  py: 2.25,
                  letterSpacing: '0.15em',
                }}
              />
            ) : boundaryType ? (
              <BoundaryBanner type={boundaryType} />
            ) : (
              <Chip
                label={`+${lastBall.runs} run${lastBall.runs === 1 ? '' : 's'}`}
                color="success"
                sx={{ fontWeight: 800, fontSize: '0.95rem', px: 2, py: 2.25 }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}

// Row of 1-6 buttons. Disabled outside the awaitingPick state and after the match ends.
function PickButtons({
  disabled,
  onPick,
  playerBatting,
}: {
  disabled: boolean
  onPick: (n: BallNumber) => void
  playerBatting: boolean
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="caption" sx={{ textAlign: 'center', opacity: 0.7 }}>
        {playerBatting ? 'Pick a number to score' : 'Pick a number to bowl'}
      </Typography>
      <Stack direction="row" spacing={1} justifyContent="center">
        {BALL_NUMBERS.map((n) => (
          <motion.div key={n} whileTap={{ scale: 0.92 }} style={{ flex: 1 }}>
            <Button
              variant="contained"
              color={playerBatting ? 'primary' : 'secondary'}
              size="medium"
              disabled={disabled}
              onClick={() => onPick(n)}
              sx={{
                width: '100%',
                minWidth: 0,
                py: 1.1,
                fontSize: '1.05rem',
                fontWeight: 800,
              }}
            >
              {n}
            </Button>
          </motion.div>
        ))}
      </Stack>
    </Stack>
  )
}

// Boundary banner shown in place of the regular runs chip when the batter
// scores a 4 or a 6. Distinct gradient + glow per type, same vertical footprint
// so the layout doesn't shift.
function BoundaryBanner({ type }: { type: 'four' | 'six' }) {
  const isSix = type === 'six'
  return (
    <Box
      sx={{
        px: 2.5,
        py: 1.1,
        borderRadius: 9999,
        background: isSix
          ? 'linear-gradient(135deg, #fbbf24 0%, #ec4899 50%, #a855f7 100%)'
          : 'linear-gradient(135deg, #22c55e 0%, #38bdf8 100%)',
        color: '#0f172a',
        fontWeight: 900,
        fontSize: '1rem',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        boxShadow: isSix
          ? '0 0 32px rgba(251, 191, 36, 0.55), 0 0 14px rgba(168, 85, 247, 0.4)'
          : '0 0 24px rgba(56, 189, 248, 0.45)',
      }}
    >
      {isSix ? 'SIX!' : 'FOUR!'}
    </Box>
  )
}

// Star-burst overlay rendered around the SIX! banner. Six small dots fly out
// radially from the centre and fade, kept off the normal flow with absolute positioning.
function SparkBurst() {
  const sparks = Array.from({ length: 8 }).map((_, i) => {
    const angle = (i / 8) * Math.PI * 2
    return {
      dx: Math.cos(angle) * 56,
      dy: Math.sin(angle) * 56,
      delay: 1.15 + (i % 4) * 0.04,
    }
  })
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {sparks.map((s, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
          animate={{
            x: s.dx,
            y: s.dy,
            opacity: [0, 1, 0],
            scale: [0, 1, 0.4],
          }}
          transition={{ duration: 0.7, delay: s.delay, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#fde68a',
            boxShadow: '0 0 12px #fbbf24, 0 0 4px #fef3c7',
          }}
        />
      ))}
    </Box>
  )
}
