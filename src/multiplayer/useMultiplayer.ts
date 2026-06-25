import { createContext, useContext } from 'react'
import type { NetworkMessage } from './messages'

// All the states the multiplayer connection can be in. The UI uses this to
// switch between the menu, the host-waiting screen, the join-input screen,
// and the connected state.
export type MultiplayerStatus = 'idle' | 'hosting' | 'joining' | 'connected' | 'error'

type MultiplayerContextValue = {
  status: MultiplayerStatus
  isHost: boolean
  roomCode: string | null
  opponentName: string | null
  errorMessage: string | null
  // Start hosting a new room. Sets status to 'hosting' and (on success) populates roomCode.
  host: () => Promise<void>
  // Join an existing room by code. Sets status to 'joining'.
  join: (code: string) => Promise<void>
  // Send a typed message to the other peer. No-op when not connected.
  send: (msg: NetworkMessage) => void
  // Tear everything down and return to idle.
  disconnect: () => void
  // Subscribe to incoming network messages. Returns an unsubscribe function.
  subscribe: (handler: (msg: NetworkMessage) => void) => () => void
}

export const MultiplayerContext = createContext<MultiplayerContextValue | null>(null)

// Hook used by lobby/gameplay screens to read connection state, send and
// receive messages, and tear down the room.
export function useMultiplayer(): MultiplayerContextValue {
  const ctx = useContext(MultiplayerContext)
  if (!ctx) {
    throw new Error('useMultiplayer must be used inside <MultiplayerProvider>')
  }
  return ctx
}
