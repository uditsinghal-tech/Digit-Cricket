import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PeerClient } from './peerClient'
import {
  MultiplayerContext,
  type MultiplayerStatus,
  type VoiceCallStatus,
} from './useMultiplayer'
import type { MessageHandler, NetworkMessage } from './messages'

// True iff the runtime supports WebRTC voice. `getUserMedia` is only
// exposed by browsers on secure origins (HTTPS or localhost). Computed
// once at module load — the answer never changes during a session.
const VOICE_SUPPORTED =
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices !== 'undefined' &&
  typeof navigator.mediaDevices.getUserMedia === 'function'

// Owns the PeerClient instance and the multiplayer state surface. Translates
// network events (onConnected / onDisconnected / onMessage / onError) into
// React state so screens can render based on `status` / `roomCode` / etc.
export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MultiplayerStatus>('idle')
  const [isHost, setIsHost] = useState(false)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [opponentName, setOpponentName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Voice-call state. All four pieces transition together as the call
  // lifecycle moves: idle → connecting/incoming → active → idle.
  const [voiceStatus, setVoiceStatus] = useState<VoiceCallStatus>('idle')
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  // Refs hold mutable lifetime state that doesn't drive re-renders:
  // the PeerClient instance and the subscriber set for inbound messages.
  const clientRef = useRef<PeerClient | null>(null)
  const subscribersRef = useRef<Set<MessageHandler>>(new Set())
  // Hidden <audio> element that plays the remote MediaStream once a
  // call is active. Rendered at the bottom of this provider so the audio
  // survives any screen re-mount.
  const audioRef = useRef<HTMLAudioElement>(null)

  // Lazily creates the underlying PeerClient and wires its callbacks into
  // the React state setters above. Idempotent — subsequent calls return the
  // existing instance.
  const ensureClient = useCallback((): PeerClient => {
    if (clientRef.current) return clientRef.current
    const client = new PeerClient({
      onMessage: (msg) => {
        // HELLO is special: it carries the opponent's display name and we
        // pull it out into its own state slot. Every other message is just
        // fanned out to subscribers.
        if (msg.type === 'HELLO') {
          setOpponentName(msg.name)
        }
        subscribersRef.current.forEach((handler) => handler(msg))
      },
      onConnected: () => {
        setStatus('connected')
        setErrorMessage(null)
      },
      onDisconnected: () => {
        setStatus('idle')
        setOpponentName(null)
      },
      onError: (message) => {
        setStatus('error')
        setErrorMessage(message)
      },
      // Voice-call callbacks. Each one flips one or two pieces of voice
      // state — the React render then drives the gameplay-screen UI.
      onIncomingCall: () => {
        setVoiceStatus('incoming')
        setVoiceError(null)
      },
      onRemoteStream: (stream) => {
        setRemoteStream(stream)
        setVoiceStatus('active')
      },
      onCallEnded: () => {
        setVoiceStatus('idle')
        setRemoteStream(null)
        setIsMuted(false)
      },
    })
    clientRef.current = client
    return client
  }, [])

  // Whenever the remote MediaStream changes, point the hidden <audio> at
  // it (or clear it). srcObject can't be set via JSX so this effect is
  // the standard pattern for piping a MediaStream to an <audio> element.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // Starts hosting a new room. Status flips to 'hosting' immediately so the
  // UI can show a "creating room…" state; roomCode populates when the broker
  // confirms our peer ID.
  const host = useCallback(async () => {
    setStatus('hosting')
    setIsHost(true)
    setErrorMessage(null)
    setRoomCode(null)
    const client = ensureClient()
    try {
      const code = await client.host()
      setRoomCode(code)
    } catch (e) {
      setStatus('error')
      setErrorMessage((e as Error).message)
    }
  }, [ensureClient])

  // Joins an existing room by code. Status flips to 'joining'; on success
  // the underlying connection's open event will bump status to 'connected'.
  const join = useCallback(
    async (code: string) => {
      setStatus('joining')
      setIsHost(false)
      setErrorMessage(null)
      setRoomCode(code)
      const client = ensureClient()
      try {
        await client.join(code)
      } catch (e) {
        setStatus('error')
        setErrorMessage((e as Error).message)
      }
    },
    [ensureClient],
  )

  // Sends a typed network message to the other peer. No-op if not connected.
  const send = useCallback((msg: NetworkMessage) => {
    clientRef.current?.send(msg)
  }, [])

  // Tears down the peer + connection, resets all state to idle. Safe to
  // call multiple times.
  const disconnect = useCallback(() => {
    clientRef.current?.destroy()
    clientRef.current = null
    subscribersRef.current.clear()
    setStatus('idle')
    setIsHost(false)
    setRoomCode(null)
    setOpponentName(null)
    setErrorMessage(null)
  }, [])

  // Registers a callback for inbound network messages. Returns an
  // unsubscribe function so consumers can clean up in their useEffect
  // teardown.
  const subscribe = useCallback((handler: MessageHandler) => {
    subscribersRef.current.add(handler)
    return () => {
      subscribersRef.current.delete(handler)
    }
  }, [])

  // --- Voice-call surface ---
  // Each method maps to a PeerClient call and flips the React voice
  // state in sync. Any browser-thrown error (mic denied, no peer, etc.)
  // surfaces as `voiceError` and reverts the status to idle.

  // Caller side: ask for the mic and dial the other peer. Must be
  // invoked from a user-click handler — the browser requires a user
  // gesture for getUserMedia.
  const startCall = useCallback(async () => {
    if (!VOICE_SUPPORTED || !clientRef.current) return
    setVoiceError(null)
    setVoiceStatus('connecting')
    try {
      await clientRef.current.startCall()
    } catch (e) {
      setVoiceError(describeMediaError(e))
      setVoiceStatus('idle')
    }
  }, [])

  // Callee side: accept the inbound call. Same mic-gesture rule.
  const acceptCall = useCallback(async () => {
    if (!VOICE_SUPPORTED || !clientRef.current) return
    setVoiceError(null)
    setVoiceStatus('connecting')
    try {
      await clientRef.current.acceptCall()
    } catch (e) {
      setVoiceError(describeMediaError(e))
      setVoiceStatus('idle')
    }
  }, [])

  // Callee side: decline. No mic prompt — just closes the inbound
  // MediaConnection so the caller knows immediately.
  const rejectCall = useCallback(() => {
    clientRef.current?.rejectCall()
    setVoiceStatus('idle')
  }, [])

  // End the active call from either side. Safe to call when idle.
  const endCall = useCallback(() => {
    clientRef.current?.endCall()
  }, [])

  // Toggle mute. The call stays connected; only the outbound audio
  // track flips so the remote side hears silence.
  const toggleMute = useCallback(() => {
    setIsMuted((muted) => {
      const next = !muted
      clientRef.current?.setMuted(next)
      return next
    })
  }, [])

  // Final cleanup on unmount — kills the peer so it doesn't leak open
  // connections to the broker.
  useEffect(() => {
    return () => {
      clientRef.current?.destroy()
    }
  }, [])

  const value = useMemo(
    () => ({
      status,
      isHost,
      roomCode,
      opponentName,
      errorMessage,
      host,
      join,
      send,
      disconnect,
      subscribe,
      voiceStatus,
      isMuted,
      voiceSupported: VOICE_SUPPORTED,
      voiceError,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
    }),
    [
      status,
      isHost,
      roomCode,
      opponentName,
      errorMessage,
      host,
      join,
      send,
      disconnect,
      subscribe,
      voiceStatus,
      isMuted,
      voiceError,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
    ],
  )

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
      {/* Hidden audio sink for the remote MediaStream during a call. */}
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
    </MultiplayerContext.Provider>
  )
}

// Turns a getUserMedia / MediaConnection error into a short, friendly
// string the UI can render under the Call button. The default fallback
// is the raw message so we never silently swallow a useful detail.
function describeMediaError(err: unknown): string {
  const e = err as { name?: string; message?: string }
  if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
    return 'Microphone permission was blocked. Allow it in the browser and try again.'
  }
  if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
    return 'No microphone found on this device.'
  }
  if (e.name === 'NotReadableError') {
    return 'Microphone is busy in another app. Close it and try again.'
  }
  return e.message ?? 'Voice call failed to start.'
}
