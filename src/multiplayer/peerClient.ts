import { Peer, type DataConnection, type MediaConnection } from 'peerjs'
import type { NetworkMessage } from './messages'

// Length of the shareable room code. 6 characters from a 31-symbol alphabet
// gives ~887M combinations — collisions are vanishingly rare for casual use
// and the code is short enough to share verbally.
const ROOM_CODE_LENGTH = 6
// Alphabet excludes I, O, 0, 1 to avoid misreads (those characters look alike
// in many fonts when people are dictating a code over the phone).
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// How long the joiner waits for the host's DataConnection to open after the
// broker registration succeeds. PeerJS doesn't always emit `peer-unavailable`
// promptly (or at all) for an invalid host ID, so without this watchdog the
// UI sits on the "Connecting…" spinner forever. ~8s is plenty of slack for
// a real round-trip and short enough to feel responsive on a wrong code.
const JOIN_CONN_TIMEOUT_MS = 8000

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
  // Voice-call callbacks. The React provider uses these to drive a small
  // call UI (incoming-call notification, remote-audio playback, end-call
  // teardown). The data layer never touches the DOM directly.
  onIncomingCall: () => void
  onRemoteStream: (stream: MediaStream) => void
  onCallEnded: () => void
}

// Thin wrapper around PeerJS that exposes a host/join/send/destroy surface
// and routes events into the supplied callbacks. No React in this file —
// keeps the network layer testable in isolation.
export class PeerClient {
  private peer: Peer | null = null
  private conn: DataConnection | null = null
  private callbacks: Callbacks
  // The MediaConnection for an inbound call waiting to be accepted. Held
  // here so the React side can pop a "X is calling you" UI and decide
  // whether to grab the mic and answer.
  private pendingIncomingCall: MediaConnection | null = null
  // The MediaConnection for the currently-active two-way audio call.
  private activeCall: MediaConnection | null = null
  // The local mic stream once we've grabbed it. Held so we can stop its
  // tracks on hang-up (which kills the OS-level mic-active indicator).
  private localStream: MediaStream | null = null

  constructor(callbacks: Callbacks) {
    this.callbacks = callbacks
  }

