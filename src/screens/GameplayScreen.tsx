import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import Badge from '@mui/material/Badge'
import SportsCricketIcon from '@mui/icons-material/SportsCricket'
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball'
import CallIcon from '@mui/icons-material/Call'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ChatIcon from '@mui/icons-material/Chat'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useMachine } from '@xstate/react'
import { cricketMachine, deriveWinner, type CricketContext } from '../game/machine'
import AnimatedFace, { type Mood } from '../components/AnimatedFace'
import { useSounds } from '../audio/useSounds'
import { useStadiumReaction } from '../stadium/useStadiumReaction'
import { useMultiplayer, type VoiceCallStatus } from '../multiplayer/useMultiplayer'
import { CHAT_MESSAGE_MAX_LENGTH } from '../multiplayer/messages'
import { sanitizeChatMessage } from '../multiplayer/chatSafety'
import {
  BALL_NUMBERS,
  type BallEvent,
  type BallNumber,
  type BallsPerInnings,
  type GameMode,
  type Innings,
  type MatchResult,
  type TotalInnings,
} from '../game/types'

type Props = {
  playerName: string
  // What to label the opposing side as in every UI element. "Computer" in
  // singleplayer; the live opponent's name in multiplayer.
  opponentName: string
  firstBatter: Innings
  ballsPerInnings: BallsPerInnings
  // Total innings the match runs for. Optional — defaults to 2 so the
  // multiplayer call site (which doesn't surface the test format yet)
  // keeps working without change.
  totalInnings?: TotalInnings
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

// Per-ball think-time. If the local player doesn't pick a 1-6 within this
// window, the timer auto-fires a PICK with value 0 (the "no-pick" sentinel
// that the cricket rules degrade safely against — see BallNumber type docs).
const BALL_TIMER_SECONDS = 10
// When the remaining seconds drop to this value (or below) the clock UI
// flips from the calm "green" palette to the urgent "red" palette so the
// player feels the deadline approaching. 4s ≈ 40% of the window — late
// enough to feel like a real warning, early enough to still react.
const TIMER_WARNING_THRESHOLD = 4
// Maps a pick number to the hand gesture the pick card should display
// when it's revealed. 1..5 are "this many fingers up" emoji, 6 is a
// thumbs-up (since 6 fingers aren't a thing), and 0 (the auto-pick
// sentinel fired when the timer expires) collapses back to the closed
// fist so a timeout pick visually reads as "didn't show their hand".
function gestureFor(pick: BallNumber): string {
  switch (pick) {
    case 1:
      return '☝️'
    case 2:
      return '✌️'
    case 3:
      return '🤟'
    case 4:
      return '🤚'
    case 5:
      return '🖐'
    case 6:
      return '👍'
    default:
      return '✊'
  }
}

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
  totalInnings = 2,
  mode = 'singleplayer',
  onComplete,
}: Props) {
  const [state, send] = useMachine(cricketMachine, {
    input: { playerName, firstBatter, ballsPerInnings, totalInnings },
  })
  const { play } = useSounds()
  const { triggerReaction } = useStadiumReaction()
  const {
    subscribe,
    send: sendNetwork,
    voiceStatus,
    voiceSupported,
    voiceError,
    isMuted,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  } = useMultiplayer()
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

  // --- Multiplayer text chat ---
  // Local mirror of every chat message exchanged this match, in send
  // order. `from === 'me'` for messages this peer typed, `from === 'opp'`
  // for incoming. Capped at CHAT_HISTORY_CAP entries so a long match
  // can't grow the chat array unbounded.
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const [chatUnread, setChatUnread] = useState(0)

  // Subscribes to inbound PICK + CHAT messages in multiplayer mode and
  // stashes them locally. Auto-unsubscribes on unmount.
  useEffect(() => {
    if (!isMultiplayer) return
    return subscribe((msg) => {
      if (msg.type === 'PICK') {
        setPendingPicks((prev) => ({ ...prev, opp: msg.number }))
      } else if (msg.type === 'CHAT') {
        // Defence in depth: even though the sender sanitises before
        // putting the message on the wire, run the full safety
        // pipeline again on receive. A malicious peer could ship a
        // crafted payload that bypasses their local filter.
        const text = sanitizeChatMessage(msg.text, CHAT_MESSAGE_MAX_LENGTH)
        if (!text) return
        setChatHistory((prev) => capChatHistory([...prev, { from: 'opp', text, ts: msg.ts }]))
        // Only bump the unread counter when the panel is closed —
        // an already-open panel scrolls to the new message instead.
        setChatUnread((u) => (chatOpen ? u : u + 1))
      }
    })
  }, [isMultiplayer, subscribe, chatOpen])

  // Once we have both picks AND the machine is ready for a new ball,
  // dispatch a single PICK with both picks. The machine processes the ball
  // and transitions to revealing.
  useEffect(() => {
    if (!isMultiplayer) return
    if (pendingPicks.local === null || pendingPicks.opp === null) return
    if (!isAwaiting) return
    send({ type: 'PICK', number: pendingPicks.local, opponentPick: pendingPicks.opp })
  }, [isMultiplayer, pendingPicks, isAwaiting, send])

  // Send the current chat draft to the opponent and append to local
  // history. Runs the full safety pipeline first (control-character
  // strip, bidi-trick strip, whitespace collapse, length cap, profanity
  // mask). No-op when the cleaned draft is empty.
  const handleSendChat = () => {
    if (!isMultiplayer) return
    const cleaned = sanitizeChatMessage(chatDraft, CHAT_MESSAGE_MAX_LENGTH)
    if (!cleaned) {
      setChatDraft('')
      return
    }
    const ts = Date.now()
    sendNetwork({ type: 'CHAT', text: cleaned, ts })
    setChatHistory((prev) => capChatHistory([...prev, { from: 'me', text: cleaned, ts }]))
    setChatDraft('')
  }

  // Opens the chat panel and clears the unread badge so reopening is a
  // no-op once the user has seen the new messages.
  const handleOpenChat = () => {
    setChatOpen(true)
    setChatUnread(0)
  }

  // After a ball is processed the machine increments `ballsThisInnings` (or
  // bumps `inningsNumber` at the innings switch). Either change marks the
  // start of a new ball, so clear the accumulator. The setState in an effect
  // is a legitimate sync of view state to machine state.
  useEffect(() => {
    if (!isMultiplayer) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingPicks({ local: null, opp: null })
  }, [isMultiplayer, ctx.ballsThisInnings, ctx.inningsNumber])

  // The instant the match finishes, drop any live voice call. The mic
  // stops, the MediaConnection closes, and the remote side sees the
  // hang-up before the result screen even mounts. Also runs on unmount so
  // a back-out mid-match doesn't leave a hot mic dangling.
  useEffect(() => {
    if (isComplete) {
      endCall()
    }
    return () => {
      endCall()
    }
  }, [isComplete, endCall])

  // Match completion bubble-up. The machine transitions to `complete` after
  // the final ball; we package the final context into a MatchResult and hand
  // it to the parent so it can navigate to MatchResultScreen.
  useEffect(() => {
    if (!isComplete) return
    onComplete({
      playerName: ctx.playerName,
      firstBatter: ctx.firstBatter,
      ballsPerInnings: ctx.ballsPerInnings,
      totalInnings: ctx.totalInnings,
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

  // Handles a 1-6 button press OR the timer auto-pick of 0. In singleplayer
  // the press dispatches PICK straight to the machine. In multiplayer it
  // stashes the local pick and broadcasts it over the data channel; the
  // machine waits for both picks.
  const handlePick = (n: BallNumber) => {
    if (isMultiplayer) {
      if (pendingPicks.local !== null) return // already picked this ball; ignore
      setPendingPicks((prev) => ({ ...prev, local: n }))
      sendNetwork({ type: 'PICK', number: n })
    } else {
      send({ type: 'PICK', number: n })
    }
  }

  // --- Per-ball countdown timer ---
  // Visible seconds-remaining for the current ball. Drives both the central
  // digit on the clock face and the dot-extinguish animation around its rim.
  const [secondsLeft, setSecondsLeft] = useState<number>(BALL_TIMER_SECONDS)

  // We need to fire `handlePick(0)` from inside a setTimeout callback that
  // outlives the render that scheduled it. Capturing handlePick directly
  // would close over a potentially-stale `pendingPicks` / `isMultiplayer`,
  // so we mirror the latest function into a ref and call through that ref.
  const handlePickRef = useRef(handlePick)
  useEffect(() => {
    handlePickRef.current = handlePick
  })

  // Timer effect — runs once per "the player needs to make a pick" window.
  // Three things happen here:
  //   1. The visible counter is reset to BALL_TIMER_SECONDS as soon as a new
  //      pick window opens (new ball or fresh innings).
  //   2. A setInterval ticks the visible counter down one per second so the
  //      clock-face digit + the dot ring update in lockstep with wall-clock.
  //   3. A separate setTimeout fires exactly at BALL_TIMER_SECONDS to invoke
  //      the auto-pick with value 0 — independent of the visible tick so a
  //      slow render doesn't postpone the actual deadline.
  //
  // The effect bails (and any prior timer is cleaned up by the return fn)
  // when:
  //   - The state machine isn't waiting for a pick (revealing / complete).
  //   - The match has ended.
  //   - The local peer has already picked in multiplayer (we don't want to
  //     fire the auto-pick after a manual one, and we don't want the dial
  //     to keep ticking while the opponent's pick is still in flight).
  useEffect(() => {
    if (!isAwaiting || isComplete) return
    if (isMultiplayer && pendingPicks.local !== null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSecondsLeft(BALL_TIMER_SECONDS)
    const tick = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(s - 1, 0))
    }, 1000)
    const fire = window.setTimeout(() => {
      // Read through the ref — `handlePick` here may be a stale closure.
      handlePickRef.current(0)
    }, BALL_TIMER_SECONDS * 1000)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(fire)
    }
  }, [
    isAwaiting,
    isComplete,
    isMultiplayer,
    pendingPicks.local,
    ctx.ballsThisInnings,
    ctx.inningsNumber,
  ])

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

  // The clock is only meaningful while the local player still owes a pick.
  // Hide it once they've committed (singleplayer machine moves past
  // awaitingPick; multiplayer flips pendingPicks.local) and once the match
  // has ended.
  const showTimer = isAwaiting && !isComplete && (!isMultiplayer || pendingPicks.local === null)

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
            playerBatting={playerBatting}
            showTimer={showTimer}
            secondsLeft={secondsLeft}
          />

          <PicksDisplay
            playerName={playerName}
            opponentName={opponentName}
            playerBatting={playerBatting}
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

      {/* Voice + chat panels, fixed to the top-right corner just under
          the row of toggle icons (Stats / Info / Theme / Mute). Hidden
          entirely in singleplayer; mobile / narrow viewports drop them
          into a regular flow at the bottom of the screen via the
          responsive style. */}
      {isMultiplayer && (
        <Box
          sx={{
            position: 'fixed',
            top: '50%',
            right: 12,
            transform: 'translateY(-50%)',
            width: 280,
            maxWidth: 'calc(100vw - 24px)',
            zIndex: 9,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <VoiceCallPanel
            opponentName={opponentName}
            voiceStatus={voiceStatus}
            voiceSupported={voiceSupported}
            voiceError={voiceError}
            isMuted={isMuted}
            onStart={() => void startCall()}
            onAccept={() => void acceptCall()}
            onReject={rejectCall}
            onEnd={endCall}
            onToggleMute={toggleMute}
          />

          <ChatPanel
            opponentName={opponentName}
            isOpen={chatOpen}
            unread={chatUnread}
            history={chatHistory}
            draft={chatDraft}
            onDraftChange={setChatDraft}
            onOpen={handleOpenChat}
            onClose={() => setChatOpen(false)}
            onSend={handleSendChat}
          />
        </Box>
      )}
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
  playerBatting,
  showTimer,
  secondsLeft,
}: {
  ctx: CricketContext
  playerName: string
  opponentName: string
  playerMood: Mood
  computerMood: Mood
  playerBatting: boolean
  showTimer: boolean
  secondsLeft: number
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
        <PlayerCard
          label={playerName}
          score={ctx.playerScore}
          mood={playerMood}
          accent="primary"
          isBatting={playerBatting}
        />
        <Stack alignItems="center" spacing={0.5} sx={{ mt: -3 }}>
          {showTimer && <BallTimer secondsLeft={secondsLeft} />}
          <Typography variant="h6" sx={{ opacity: 0.45 }}>
            vs
          </Typography>
        </Stack>
        <PlayerCard
          label={opponentName}
          score={ctx.computerScore}
          mood={computerMood}
          accent="secondary"
          isBatting={!playerBatting}
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
  isBatting,
}: {
  label: string
  score: number
  mood: Mood
  accent: 'primary' | 'secondary'
  isBatting: boolean
}) {
  const variant = accent === 'primary' ? 'player' : 'computer'
  const RoleIcon = isBatting ? SportsCricketIcon : SportsBaseballIcon
  return (
    <Stack alignItems="center" spacing={0.25} sx={{ minWidth: 110 }}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <RoleIcon sx={{ fontSize: 14, color: `${accent}.light` }} />
        <Typography variant="caption" sx={{ opacity: 0.7, letterSpacing: '0.08em' }}>
          {label.toUpperCase()}
        </Typography>
      </Stack>
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

// Side-by-side cards for the current ball's picks. Shows "?" while waiting
// and reveals the player's number first, then the opponent's, with a delay.
// Each side renders as a vertical column: a role chip (`Name batting` or
// `Name bowling`) on top, then the pick card below. The chip auto-sizes to
// its text, and the pick card is centred underneath so the "?" lines up
// directly with the chip's centre regardless of name length.
function PicksDisplay({
  playerName,
  opponentName,
  playerBatting,
  playerPick,
  computerPick,
  isOut,
}: {
  playerName: string
  opponentName: string
  playerBatting: boolean
  playerPick: BallNumber | null | undefined
  computerPick: BallNumber | null | undefined
  isOut: boolean
}) {
  return (
    <Stack direction="row" justifyContent="space-around" alignItems="flex-start" sx={{ mt: 1.25 }}>
      <Stack alignItems="center" spacing={0.75}>
        <Chip
          size="small"
          label={`${playerName} ${playerBatting ? 'Batting' : 'Bowling'}`}
          color="primary"
          variant={playerBatting ? 'filled' : 'outlined'}
        />
        <PickCard label={playerName} pick={playerPick} accent="primary" isOut={isOut} delay={0} />
      </Stack>
      <Typography variant="h6" sx={{ opacity: 0.4, mt: 5 }}>
        vs
      </Typography>
      <Stack alignItems="center" spacing={0.75}>
        <Chip
          size="small"
          label={`${opponentName} ${playerBatting ? 'Bowling' : 'Batting'}`}
          color="secondary"
          variant={playerBatting ? 'outlined' : 'filled'}
        />
        <PickCard
          label={opponentName}
          pick={computerPick}
          accent="secondary"
          isOut={isOut}
          delay={0.6}
        />
      </Stack>
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
    <Stack alignItems="center" spacing={0.5} sx={{ width: 120 }}>
      <Box
        sx={{
          width: 96,
          height: 96,
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
            // Waiting: closed fist that bobs up and down on a continuous
            // loop, like a player tapping their hand getting ready to
            // reveal their pick.
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: [0, -6, 0, 6, 0] }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.2 },
                y: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' },
              }}
            >
              <Typography sx={{ fontSize: '3.2rem', lineHeight: 1 }}>✊</Typography>
            </motion.div>
          ) : (
            // Revealed: the hand gesture that corresponds to the pick.
            // 1..5 = that many fingers up; 6 = thumbs up; 0 = closed
            // fist (the auto-pick path when the timer expires).
            <motion.div
              key={`pick-${pick}`}
              initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ delay, duration: 0.45, type: 'spring', stiffness: 220 }}
            >
              <Typography
                sx={{
                  fontSize: '3.2rem',
                  lineHeight: 1,
                  // Wicket-taking pick gets a subtle desaturation so the
                  // emoji still reads but visually loses its colour pop.
                  filter: isOut ? 'grayscale(60%) brightness(0.85)' : 'none',
                  transition: 'filter 0.25s ease',
                }}
              >
                {gestureFor(pick)}
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

// Per-ball countdown clock, drawn in the same compact style as the quiz
// timer: a circular track ring + a live arc that drains clockwise as the
// seconds tick down, with a monospace digit in the centre. Stays green
// while there's slack and flips to red once the player hits
// TIMER_WARNING_THRESHOLD seconds, with a subtle scale pulse to draw the
// eye. All visual state derives purely from the `secondsLeft` prop —
// the owning GameplayScreen holds the real countdown logic and feeds the
// latest value down on every tick.
function BallTimer({ secondsLeft }: { secondsLeft: number }) {
  const isCritical = secondsLeft <= TIMER_WARNING_THRESHOLD
  const color = isCritical ? '#ef4444' : '#22c55e'
  const size = 52
  const stroke = 4.5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(1, secondsLeft / BALL_TIMER_SECONDS))
  const offset = circumference * (1 - progress)
  return (
    <motion.div
      animate={isCritical ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={
        isCritical
          ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 }
      }
      style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}
      aria-label={`${secondsLeft} seconds left to pick`}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(148, 163, 184, 0.22)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: 'stroke-dashoffset 1s linear, stroke 0.2s ease',
            filter: `drop-shadow(0 0 6px ${color}66)`,
          }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontWeight: 800,
            fontSize: '1rem',
            color,
            lineHeight: 1,
            textShadow: `0 0 6px ${color}55`,
            transition: 'color 0.2s ease, text-shadow 0.2s ease',
          }}
        >
          {secondsLeft}
        </Typography>
      </Box>
    </motion.div>
  )
}

