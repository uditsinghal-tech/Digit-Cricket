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

type Props = {
  playerName: string
  onCancel: () => void
  onConnected: () => void
}

// Local view state on top of the global multiplayer status. The lobby shows
// one of three sub-views (menu / hosting / joining) based on user choice.
type LobbyView = 'menu' | 'hosting' | 'joining'

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// Multiplayer lobby. Either creates a new room (Host: generates a 6-char
// code, waits for an opponent to join) or joins an existing one (Join:
// takes a code and dials it). Once the peer is connected, App.tsx
// notices via the multiplayer status and advances the screen.
export default function MultiplayerLobbyScreen({ playerName, onCancel, onConnected }: Props) {
  const { status, roomCode, errorMessage, host, join, disconnect, send } = useMultiplayer()
  const [view, setView] = useState<LobbyView>('menu')
  const [codeInput, setCodeInput] = useState('')

  // As soon as the connection opens, we send our name (so the other side can
  // greet us) and notify the parent so it can navigate to the connected screen.
  // Future Parts will piggy-back more handshake info onto HELLO.
  useEffect(() => {
    if (status === 'connected') {
      send({ type: 'HELLO', name: playerName })
      onConnected()
    }
  }, [status, send, playerName, onConnected])

  // Switches to the "hosting" view and kicks off the peer.
  const handleHost = () => {
    setView('hosting')
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
          <MenuView onHost={handleHost} onJoinStart={handleJoinStart} onBack={onCancel} />
        )}

        {view === 'hosting' && (
          <HostingView
            roomCode={roomCode}
            status={status}
            errorMessage={errorMessage}
            onCopy={handleCopy}
            onCancel={handleCancel}
            onRetry={handleHost}
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
  onCopy,
  onCancel,
  onRetry,
}: {
  roomCode: string | null
  status: string
  errorMessage: string | null
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
        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          Share this code with your friend so they can join.
        </Typography>
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
