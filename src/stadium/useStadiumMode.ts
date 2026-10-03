import { createContext, useContext } from 'react'

// Day / Night toggle for the stadium scene.
export type StadiumMode = 'day' | 'night'

type StadiumModeContextValue = {
  mode: StadiumMode
  toggleMode: () => void
}

export const StadiumModeContext = createContext<StadiumModeContextValue | null>(null)

// Hook used by the DayNightToggle button (writer) and StadiumBackground (reader)
// to share the current mode.
export function useStadiumMode(): StadiumModeContextValue {
  const ctx = useContext(StadiumModeContext)
  if (!ctx) {
    throw new Error('useStadiumMode must be used inside <StadiumModeProvider>')
  }
  return ctx
}
