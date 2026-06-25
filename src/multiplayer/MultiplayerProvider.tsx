import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PeerClient } from './peerClient'
import { MultiplayerContext, type MultiplayerStatus } from './useMultiplayer'
import type { MessageHandler, NetworkMessage } from './messages'

// Owns the PeerClient instance and the multiplayer state surface. Translates
// network events (onConnected / onDisconnected / onMessage / onError) into
// React state so screens can render based on `status` / `roomCode` / etc.
export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MultiplayerStatus>('idle')
  const [isHost, setIsHost] = useState(false)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [opponentName, setOpponentName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Refs hold mutable lifetime state that doesn't drive re-renders:
  // the PeerClient instance and the subscriber set for inbound messages.
  const clientRef = useRef<PeerClient | null>(null)
  const subscribersRef = useRef<Set<MessageHandler>>(new Set())

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
    })
    clientRef.current = client
    return client
  }, [])

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
    }),
    [status, isHost, roomCode, opponentName, errorMessage, host, join, send, disconnect, subscribe],
  )

  return <MultiplayerContext.Provider value={value}>{children}</MultiplayerContext.Provider>
}
