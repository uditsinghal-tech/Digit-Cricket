import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { playSound, setMasterMuted, startCrowd, type SoundName } from './sounds'
import { SoundContext } from './useSounds'

const STORAGE_KEY = 'digit-cricket:muted'

// Reads the saved mute state from localStorage; defaults to false if missing or unreadable.
function readInitialMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

// Owns the global mute state, persists it to localStorage, starts the crowd
// ambience on the first user gesture, and exposes a `play()` helper.
export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState<boolean>(readInitialMuted)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(muted))
    } catch {
      // ignore (private browsing, full storage, etc.)
    }
  }, [muted])

  // Kicks off the crowd murmur once we know there's been a user gesture
  // (the AudioContext autoplay policy needs that). One-shot listeners on
  // pointer/key/touch handle the very first interaction; later toggles run
  // synchronously because the context is already alive.
  useEffect(() => {
    if (muted) {
      setMasterMuted(true)
      return
    }
    setMasterMuted(false)
    try {
      startCrowd()
    } catch {
      // ignore — startCrowd is idempotent and retries on the next interaction
    }
    // Fires once on the first user interaction. The earlier in-render call
    // to startCrowd() may have been rejected by the browser's autoplay policy;
    // running again inside a real gesture lets it succeed.
    const begin = () => {
      try {
        startCrowd()
        setMasterMuted(false)
      } catch {
        // ignore
      }
    }
    document.addEventListener('pointerdown', begin, { once: true })
    document.addEventListener('keydown', begin, { once: true })
    document.addEventListener('touchstart', begin, { once: true })
    return () => {
      document.removeEventListener('pointerdown', begin)
      document.removeEventListener('keydown', begin)
      document.removeEventListener('touchstart', begin)
    }
  }, [muted])

  // Flips the mute flag. Persistence and the master-gain ramp are handled
  // by the two effects above.
  const toggleMute = useCallback(() => {
    setMuted((m) => !m)
  }, [])

  // Plays a sound by name. No-op when muted. Errors are swallowed so audio
  // never breaks gameplay (most often a pre-gesture AudioContext error).
  const play = useCallback(
    (name: SoundName) => {
      if (muted) return
      try {
        playSound(name)
      } catch {
        // ignore — audio is non-essential
      }
    },
    [muted],
  )

  const value = useMemo(() => ({ muted, toggleMute, play }), [muted, toggleMute, play])

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}
