import { createContext, useContext } from 'react'

// The set of game events that the stadium visually reacts to. Matches the
// audio SoundName union one-to-one, deliberately, so screens can fire the
// same name into both subsystems.
export type StadiumReaction = 'four' | 'six' | 'wicket' | 'win' | 'lose'

export type StadiumReactionContextValue = {
  reaction: StadiumReaction | null
  triggerReaction: (kind: StadiumReaction) => void
}

export const StadiumReactionContext = createContext<StadiumReactionContextValue | null>(null)

// Hook used by the stadium SVG (consumer) and the screens (producers) to
// share a single "current crowd reaction" value.
export function useStadiumReaction(): StadiumReactionContextValue {
  const ctx = useContext(StadiumReactionContext)
  if (!ctx) {
    throw new Error('useStadiumReaction must be used inside <StadiumReactionProvider>')
  }
  return ctx
}
