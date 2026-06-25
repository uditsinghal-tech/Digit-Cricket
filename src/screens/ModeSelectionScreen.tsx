import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import GroupsIcon from '@mui/icons-material/Groups'
import { motion, type Variants } from 'framer-motion'
import type { GameMode } from '../game/types'

type Props = {
  playerName: string
  onSelect: (mode: GameMode) => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// Lets the player choose between singleplayer (vs computer) and multiplayer
// (vs a friend over WebRTC/PeerJS). Sits between PlayerNameScreen and either
// MatchLengthScreen (singleplayer) or MultiplayerLobbyScreen (multiplayer).
export default function ModeSelectionScreen({ playerName, onSelect }: Props) {
  return (
    <motion.div
      key="mode-selection-screen"
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
              Choose your match
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.75 }}>
              Hi {playerName} — who do you want to play against?
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
            <ModeButton
              mode="singleplayer"
              label="Play vs Computer"
              sub="Quick match"
              icon={<SmartToyIcon sx={{ fontSize: 36 }} />}
              onClick={onSelect}
            />
            <ModeButton
              mode="multiplayer"
              label="Play vs Friend"
              sub="Share a room code"
              icon={<GroupsIcon sx={{ fontSize: 36 }} />}
              onClick={onSelect}
            />
          </Stack>
        </Stack>
      </Box>
    </motion.div>
  )
}

// Tile button for a game-mode choice. Icon stacked above the label and sub-label.
// Colour-keyed (primary for singleplayer, secondary for multiplayer) so the two
// read as distinct paths through the rest of the app.
function ModeButton({
  mode,
  label,
  sub,
  icon,
  onClick,
}: {
  mode: GameMode
  label: string
  sub: string
  icon: React.ReactNode
  onClick: (mode: GameMode) => void
}) {
  const isSingle = mode === 'singleplayer'
  return (
    <Button
      variant="contained"
      color={isSingle ? 'primary' : 'secondary'}
      size="large"
      onClick={() => onClick(mode)}
      sx={{
        flex: 1,
        py: 2.5,
        flexDirection: 'column',
        gap: 0.75,
      }}
    >
      {icon}
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.75rem', opacity: 0.8 }}>{sub}</Typography>
    </Button>
  )
}