  // Creates a new PeerJS peer using a generated room code as its ID and
  // resolves with that code once the broker confirms registration. The peer
  // then listens for an incoming connection from the joiner.
  async host(): Promise<string> {
    // Clean up any stale peer from a previous attempt so retries don't leak
    // handlers / connections.
    this.cleanupPeer()
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
      this.attachCallListener(this.peer!)
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

  // Creates a peer with a random ID and dials the host's room code. The
  // promise resolves only once the DataConnection to the host actually opens
  // — not just when our own broker registration completes. If the host code
  // is wrong (or the host has vanished), neither `conn.on('open')` nor
  // `peer.on('error')` may fire promptly, so we watchdog the dial with a
  // JOIN_CONN_TIMEOUT_MS timer and surface a "wrong code" error to the UI.
  async join(roomCode: string): Promise<void> {
    // Clean up any stale peer from a previous (failed) attempt so retries
    // get a fresh start — old handlers + connections gone.
    this.cleanupPeer()
    console.log('[multiplayer] join: dialling room', roomCode)
    this.peer = new Peer()
    return new Promise((resolve, reject) => {
      // Single-shot guards so timer + open + error paths can't fire
      // resolve/reject more than once.
      let settled = false
      const finishOk = () => {
        if (settled) return
        settled = true
        resolve()
      }
      const finishErr = (message: string) => {
        if (settled) return
        settled = true
        // Destroy the peer so any late PeerJS error events don't overwrite
        // the message we're about to surface, or fire callbacks after the
        // user has already retried with a fresh code.
        this.cleanupPeer()
        this.callbacks.onError(message)
        reject(new Error(message))
      }

      // Outer timer: broker registration itself failing (network down etc).
      const brokerTimer = window.setTimeout(() => {
        console.warn('[multiplayer] join: timed out reaching broker')
        finishErr('Timed out connecting to the room')
      }, 15000)

      this.peer!.on('open', (id) => {
        console.log('[multiplayer] join: registered as', id, 'now connecting to host')
        window.clearTimeout(brokerTimer)
        const conn = this.peer!.connect(roomCode, { reliable: true })
        this.attachConnection(conn)
        this.attachCallListener(this.peer!)

        // Inner timer: from peer.connect() until conn.on('open') fires.
        // Expires if the host code is wrong or the host isn't reachable.
        const connTimer = window.setTimeout(() => {
          console.warn('[multiplayer] join: conn open timed out — likely wrong code')
          finishErr('Wrong code entered — no room found with that code.')
        }, JOIN_CONN_TIMEOUT_MS)

        // Resolve when the connection actually opens (attachConnection also
        // calls onConnected on the same event — this listener just signals
        // the promise side that the dial succeeded).
        conn.on('open', () => {
          window.clearTimeout(connTimer)
          finishOk()
        })
      })

      this.peer!.on('error', (err) => {
        console.error('[multiplayer] join: PeerJS error', err)
        window.clearTimeout(brokerTimer)
        finishErr(this.describeError(err))
      })
    })
  }

  // Destroys the current peer + connection if any. Used at the start of
  // host() / join() so a retry after an error starts from a clean slate.
  private cleanupPeer(): void {
    // Any active voice call goes with the peer — stop its tracks, close
    // the MediaConnection, and clear local refs so we don't leak a hot
    // microphone after the peer is destroyed.
    this.endCall()
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

  // Subscribes once-per-peer to inbound voice calls from the other side.
  // We don't auto-answer — we stash the MediaConnection and notify the
  // React layer so a user-facing UI can confirm before granting mic
  // access. That keeps the mic-permission prompt tied to a real user
  // click, never a silent auto-grant.
  private attachCallListener(peer: Peer): void {
    peer.on('call', (call) => {
      console.log('[multiplayer] incoming voice call from', call.peer)
      this.pendingIncomingCall = call
      this.callbacks.onIncomingCall()
    })
  }

  // Wires the active MediaConnection's events into our callbacks. Used by
  // both the caller side (after peer.call) and the callee side (after
  // call.answer) so the remote-stream / close / error handling is the
  // same in both directions.
  private attachCall(call: MediaConnection): void {
    this.activeCall = call
    call.on('stream', (remote) => {
      console.log('[multiplayer] voice: remote stream received')
      this.callbacks.onRemoteStream(remote)
    })
    call.on('close', () => {
      console.log('[multiplayer] voice: call closed by peer')
      this.endCall()
    })
    call.on('error', (err) => {
      console.error('[multiplayer] voice: call error', err)
      this.callbacks.onError(this.describeError(err))
      this.endCall()
    })
  }

  // Caller path. Grabs the local mic (browser prompts the user if needed),
  // dials the other peer with the resulting MediaStream, and wires up the
  // remote-audio handler. Throws if the user denies mic permission or
  // the data connection isn't open yet (no peer to call).
  async startCall(): Promise<void> {
    if (this.activeCall) return
    const otherId = this.conn?.peer
    if (!this.peer || !otherId) {
      throw new Error('Not connected to a peer yet — cannot start a call.')
    }
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const call = this.peer.call(otherId, this.localStream)
    this.attachCall(call)
  }

  // Callee path. Grabs the local mic and answers the pending inbound call
  // with the resulting stream so the audio is two-way. Mic permission is
  // requested HERE — bound to the user's Accept click, never auto-granted.
  async acceptCall(): Promise<void> {
    if (!this.pendingIncomingCall) return
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.pendingIncomingCall.answer(this.localStream)
    this.attachCall(this.pendingIncomingCall)
    this.pendingIncomingCall = null
  }

  // Callee path: refuse an incoming call before the mic prompt. Closes
  // the MediaConnection so the caller side hears a hang-up immediately.
  rejectCall(): void {
    try {
      this.pendingIncomingCall?.close()
    } catch {
      // ignore
    }
    this.pendingIncomingCall = null
    this.callbacks.onCallEnded()
  }

  // Hang up the active call from either side. Stops the local mic tracks
  // so the browser's mic-active indicator clears, closes the
  // MediaConnection, and notifies the React layer to drop UI state.
  endCall(): void {
    try {
      this.activeCall?.close()
    } catch {
      // ignore
    }
    this.activeCall = null
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop())
      this.localStream = null
    }
    if (this.pendingIncomingCall) {
      try {
        this.pendingIncomingCall.close()
      } catch {
        // ignore
      }
      this.pendingIncomingCall = null
    }
    this.callbacks.onCallEnded()
  }

  // Enables / disables the local audio track in place. Cheaper than
  // re-acquiring the mic, and keeps the call connected so the remote
  // side sees a clean mute, not a hang-up.
  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted
    })
  }

  // True iff a voice call is live. Used by the React layer to gate the
  // "End call" button without having to expose the MediaConnection itself.
  isCallActive(): boolean {
    return this.activeCall !== null
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
    this.cleanupPeer()
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
