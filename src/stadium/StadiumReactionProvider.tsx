import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { StadiumReactionContext, type StadiumReaction } from './useStadiumReaction'

// How long a reaction stays "active" before the crowd settles back to idle.
// Long enough for the keyframe animation to finish, short enough that two
// quick events don't visually queue.
const REACTION_DURATION_MS = 1800

// Owns the current reaction value and auto-clears it after the animation
// window, so the stadium goes back to its idle palette without anyone having
// to explicitly call `triggerReaction(null)`.
export function StadiumReactionProvider({ children }: { children: ReactNode }) {
  const [reaction, setReaction] = useState<StadiumReaction | null>(null)
  const timerRef = useRef<number | null>(null)

  // Sets the active reaction and (re)starts the auto-clear timer. If a new
  // reaction fires while one is still active, the old timer is cancelled and
  // the latest event wins.
  const triggerReaction = useCallback((kind: StadiumReaction) => {
    setReaction(kind)
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      setReaction(null)
      timerRef.current = null
    }, REACTION_DURATION_MS)
  }, [])

  // Unmount cleanup — clears any pending auto-clear timer so we don't run a
  // setReaction call against an unmounted provider during teardown.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  const value = useMemo(() => ({ reaction, triggerReaction }), [reaction, triggerReaction])

  return <StadiumReactionContext.Provider value={value}>{children}</StadiumReactionContext.Provider>
}
