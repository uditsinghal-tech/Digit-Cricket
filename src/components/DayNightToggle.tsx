import IconButton from '@mui/material/IconButton'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useStadiumMode } from '../stadium/useStadiumMode'

// Fixed icon button (left of the MuteToggle) that flips the stadium between
// night and day. Sun glyph means "you're in night, click to go bright";
// moon glyph means "you're in day, click to go dark".
export default function DayNightToggle() {
  const { mode, toggleMode } = useStadiumMode()
  const isDay = mode === 'day'
  return (
    <IconButton
      onClick={toggleMode}
      aria-label={isDay ? 'Switch to night mode' : 'Switch to day mode'}
      sx={{
        position: 'fixed',
        top: 12,
        right: 60,
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
      {isDay ? <DarkModeIcon /> : <WbSunnyIcon />}
    </IconButton>
  )
}
