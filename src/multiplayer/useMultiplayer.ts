import { createContext, useContext } from 'react'
import type { NetworkMessage } from './messages'

// All the states the multiplayer connection can be in. The UI uses this to
// switch between the menu, the host-waiting screen, the join-input screen,
// and the connected state.
export type MultiplayerStatus = 'idle' | 'hosting' | 'joining' | 'connected' | 'error'

// Voice-call lifecycle states. All UI for the in-match call (call
// button, incoming notification, active controls) reads off this.
//   'idle'       — no call in flight; the Call button is what shows.
//   'connecting' — the local side dialled and is waiting for the remote
//                  side to answer; "Calling…" hint with Cancel.
//   'incoming'   — the local side is being called and hasn't accepted
//                  yet; "X is calling — Accept / Decline".
//   'active'     — two-way audio live; mute toggle + End call.
export type VoiceCallStatus = 'idle' | 'connecting' | 'incoming' | 'active'

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
  // Voice-call surface. Drives the gameplay-screen call UI.
  voiceStatus: VoiceCallStatus
  isMuted: boolean
  // Tells the caller whether voice is even an option in this browser
  // (HTTPS / localhost + getUserMedia available). Hides the Call button
  // gracefully when false rather than throwing on click.
  voiceSupported: boolean
  // If the mic / call setup failed, the reason is surfaced here so the
  // UI can render it as a one-liner under the Call button.
  voiceError: string | null
  // Start an outbound call. Triggers the browser mic prompt synchronously
  // — must be called from a user-gesture handler (button click).
  startCall: () => Promise<void>
  // Accept the inbound call. Same mic-prompt rule as startCall.
  acceptCall: () => Promise<void>
  // Decline an inbound call without granting mic access.
  rejectCall: () => void
  // Hang up an active call (either side). Stops the mic and tears down
  // the MediaConnection — leaves the data connection (picks etc.) alone.
  endCall: () => void
  // Toggle local mute. Keeps the call connected; just disables the
  // outbound audio track so the remote side hears silence.
  toggleMute: () => void
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