// One entry in the multiplayer text-chat history. Kept lightweight on
// purpose — the chat is a transient in-match utility, not a stored log.
type ChatMessage = { from: 'me' | 'opp'; text: string; ts: number }

// Hard cap on how many chat entries we keep in memory. Long enough to
// scroll back through a match, short enough that a malicious peer can't
// grow the array unbounded.
const CHAT_HISTORY_CAP = 100

// Drops oldest entries when the history would exceed the cap.
function capChatHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= CHAT_HISTORY_CAP) return messages
  return messages.slice(messages.length - CHAT_HISTORY_CAP)
}

// Collapsible text-chat panel. Rides alongside the voice-call panel at
// the bottom of the gameplay column. Closed state is a single button
// with an unread badge; opened state is a small chat window with the
// message history (auto-scrolled to bottom), an input field, and a
// Send button. Messages are rendered through React Typography so HTML
// from the peer is escaped — a malicious peer can't inject markup.
function ChatPanel({
  opponentName,
  isOpen,
  unread,
  history,
  draft,
  onDraftChange,
  onOpen,
  onClose,
  onSend,
}: {
  opponentName: string
  isOpen: boolean
  unread: number
  history: ChatMessage[]
  draft: string
  onDraftChange: (next: string) => void
  onOpen: () => void
  onClose: () => void
  onSend: () => void
}) {
  // Scroll the message list to the bottom whenever a new message lands
  // or the panel opens. Plain DOM API because the message list is a
  // direct child of a fixed-height scrollable Box.
  const listEndRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!isOpen) return
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [isOpen, history.length])

  if (!isOpen) {
    return (
      <Stack direction="row" justifyContent="center">
        <Tooltip title={`Chat with ${opponentName}`} arrow>
          <Badge color="error" badgeContent={unread} max={9} overlap="circular">
            <Button
              size="small"
              variant="outlined"
              startIcon={<ChatIcon />}
              onClick={onOpen}
              className="purple-accent"
            >
              Chat
            </Button>
          </Badge>
        </Tooltip>
      </Stack>
    )
  }

  return (
    <Box
      className="match-panel"
      sx={{
        border: '1px solid rgba(148, 163, 184, 0.25)',
        borderRadius: 2,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid rgba(148,163,184,0.18)' }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <ChatIcon fontSize="small" sx={{ opacity: 0.85 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
            CHAT · {opponentName.toUpperCase()}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onClose} aria-label="Close chat">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Box
        sx={{
          maxHeight: 160,
          minHeight: 80,
          overflowY: 'auto',
          px: 1.25,
          py: 0.75,
        }}
      >
        {history.length === 0 ? (
          <Typography variant="caption" sx={{ opacity: 0.55, fontStyle: 'italic' }}>
            No messages yet. Say hi to {opponentName}!
          </Typography>
        ) : (
          history.map((msg, idx) => <ChatBubble key={`${msg.ts}-${idx}`} msg={msg} />)
        )}
        <div ref={listEndRef} />
      </Box>

      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ px: 1, py: 0.75, borderTop: '1px solid rgba(148,163,184,0.18)' }}
      >
        <TextField
          size="small"
          fullWidth
          variant="outlined"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value.slice(0, CHAT_MESSAGE_MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          slotProps={{ htmlInput: { maxLength: CHAT_MESSAGE_MAX_LENGTH } }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <IconButton
          color="secondary"
          onClick={onSend}
          disabled={draft.trim().length === 0}
          aria-label="Send message"
        >
          <SendIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  )
}

