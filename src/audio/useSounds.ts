import { createContext, useContext } from 'react'
import type { SoundName } from './sounds'

export type SoundContextValue = {
  muted: boolean
  toggleMute: () => void
  play: (name: SoundName) => void
}

export const SoundContext = createContext<SoundContextValue | null>(null)

// Hook used anywhere in the tree to play sounds or toggle the global mute state.
export function useSounds(): SoundContextValue {
  const ctx = useContext(SoundContext)
  if (!ctx) {
    throw new Error('useSounds must be used inside <SoundProvider>')
  }
  return ctx
}
