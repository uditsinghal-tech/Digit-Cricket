import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App.tsx'
import theme from './theme.ts'
import { SoundProvider } from './audio/SoundProvider'
import { StadiumReactionProvider } from './stadium/StadiumReactionProvider'
import { StadiumModeProvider } from './stadium/StadiumModeProvider'
import { MultiplayerProvider } from './multiplayer/MultiplayerProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SoundProvider>
        <StadiumModeProvider>
          <StadiumReactionProvider>
            <MultiplayerProvider>
              <App />
            </MultiplayerProvider>
          </StadiumReactionProvider>
        </StadiumModeProvider>
      </SoundProvider>
    </ThemeProvider>
  </StrictMode>,
)
