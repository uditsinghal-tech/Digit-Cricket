import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { StadiumModeContext, type StadiumMode } from './useStadiumMode'

const STORAGE_KEY = 'digit-cricket:stadium-mode'

// Reads the saved mode from localStorage; defaults to 'night' if missing or unreadable.
function readInitialMode(): StadiumMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'day' || saved === 'night') return saved
  } catch {
    // ignore (private browsing, full storage, etc.)
  }
  return 'night'
}

// Owns the current StadiumMode, persists it to localStorage, and exposes a
// toggle that flips between 'day' and 'night'.
export function StadiumModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<StadiumMode>(readInitialMode)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // ignore
    }
  }, [mode])

  // Flips between 'day' and 'night'. Persistence happens in the effect above.
  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'day' ? 'night' : 'day'))
  }, [])

  const value = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode])
  return <StadiumModeContext.Provider value={value}>{children}</StadiumModeContext.Provider>
}
