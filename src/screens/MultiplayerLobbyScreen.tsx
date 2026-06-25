import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { motion, type Variants } from 'framer-motion'
import { useMultiplayer } from '../multiplayer/useMultiplayer'
import type { BallsPerInnings } from '../game/types'

type Props = {
  playerName: string
  onCancel: () => void
  // Called once the peer connection is open. Carries the match length the
  // host picked (so App can stash it without a separate screen). null when
  // we're the joiner — the length arrives via the MATCH_LENGTH message
  // App.tsx subscribes to globally.
  onConnected: (hostMatchLength: BallsPerInnings | null) => void
}

// Local view state on top of the global multiplayer status. The lobby now
// has four sub-views: the menu, the host's match-length picker (shown before
// the code is generated so the room is "configured" from the start), the
// hosting waiting screen, and the joiner's code-entry screen.
type LobbyView = 'menu' | 'hostMatchLength' | 'hosting' | 'joining'

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// How long a generated room code stays valid for. After this window the host
// is shown an "expired" message and auto-routed back to mode selection, and
// the PeerJS peer is destroyed so any joiner who tries the code from here on
// hits the same "Wrong code entered" error path as a typo.
const ROOM_CODE_LIFETIME_MS = 5 * 60 * 1000
// How long the expired message lingers before the host is auto-redirected
// to mode selection. Long enough to read, short enough to feel intentional.
const EXPIRED_AUTO_REDIRECT_MS = 4000

// Multiplayer lobby. Either creates a new room (Host: generates a 6-char
// code, waits for an opponent to join) or joins an existing one (Join:
// takes a code and dials it). Once the peer is connected, App.tsx
// notices via the multiplayer status and advances the screen.
export default function MultiplayerLobbyScreen({ playerName, onCancel, onConnected }: Props) {
  const { status, roomCode, errorMessage, host, join, disconnect, send } = useMultiplayer()
  const [view, setView] = useState<LobbyView>('menu')
  const [codeInput, setCodeInput] = useState('')
  // Host's match-length pick, captured BEFORE the room code is generated.
  // Stays null on the joiner side. Cached locally so the connect-time effect
  // can broadcast MATCH_LENGTH right after HELLO without an extra screen.
  const [hostMatchLength, setHostMatchLength] = useState<BallsPerInnings | null>(null)
  // True once the 5-minute lifetime of a generated room code elapses without
  // anyone joining. Drives the ExpiredView render below.
  const [isExpired, setIsExpired] = useState(false)

  // 5-minute room-code expiry watchdog. Starts ticking once the host has a
  // live, unjoined room (view=hosting, roomCode set, status still 'hosting').
  // If it fires, we destroy the peer (so the broker no longer routes that
  // code — the joiner's existing wrong-code path will take over for any late
  // dial attempts) and flip into the ExpiredView for the host.
  useEffect(() => {
    if (view !== 'hosting' || !roomCode || status !== 'hosting' || isExpired) return
    const timer = window.setTimeout(() => {
      setIsExpired(true)
      disconnect()
    }, ROOM_CODE_LIFETIME_MS)
    return () => window.clearTimeout(timer)
  }, [view, roomCode, status, isExpired, disconnect])

  // As soon as the connection opens, we send our name (so the other side can
  // greet us). The host additionally broadcasts the match length they picked
  // at the start of the lobby so the joiner has it before any gameplay
  // screen mounts. Then notify the parent so App can advance the screen.
  useEffect(() => {
    if (status !== 'connected') return
    send({ type: 'HELLO', name: playerName })
    if (hostMatchLength !== null) {
      send({ type: 'MATCH_LENGTH', balls: hostMatchLength })
    }
    onConnected(hostMatchLength)
  }, [status, send, playerName, onConnected, hostMatchLength])

  // Menu → match-length picker. The PeerJS peer is NOT created yet — we wait
  // until the host has actually committed to a match length.
  const handleHostStart = () => {
    setView('hostMatchLength')
  }

  // Host picked 6 or 12. Cache the choice, switch to the hosting view, and
  // finally kick off the peer (which generates the room code).
  const handleHostMatchLengthPick = (count: BallsPerInnings) => {
    setHostMatchLength(count)
    setView('hosting')
    void host()
  }

  // Used as the HostingView's "Try again" handler after a broker error.
  // Reuses the already-picked match length, just re-creates the peer.
  const handleHostRetry = () => {
    void host()
  }

  // Switches to the code-input view. Peer isn't created yet — only on submit.
  const handleJoinStart = () => {
    setView('joining')
  }

  // Submits the entered code. Trims and uppercases first so casual input is forgiving.
  const handleJoinSubmit = () => {
    const code = codeInput.trim().toUpperCase()
    if (code.length === 0) return
    void join(code)
  }

  // Bails out of the lobby entirely — destroys the peer and returns to the parent.
  const handleCancel = () => {
    disconnect()
    setView('menu')
    onCancel()
  }

  // Best-effort copy of the room code to the clipboard. Falls back silently
  // on older browsers / when clipboard permissions are denied.
  const handleCopy = () => {
    if (!roomCode || !navigator.clipboard) return
    void navigator.clipboard.writeText(roomCode)
  }

  return (
    <motion.div
      key="multiplayer-lobby-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box sx={{ width: '100%', maxWidth: 480, px: 3, py: 6, textAlign: 'center' }}>
        {view === 'menu' && (
          <MenuView onHost={handleHostStart} onJoinStart={handleJoinStart} onBack={onCancel} />
        )}

        {view === 'hostMatchLength' && (
          <HostMatchLengthView onPick={handleHostMatchLengthPick} onBack={() => setView('menu')} />
        )}

        {view === 'hosting' && !isExpired && (
          <HostingView
            roomCode={roomCode}
            status={status}
            errorMessage={errorMessage}
            matchLength={hostMatchLength}
            onCopy={handleCopy}
            onCancel={handleCancel}
            onRetry={handleHostRetry}
          />
        )}

        {view === 'hosting' && isExpired && (
          <ExpiredView
            onBack={() => {
              setIsExpired(false)
              setView('menu')
              onCancel()
            }}
          />
        )}

        {view === 'joining' && (
          <JoiningView
            code={codeInput}
            onCodeChange={setCodeInput}
            onSubmit={handleJoinSubmit}
            onCancel={handleCancel}
            status={status}
            errorMessage={errorMessage}
          />
        )}
      </Box>
    </motion.div>
  )
}

