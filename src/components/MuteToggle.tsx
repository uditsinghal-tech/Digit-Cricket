import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import { useSounds } from '../audio/useSounds'

// Fixed top-right icon button that toggles the global mute state. Mounted
// once at the app root so it's reachable on every screen.
export default function MuteToggle() {
  const { muted, toggleMute } = useSounds()
  return (
    <Tooltip title={muted ? 'Unmute sound' : 'Mute sound'} arrow>
    <IconButton
      onClick={toggleMute}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      sx={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 10,
        color: 'rgba(248, 250, 252, 0.78)',
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        '&:hover': {
          color: '#f8fafc',
          background: 'rgba(15, 23, 42, 0.8)',
        },
      }}
    >
      {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
    </IconButton>
    </Tooltip>
  )
}
