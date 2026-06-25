import { Peer, type DataConnection } from 'peerjs'
import type { NetworkMessage } from './messages'

// Length of the shareable room code. 6 characters from a 31-symbol alphabet
// gives ~887M combinations — collisions are vanishingly rare for casual use
// and the code is short enough to share verbally.
const ROOM_CODE_LENGTH = 6
// Alphabet excludes I, O, 0, 1 to avoid misreads (those characters look alike
// in many fonts when people are dictating a code over the phone).
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// Generates a fresh random room code from the unambiguous alphabet.
function generateRoomCode(): string {
  return Array.from(
    { length: ROOM_CODE_LENGTH },
    () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)],
  ).join('')
}

// Callbacks the React provider attaches when constructing the client.
type Callbacks = {
  onMessage: (msg: NetworkMessage) => void
  onConnected: () => void
  onDisconnected: () => void
  onError: (message: string) => void
}

// Thin wrapper around PeerJS that exposes a host/join/send/destroy surface
// and routes events into the supplied callbacks. No React in this file —
// keeps the network layer testable in isolation.
export class PeerClient {
  private peer: Peer | null = null
  private conn: DataConnection | null = null
  private callbacks: Callbacks

  constructor(callbacks: Callbacks) {
    this.callbacks = callbacks
  }

  // Creates a new PeerJS peer using a generated room code as its ID and
  // resolves with that code once the broker confirms registration. The peer
  // then listens for an incoming connection from the joiner.
  async host(): Promise<string> {
    const code = generateRoomCode()
    console.log('[multiplayer] host: creating peer with code', code)
    this.peer = new Peer(code)
    return new Promise((resolve, reject) => {
      const failTimer = window.setTimeout(() => {
        console.warn('[multiplayer] host: timed out waiting for broker')
        reject(new Error('Timed out reaching the signalling server'))
      }, 15000)

      this.peer!.on('open', (id) => {
        console.log('[multiplayer] host: registered with broker, id =', id)
        window.clearTimeout(failTimer)
        resolve(id)
      })
      this.peer!.on('connection', (conn) => {
        console.log('[multiplayer] host: incoming connection from', conn.peer)
        this.attachConnection(conn)
      })
      this.peer!.on('error', (err) => {
        console.error('[multiplayer] host: PeerJS error', err)
        window.clearTimeout(failTimer)
        const message = this.describeError(err)
        this.callbacks.onError(message)
        // Reject the promise too so the React provider can surface the error
        // in the lobby UI immediately instead of sitting on the spinner until
        // the 15-second timeout fires.
        reject(new Error(message))
      })
    })
  }

  // Creates a peer with a random ID and dials the host's room code. Resolves
  // once the dial returns; the actual "open" event fires later on the
  // resulting DataConnection (and we route that into onConnected).
  async join(roomCode: string): Promise<void> {
    console.log('[multiplayer] join: dialling room', roomCode)
    this.peer = new Peer()
    return new Promise((resolve, reject) => {
      const failTimer = window.setTimeout(() => {
        console.warn('[multiplayer] join: timed out waiting for broker')
        reject(new Error('Timed out connecting to the room'))
      }, 15000)

      this.peer!.on('open', (id) => {
        console.log('[multiplayer] join: registered as', id, 'now connecting to host')
        const conn = this.peer!.connect(roomCode, { reliable: true })
        this.attachConnection(conn)
        window.clearTimeout(failTimer)
        resolve()
      })
      this.peer!.on('error', (err) => {
        console.error('[multiplayer] join: PeerJS error', err)
        window.clearTimeout(failTimer)
        const message = this.describeError(err)
        this.callbacks.onError(message)
        reject(new Error(message))
      })
    })
  }

  // Wires up the DataConnection's events to our callbacks. The connection
  // open / data / close / error events are how the rest of the app finds
  // out what the network is doing.
  private attachConnection(conn: DataConnection): void {
    this.conn = conn
    conn.on('open', () => this.callbacks.onConnected())
    conn.on('data', (data) => {
      // Defensive: only forward objects that look like our protocol shape.
      // Anything else gets dropped so a malformed packet can't crash the app.
      if (data && typeof data === 'object' && 'type' in (data as object)) {
        this.callbacks.onMessage(data as NetworkMessage)
      }
    })
    conn.on('close', () => this.callbacks.onDisconnected())
    conn.on('error', (err) => this.callbacks.onError(this.describeError(err)))
  }

  // Sends a typed message to the other peer. No-op when not connected so
  // callers don't need to guard every call site.
  send(msg: NetworkMessage): void {
    if (this.conn?.open) {
      this.conn.send(msg)
    }
  }

  // Tears everything down. Safe to call multiple times.
  destroy(): void {
    try {
      this.conn?.close()
    } catch {
      // ignore
    }
    try {
      this.peer?.destroy()
    } catch {
      // ignore
    }
    this.conn = null
    this.peer = null
  }

  // Maps PeerJS error types to friendly messages. PeerJS's `err` is a plain
  // object with `type` and `message` — we pick the cases worth explaining
  // and fall back to its message otherwise.
  private describeError(err: unknown): string {
    const e = err as { type?: string; message?: string }
    if (e.type === 'unavailable-id') {
      return 'Room code already in use — try creating again.'
    }
    if (e.type === 'peer-unavailable') {
      return 'No room found with that code.'
    }
    if (e.type === 'network') {
      return 'Network error — check your internet connection.'
    }
    if (e.type === 'browser-incompatible') {
      return "Your browser doesn't support multiplayer."
    }
    if (e.type === 'disconnected') {
      return 'Disconnected from the signalling server.'
    }
    return e.message ?? 'Multiplayer connection failed.'
  }
}