// Initial choice in the lobby: Host or Join.
function MenuView({
  onHost,
  onJoinStart,
  onBack,
}: {
  onHost: () => void
  onJoinStart: () => void
  onBack: () => void
}) {
  return (
    <Stack spacing={4} alignItems="center">
      <Stack spacing={1} alignItems="center">
        <Typography variant="h4" component="h1" className="title">
          Play vs Friend
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.75 }}>
          Create a room and share the code, or join one with a friend's code.
        </Typography>
      </Stack>
      <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={onHost}
          sx={{ flex: 1, py: 2.5, flexDirection: 'column', gap: 0.5 }}
        >
          <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>Create Room</Typography>
          <Typography sx={{ fontSize: '0.75rem', opacity: 0.8 }}>Get a code to share</Typography>
        </Button>
        <Button
          variant="contained"
          color="secondary"
          size="large"
          onClick={onJoinStart}
          sx={{ flex: 1, py: 2.5, flexDirection: 'column', gap: 0.5 }}
        >
          <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>Join Room</Typography>
          <Typography sx={{ fontSize: '0.75rem', opacity: 0.8 }}>Enter a code</Typography>
        </Button>
      </Stack>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'text.secondary' }}>
        Back to mode selection
      </Button>
    </Stack>
  )
}

// Host's view. Three sub-states reflect the underlying multiplayer status:
//   1. "Reaching the signalling server…" — peer created, waiting for broker
//      to confirm the room code (status: 'hosting', no roomCode yet, no error)
//   2. "Room created" — broker confirmed; show the code + waiting indicator
//      (status: 'hosting' or 'connected' transition, roomCode set)
//   3. "Could not create room" — broker errored; show the message + retry
//      (status: 'error', errorMessage set)
function HostingView({
  roomCode,
  status,
  errorMessage,
  matchLength,
  onCopy,
  onCancel,
  onRetry,
}: {
  roomCode: string | null
  status: string
  errorMessage: string | null
  matchLength: BallsPerInnings | null
  onCopy: () => void
  onCancel: () => void
  onRetry: () => void
}) {
  const isError = status === 'error' && errorMessage !== null
  const isWaitingForBroker = !roomCode && !isError

  let title = 'Creating room…'
  if (isError) title = 'Could not create room'
  else if (roomCode) title = 'Room created'

  return (
    <Stack spacing={3} alignItems="center">
      <Typography variant="h5" component="h1" className="title">
        {title}
      </Typography>

      {roomCode && !isError && (
        <Stack spacing={0.5} alignItems="center">
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            Share this code with your friend so they can join.
          </Typography>
          {matchLength !== null && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {matchLength}-ball match
            </Typography>
          )}
        </Stack>
      )}

      {isWaitingForBroker && (
        <Stack direction="column" spacing={1.5} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            Reaching the signalling server…
          </Typography>
        </Stack>
      )}

      {roomCode && (
        <>
          <Typography variant="h3" sx={{ fontFamily: 'monospace', letterSpacing: '0.2em' }}>
            {roomCode}
          </Typography>
          <Button onClick={onCopy} startIcon={<ContentCopyIcon />} size="small">
            Copy code
          </Button>
        </>
      )}

      {roomCode && !isError && (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2">Waiting for opponent to join…</Typography>
        </Stack>
      )}

      {isError && (
        <Typography color="error" variant="body2" sx={{ textAlign: 'center', maxWidth: 360 }}>
          {errorMessage}
        </Typography>
      )}

      <Stack direction="row" spacing={1}>
        {isError && (
          <Button variant="contained" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  )
}

// Join view: input field for the room code + a Connect button. Disables the
// button while a join is already in flight to prevent double-dialling.
function JoiningView({
  code,
  onCodeChange,
  onSubmit,
  onCancel,
  status,
  errorMessage,
}: {
  code: string
  onCodeChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
  status: string
  errorMessage: string | null
}) {
  const isJoining = status === 'joining'
  return (
    <Stack spacing={3} alignItems="center">
      <Typography variant="h5" component="h1" className="title">
        Join a room
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.75 }}>
        Paste the 6-character code your friend shared with you.
      </Typography>

      <TextField
        autoFocus
        fullWidth
        label="Room code"
        placeholder="e.g. K7M3PQ"
        value={code}
        onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
        }}
        slotProps={{
          htmlInput: {
            maxLength: 6,
            style: {
              fontFamily: 'monospace',
              letterSpacing: '0.3em',
              textAlign: 'center',
              textTransform: 'uppercase',
            },
          },
        }}
      />

      {isJoining && (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2">Connecting…</Typography>
        </Stack>
      )}

      {errorMessage && (
        <Typography color="error" variant="body2">
          {errorMessage}
        </Typography>
      )}

      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={onCancel}>
          Back
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={code.length === 0 || isJoining}>
          Connect
        </Button>
      </Stack>
    </Stack>
  )
}