// One chat bubble. Local messages align right with the primary accent;
// opponent messages align left in slate. Text is rendered through
// Typography so any HTML payload from a hostile peer is escaped at the
// React boundary.
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isMe = msg.from === 'me'
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        mb: 0.5,
      }}
    >
      <Box
        sx={{
          maxWidth: '75%',
          px: 1,
          py: 0.4,
          borderRadius: 1.5,
          background: isMe ? 'rgba(56, 189, 248, 0.16)' : 'rgba(148, 163, 184, 0.12)',
          border: isMe
            ? '1px solid rgba(56, 189, 248, 0.4)'
            : '1px solid rgba(148, 163, 184, 0.25)',
        }}
      >
        <Typography variant="body2" sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {msg.text}
        </Typography>
      </Box>
    </Box>
  )
}

// Voice-call control row. Shown only in multiplayer matches, lives at the
// bottom of the gameplay column. Renders four mutually-exclusive states:
//   - idle      → a single "Call" button (or a "voice not supported" hint
//                 when getUserMedia is unavailable in this browser/origin).
//   - connecting→ a spinner + "Calling…" / "Connecting…" hint with End.
//   - incoming  → a clear "X is calling" line with Accept / Decline.
//   - active    → mute toggle + End call, with a small "On call" status.
// The component takes everything it needs as props so it stays a pure
// view — no direct multiplayer-context coupling.
function VoiceCallPanel({
  opponentName,
  voiceStatus,
  voiceSupported,
  voiceError,
  isMuted,
  onStart,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
}: {
  opponentName: string
  voiceStatus: VoiceCallStatus
  voiceSupported: boolean
  voiceError: string | null
  isMuted: boolean
  onStart: () => void
  onAccept: () => void
  onReject: () => void
  onEnd: () => void
  onToggleMute: () => void
}) {
  // Voice is unavailable on insecure origins (http://) and browsers
  // without getUserMedia. Hide everything in that case rather than
  // teasing a button that would fail on click.
  if (!voiceSupported) return null

  return (
    <Stack
      className="match-panel"
      direction="row"
      spacing={1}
      alignItems="center"
      justifyContent="center"
      sx={{
        mt: 0.5,
        p: 0.75,
        borderRadius: 2,
        border: '1px solid rgba(148, 163, 184, 0.25)',
        background: 'rgba(15, 23, 42, 0.45)',
      }}
    >
      {voiceStatus === 'idle' && (
        <>
          <Tooltip title={`Start voice call with ${opponentName}`} arrow>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CallIcon />}
              onClick={onStart}
              className="purple-accent"
            >
              Call {opponentName}
            </Button>
          </Tooltip>
          {voiceError && (
            <Typography variant="caption" color="error" sx={{ ml: 1 }}>
              {voiceError}
            </Typography>
          )}
        </>
      )}

      {voiceStatus === 'connecting' && (
        <>
          <CircularProgress size={16} color="secondary" />
          <Typography variant="caption" sx={{ opacity: 0.85 }}>
            Connecting voice…
          </Typography>
          <Button size="small" color="error" onClick={onEnd} startIcon={<CallEndIcon />}>
            Cancel
          </Button>
        </>
      )}

      {voiceStatus === 'incoming' && (
        <>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            📞 {opponentName} is calling
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<CallIcon />}
            onClick={onAccept}
          >
            Accept
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<CallEndIcon />}
            onClick={onReject}
          >
            Decline
          </Button>
        </>
      )}

      {voiceStatus === 'active' && (
        <>
          <Typography variant="caption" sx={{ opacity: 0.85 }}>
            🔴 On call with {opponentName}
          </Typography>
          <Tooltip title={isMuted ? 'Unmute' : 'Mute'} arrow>
            <IconButton size="small" onClick={onToggleMute}>
              {isMuted ? <MicOffIcon fontSize="small" /> : <MicIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            color="error"
            startIcon={<CallEndIcon />}
            onClick={onEnd}
          >
            End call
          </Button>
        </>
      )}
    </Stack>
  )
}
