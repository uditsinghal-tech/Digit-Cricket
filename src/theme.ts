import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#38bdf8' },
    secondary: { main: '#a855f7' },
    background: {
      default: '#050810',
      paper: '#0f172a',
    },
  },
  typography: {
    fontFamily:
      "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h1: { fontWeight: 700, letterSpacing: '0.02em' },
    h2: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    // The default selected tab is a faint tint with light-blue text, too subtle to
    // spot. Solid fill makes the active tab obvious.
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: 'rgba(248, 250, 252, 0.85)',
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: '#38bdf8',
            color: '#0b1220',
          },
        },
      },
    },
  },
})

export default theme