// Host-only sub-view shown BEFORE the room code is generated. The host
// commits to a match length here; only after they pick does the lobby
// proceed to creating the peer and surfacing the room code. This way the
// "room" has its match length baked in from the moment the code is shared,
// and the joiner doesn't need to wait through a separate length-pick screen
// after connecting.
function HostMatchLengthView({
  onPick,
  onBack,
}: {
  onPick: (count: BallsPerInnings) => void
  onBack: () => void
}) {
  return (
    <Stack spacing={4} alignItems="center">
      <Stack spacing={1} alignItems="center">
        <Typography variant="h4" component="h1" className="title">
          Match length
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.75 }}>
          Pick how many balls per innings before sharing the room code.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => onPick(6)}
          sx={{ flex: 1, py: 2.5, flexDirection: 'column', gap: 0.5 }}
        >
          <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>6 Ball Game</Typography>
          <Typography sx={{ fontSize: '0.78rem', opacity: 0.8 }}>1 over</Typography>
        </Button>
        <Button
          variant="contained"
          color="secondary"
          size="large"
          onClick={() => onPick(12)}
          sx={{ flex: 1, py: 2.5, flexDirection: 'column', gap: 0.5 }}
        >
          <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>12 Ball Game</Typography>
          <Typography sx={{ fontSize: '0.78rem', opacity: 0.8 }}>2 overs</Typography>
        </Button>
      </Stack>

      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'text.secondary' }}>
        Back
      </Button>
    </Stack>
  )
}

// Shown when a generated room code's 5-minute lifetime elapses without
// anyone joining. Tells the host their code is dead and auto-returns to
// mode selection after EXPIRED_AUTO_REDIRECT_MS — same place the Cancel
// button on the hosting screen would have sent them. A "Back to mode
// select" button lets them leave sooner if they want.
function ExpiredView({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onBack, EXPIRED_AUTO_REDIRECT_MS)
    return () => window.clearTimeout(timer)
  }, [onBack])

  return (
    <Stack spacing={3} alignItems="center">
      <Typography variant="h5" component="h1" className="title">
        Code expired
      </Typography>
      <Typography color="error" variant="body1" sx={{ textAlign: 'center', maxWidth: 360 }}>
        The code expired after 5 minutes of wait.
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7 }}>
        Returning to mode selection…
      </Typography>
      <Button variant="contained" onClick={onBack}>
        Back to mode select
      </Button>
    </Stack>
  )
}
