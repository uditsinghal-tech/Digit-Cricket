# Digit Cricket — Multiplayer Build

This file documents the **multiplayer** chapter of the project — adding peer-to-peer play on top of the singleplayer game shipped in `singleplayer.md` / `doc.md`.

The reader should be able to follow this from end to end and understand:
- What we're building and why.
- The architecture choices (and the tradeoffs each one buys).
- Every step taken, every command run, every file changed.
- How to test what's in place today.

---

## 1. The goal

Two real humans playing Digit Cricket against each other, in their own browsers, anywhere in the world — **without a backend server we have to host**.

In cricket terms:
- Both players enter a name.
- One player **creates a room** and gets a short code.
- The other player **joins with that code**.
- They play the existing match flow (length pick → toss → bat/bowl → 6 or 12 ball innings → result) with picks exchanged over the network.
- Disconnect or finish → either can return to the start.

---

## 2. Why PeerJS / WebRTC

A peer-to-peer game like this has three viable paths:

| Path                                | Backend required?              | Latency | Difficulty | Notes                                                                                                                                                                                      |
| ----------------------------------- | ------------------------------ | ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **WebSocket server** (Node, Go, …)  | Yes — needs deploy + ops       | Low     | Medium     | Total control, but we own a server.                                                                                                                                                        |
| **Pass-and-play** (same device)     | No                             | None    | Trivial    | Only works in the same room. Not what the user asked for.                                                                                                                                  |
| **WebRTC peer-to-peer via PeerJS**  | **No** (broker is free public) | Low     | Medium     | Browsers connect directly to each other after a brief handshake through a free signalling broker. The brokerage is just to exchange ICE candidates — once paired, no third party is involved. |

We're going with the third path. **PeerJS** (`npm i peerjs`) wraps the raw WebRTC API into a friendly `Peer` / `DataConnection` abstraction. It defaults to the public `peerjs.com` broker for signalling, which is free and operated by the PeerJS team. No env vars, no API keys, no backend code from us.

### Trade-offs we accept

1. **No SLA on the broker.** The public PeerJS broker can go down. For a hobby game this is fine; for production you'd run your own (the broker is open-source).
2. **WebRTC can fail behind strict NATs.** Some restrictive corporate / hotel networks block UDP and won't traverse without a TURN server. PeerJS's public broker doesn't ship TURN, so those users will see a "network error". For most home / mobile networks this is a non-issue.
3. **No persistent identity.** Refresh = lose the connection. The room code is single-use per session.
4. **No authentication.** Anyone with the 6-character code can join the room. We rely on the fact that the codes are only shared by humans, not searchable.

---

## 3. Architectural decisions

### 3.1 Symmetric architecture (no host-authoritative server)

Both peers run the **same cricket state machine** locally. Picks are exchanged via the network; when each peer has both picks (its own + the opponent's), it runs the `processBall` action and arrives at the same result deterministically.

**Why not host-authoritative?**
- An authoritative host adds latency (joiner has to wait for host to compute and broadcast each result).
- It also creates an asymmetry — joiner's UI is "downstream" of the host's, complicating animations.
- Symmetric eliminates both. The only state we need to sync is each player's pick on each ball.

### 3.2 6-character room codes used directly as the PeerJS peer ID

PeerJS lets you specify a custom peer ID when constructing `new Peer(id)`. We use a randomly-generated 6-character alphanumeric code from an unambiguous alphabet (no `I` / `O` / `0` / `1` to avoid misreads when sharing verbally). That code IS the peer ID — the joiner just types it back, no separate lookup table needed.

**Alphabet**: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — 31 characters.
**Codes**: 31⁶ ≈ 887 million combinations. Collisions are vanishingly rare at this scale of casual usage.

If a collision does happen (the host code is already in use by someone), PeerJS returns an `unavailable-id` error and we tell the user to try again.

### 3.3 Singleplayer stays

The new flow doesn't replace singleplayer — it adds a fork. After name entry, the player picks a mode:
- **Play vs Computer** → existing singleplayer flow.
- **Play vs Friend** → new multiplayer flow.

### 3.4 Host decides match length

In Part 20, we'll have the host pick the match length (6-ball or 12-ball) and send it to the joiner. We could instead require both players to "agree" by picking the same value, but the UX cost (two pickers, mismatch handling) isn't worth it for a casual game.

---

## 4. The bigger plan

This is a multi-Part lift. Each Part is its own checkpoint:

| Part | Title                                                          | Status   |
| ---- | -------------------------------------------------------------- | -------- |
| 19   | **Foundation** — PeerJS install, lobby (host/join), connection | **done** |
| 20   | **Multiplayer match-length sync**                              | **done** |
| 21   | **Multiplayer coin toss**                                      | **done** |
| 22   | **Multiplayer bat/bowl**                                       | **done** |
| 23   | **Multiplayer gameplay (picks exchange + sync)**               | **done** |
| 24   | **Multiplayer rematch + mid-flow disconnect awareness**        | **done** |

Each Part lands one at a time with a "looks good" review in between, identical rhythm to `doc.md`. A final **Conclusion** section at the bottom of this file walks through the full multiplayer build end-to-end as one continuous story, for anyone reading after the fact.

---

## Part 19 — Foundation: PeerJS install, lobby, connection

### 19.1 What we built

After name entry, the player now sees a **Mode Selection** screen with two options:

```
┌──────────────────────────┬──────────────────────────┐
│  Play vs Computer        │  Play vs Friend          │
│  Quick match             │  Share a room code       │
└──────────────────────────┴──────────────────────────┘
```

- **Play vs Computer** → continues to the existing match-length picker / coin toss / etc. (unchanged).
- **Play vs Friend** → opens a **Multiplayer Lobby** screen.

The lobby has three sub-views:

1. **Menu** — pick between "Create Room" and "Join Room".
2. **Hosting** — generated a 6-char code (e.g. `K7M3PQ`), shows it with a copy-to-clipboard button, and a "Waiting for opponent…" spinner.
3. **Joining** — input field for the code; "Connect" button dials the host.

Once the PeerJS data channel opens between the two peers, both browsers route to a **Multiplayer Connected** placeholder screen showing:
- The shared room code.
- Who's the host vs the guest.
- Each player's name (received via the first `HELLO` message).
- A note that Part 20 will replace this with the real match-length picker.

This is the **checkpoint for Part 19**. The peer-to-peer connection is established; the actual game flow lands in subsequent Parts.

### 19.2 Why we structured it this way

| Choice                                                   | Why                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network layer (`peerClient.ts`) is a plain class, no React | Lets it be tested in isolation. Easy to reason about lifecycle (`host` / `join` / `send` / `destroy`).                                                                    |
| Provider split between `useMultiplayer.ts` and `MultiplayerProvider.tsx` | Same Fast-Refresh split pattern as the audio / stadium modules. Keeps `react-refresh/only-export-components` happy.                                                       |
| `subscribe(handler)` pattern for inbound messages         | Each screen subscribes for the messages it cares about, unsubscribes on unmount. No global event bus, no prop-drilling of `lastMessage`.                                  |
| The lobby owns the "advance on connect" navigation        | When the connection opens, the lobby calls `onConnected()` (a prop) instead of `setScreen()` directly. Keeps the lobby presentational, and App owns the routing decisions. |
| Room codes are the peer ID directly                       | No second lookup, no extra state. Joiner types code → `peer.connect(code)` directly.                                                                                      |

### 19.3 Commands run

```bash
npm install peerjs
# Adds 6 packages — peerjs and its deps (EventEmitter shims, etc).

# Verify after the foundation:
npm run lint
npm run lint:fix       # auto-fixed a handful of Prettier line-break warnings
npm run build          # clean tsc + Vite production build (JS bundle bumps to ~659KB / ~203KB gzipped due to peerjs)
```

### 19.4 File map of what was added/changed

```
src/
  multiplayer/                          NEW DIRECTORY
    messages.ts                         NetworkMessage union (HELLO for now)
    peerClient.ts                       PeerJS wrapper class — host/join/send/destroy
    useMultiplayer.ts                   Context + hook (similar shape to useSounds)
    MultiplayerProvider.tsx             Provider that owns the PeerClient + state

  screens/
    ModeSelectionScreen.tsx             NEW — singleplayer vs multiplayer choice
    MultiplayerLobbyScreen.tsx          NEW — menu / hosting / joining sub-views
    MultiplayerConnectedScreen.tsx      NEW — placeholder after connect

  game/
    types.ts                            ADDED — 'modeSelect', 'multiplayerLobby',
                                                'multiplayerConnected' to ScreenName;
                                                new GameMode type

  App.tsx                               UPDATED — flow now goes
                                                playerName → modeSelect → either
                                                matchLength (singleplayer) or
                                                multiplayerLobby (multiplayer)

  main.tsx                              UPDATED — wrapped with MultiplayerProvider

package.json                            UPDATED — peerjs added
```

### 19.5 Code anatomy — what each new file does

#### `src/multiplayer/messages.ts`

Single union type for everything the two peers say to each other:

```ts
export type NetworkMessage = { type: 'HELLO'; name: string }
```

That's it for Part 19. The union grows in later Parts (`MATCH_LENGTH`, `TOSS_CALL`, `PICK`, etc.). Keeping it a discriminated union means the receiving side gets exhaustive type-checking via a `switch (msg.type)`.

#### `src/multiplayer/peerClient.ts`

A small class wrapping PeerJS's `Peer` and `DataConnection`. The key methods:

```ts
class PeerClient {
  async host(): Promise<string>          // creates a peer with a generated code, returns it
  async join(roomCode: string): Promise<void>  // creates a peer, dials the host
  send(msg: NetworkMessage): void        // sends a typed message; no-op when not connected
  destroy(): void                        // tears everything down
}
```

The class takes a `Callbacks` object in its constructor — `onMessage`, `onConnected`, `onDisconnected`, `onError`. These are the four events the React layer cares about. The class translates PeerJS's `peer.on('open')` / `conn.on('data')` / etc. into these four callbacks, so the React layer only has to subscribe to one shape.

**Room code generation** lives here (`generateRoomCode()`). Six characters from a 31-symbol unambiguous alphabet.

**Error mapping** also lives here (`describeError`). PeerJS errors have a `type` field (e.g. `'unavailable-id'`, `'peer-unavailable'`, `'network'`) which we map to user-friendly strings.

#### `src/multiplayer/useMultiplayer.ts`

The React-side: defines `MultiplayerStatus = 'idle' | 'hosting' | 'joining' | 'connected' | 'error'`, the `MultiplayerContextValue` type, the `MultiplayerContext`, and the `useMultiplayer()` guard hook.

#### `src/multiplayer/MultiplayerProvider.tsx`

The provider owns:
- React state: `status`, `isHost`, `roomCode`, `opponentName`, `errorMessage`.
- Refs (mutable, no re-render): `clientRef` (the `PeerClient`) and `subscribersRef` (a `Set` of message handlers from consumers).

It exposes:
- `host()` / `join(code)` — kick off the connection.
- `send(msg)` — push a message to the other peer.
- `subscribe(handler)` — register for inbound messages; returns an `unsubscribe` function.
- `disconnect()` — tear down the room.

Three notable choices:
1. The `PeerClient` is created **lazily** on the first `host()` or `join()` call via `ensureClient()`. We don't construct it at mount — that would open a connection to the broker before the user has chosen to play.
2. The `HELLO` message is **handled specially** inside the provider: it sets `opponentName` directly. All other messages get fanned out to subscribers via the `subscribersRef` set.
3. There's a final cleanup `useEffect` that calls `clientRef.current?.destroy()` on unmount, so navigating away while connected doesn't leak open broker connections.

#### `src/screens/ModeSelectionScreen.tsx`

Two tile buttons — `Play vs Computer` (`primary` colour, robot icon) and `Play vs Friend` (`secondary` colour, group icon). Identical layout pattern to `MatchLengthScreen` so the two screens feel like siblings.

#### `src/screens/MultiplayerLobbyScreen.tsx`

Owns a local `view: 'menu' | 'hosting' | 'joining'` and a `codeInput` string. The single `useEffect` watches `status === 'connected'` and does two things on transition: send the `HELLO` (carrying our player name) and call the parent's `onConnected()` callback so App can navigate.

The lobby is the only piece of code in Part 19 that knows about all four PeerJS states (`hosting`, `joining`, `error`, `connected`). The other screens are oblivious.

#### `src/screens/MultiplayerConnectedScreen.tsx`

Read-only placeholder. Shows the room code, who's host/guest, and both players' names. The "Leave room" button calls `disconnect()` and the parent's `onLeave()` callback.

This screen gets **deleted** in Part 20 — its job is taken over by the multiplayer match-length picker, which is the actual next step in the game flow.

### 19.6 Connection sequence — what happens between "click Create Room" and "both screens show Connected"

```
HOST                                          JOINER
────                                          ──────
1. Click "Create Room"
2. PeerClient.host():
     new Peer('K7M3PQ')                       
     peer.on('open', resolve)
3. PeerJS broker registers
     us at id 'K7M3PQ'.
4. We resolve with the code.
5. UI shows "K7M3PQ" + spinner.
                                              6. Receives code (verbally / paste).
                                              7. Click "Connect".
                                              8. PeerClient.join('K7M3PQ'):
                                                   new Peer()      ← random ID
                                                   peer.on('open', () => {
                                                     peer.connect('K7M3PQ')
                                                   })
9. peer.on('connection', conn):
     attachConnection(conn)
                                              10. attachConnection(conn) too.
11. Both ends:
     conn.on('open', () => {              ← fires on both peers when ICE settles
       callbacks.onConnected()
     })
12. Provider sets status='connected'.
13. Lobby useEffect fires:
     - send({type:'HELLO', name})
     - onConnected() → App navigates
                                              13. Same thing on the other side.
14. MultiplayerConnectedScreen mounts.
15. HELLO arrives.
16. opponentName populates.            ← visible in the "Opponent: …" chip
```

### 19.7 Gotchas and notes for future readers

- **PeerJS errors are objects with a `type` field**, not standard `Error` instances. Don't try to read `.name` or `.stack`. We extract `.type` and `.message`.
- **`peer.on('error', ...)` can fire after `peer.on('open')`** — a peer can be registered with the broker and then lose the broker connection later. We treat any error as "the room is broken" and route to the `error` state.
- **`conn.on('close')` triggers if either side disconnects, but also if either side refreshes.** There's no clean way to distinguish "they quit" from "they refreshed". Part 24 will handle this by showing a "Opponent left" screen and offering a clean exit.
- **Don't call `setState` directly inside an effect that depends on multiplayer status in App.** The newer `eslint-plugin-react-hooks` flags it. Move the navigation into the screen with an `onConnected` callback. We learned this the hard way during Part 19.
- **PeerJS adds ~110KB gzipped to the bundle.** Acceptable for the value it delivers (free WebRTC abstraction). If we ever want to shrink it, lazy-loading via dynamic import on entering the multiplayer flow is the cleanest path.

### 19.8 How to test Part 19

Open the dev server in **two browser windows** (or a normal window + an incognito window so localStorage is independent):

1. In Window A:
   - Enter a name (e.g. `Virat`).
   - Click **Play vs Friend**.
   - Click **Create Room**.
   - Note the 6-character code shown (e.g. `K7M3PQ`).
2. In Window B:
   - Enter a different name (e.g. `Rohit`).
   - Click **Play vs Friend** → **Join Room**.
   - Paste the code from Window A.
   - Click **Connect**.
3. Both windows should advance to the **Connected!** screen within a second or two.
4. Window A's "Opponent" chip should show `Rohit`. Window B's should show `Virat`.
5. Click **Leave room** in either window — both return to mode selection cleanly.

If the test fails:
- **Stuck on "Waiting for opponent" forever** → the broker can't reach the joiner, probably a NAT / firewall issue. Try over a phone hotspot.
- **"Room code already in use"** → 1-in-887M collision. Click cancel and create again.
- **"No room found with that code"** → typo, or the host's tab closed.

---

## 19.9 Looking ahead — what Part 20 needs

When Part 20 lands, this is what changes:

- `MultiplayerConnectedScreen.tsx` goes away.
- The multiplayer flow after connect goes straight into a multiplayer-aware match-length picker.
- `messages.ts` grows: `| { type: 'MATCH_LENGTH'; balls: 6 | 12 }`.
- The host picks; the joiner sees "Waiting for host to pick…" until the message arrives.
- Both peers then route into the multiplayer-aware coin toss (Part 21).

The shape of the multiplayer game from here is: each transition is a screen + a single message + a matching `subscribe` handler on the receiving side. Build one Part at a time.

---

## Part 20 — Multiplayer match-length sync

### 20.1 What we built

The Part-19 "Connected!" placeholder is **gone**. As soon as the peer connection opens, both players now land on a **multiplayer match-length screen**:

- **Host** sees the familiar 6-Ball / 12-Ball tile picker — same shape as the singleplayer `MatchLengthScreen` so the two feel like siblings. A small chip reminds them the opponent is waiting.
- **Joiner** sees a centered spinner with `"Waiting for <opponent> to pick…"`. No buttons; they have nothing to do until the message arrives.

When the host clicks 6 or 12:
1. The host sends `{ type: 'MATCH_LENGTH', balls: 6|12 }` over the data channel.
2. The host's own UI advances immediately (we don't wait for our own message to round-trip).
3. The joiner's `subscribe` callback fires when the message arrives, pulls out `balls`, and advances the joiner too.

Both peers land on a new temporary screen — **MultiplayerHoldingScreen** — which confirms the agreed length and acknowledges that the multiplayer coin toss is the next thing to build.

### 20.2 Why this shape

| Choice                                                                    | Why                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host picks, joiner waits (not "both must agree")                          | One-sided picks are faster and simpler — no mismatch handling. The role is already established by who created the room; that asymmetry naturally maps to "host chooses the rules".                                                             |
| Host advances on its own click (doesn't wait for the network round-trip)  | Network latency is already low (~50ms regional WebRTC), and waiting would imply "the other side might say no". They can't — the message is one-way. So the host commits locally and broadcasts in parallel.                                  |
| Joiner uses `subscribe()` and `useEffect` to receive                       | The `MultiplayerProvider` exposes a `subscribe` API that returns an unsubscribe function. Calling it inside `useEffect` and returning the unsubscribe gives us automatic cleanup if the joiner navigates away mid-wait.                       |
| One screen handles both host and joiner views                              | The decision of "what to render" is a single conditional `isHost` from `useMultiplayer()`. Splitting into two files would have meant duplicate `motion.div` wrapper, duplicate `containerVariants`, duplicate import boilerplate.              |
| `ballsPerInnings` reuses the existing App state slot                       | The singleplayer flow already stores the chosen length in `App.tsx`. Multiplayer pumps the same state from a different code path. Downstream screens (gameplay, result) don't care how the value got there — both flows share the same plumbing. |

### 20.3 Commands run

```bash
# No new npm installs — uses the peerjs that landed in Part 19.

# Verify
npm run lint
npm run lint:fix    # auto-fixed two Prettier line-break warnings
npm run build       # clean tsc + Vite production build
```

### 20.4 File changes

```
src/
  multiplayer/
    messages.ts                                EXTENDED
                                                 - Added `| { type: 'MATCH_LENGTH'; balls: BallsPerInnings }`
                                                 - Re-imported BallsPerInnings from game/types

  screens/
    MultiplayerConnectedScreen.tsx             DELETED  (the Part-19 placeholder, replaced)
    MultiplayerMatchLengthScreen.tsx           NEW       Host picker + joiner waiting view
    MultiplayerHoldingScreen.tsx               NEW       Temporary "match ready" placeholder

  game/
    types.ts                                   UPDATED
                                                 - Dropped 'multiplayerConnected' from ScreenName
                                                 - Added 'multiplayerMatchLength', 'multiplayerHolding'

  App.tsx                                      UPDATED
                                                 - Imports swapped (the deleted screen → the two new ones)
                                                 - handleMultiplayerConnected now routes to 'multiplayerMatchLength'
                                                 - New handler handleMultiplayerMatchLengthSet(count):
                                                     setBallsPerInnings(count); setScreen('multiplayerHolding')
                                                 - JSX block for old placeholder replaced by two new branches
```

### 20.5 Code anatomy — the new bits

#### `messages.ts` — the protocol grew by one entry

```ts
export type NetworkMessage =
  | { type: 'HELLO'; name: string }
  | { type: 'MATCH_LENGTH'; balls: BallsPerInnings }
```

The discriminated-union shape means a `switch (msg.type)` inside a subscriber gets exhaustive typing for free.

#### `MultiplayerMatchLengthScreen.tsx`

```tsx
export default function MultiplayerMatchLengthScreen({ playerName, onMatchLengthSet }: Props) {
  const { isHost, opponentName, subscribe, send } = useMultiplayer()

  // Joiner-only subscriber. Returns the cleanup so the effect tears down
  // cleanly if the joiner navigates away.
  useEffect(() => {
    if (isHost) return
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'MATCH_LENGTH') {
        onMatchLengthSet(msg.balls)
      }
    })
    return unsubscribe
  }, [isHost, subscribe, onMatchLengthSet])

  // Host fires this on click.
  const handlePick = (count: BallsPerInnings) => {
    send({ type: 'MATCH_LENGTH', balls: count })
    onMatchLengthSet(count)
  }

  // ...HostView OR JoinerView based on isHost
}
```

Two sub-components inside the same file — `HostView` (with the 6-Ball / 12-Ball tiles) and `JoinerView` (with the spinner). Keeping them inline avoids file fan-out for what is essentially one feature.

#### `MultiplayerHoldingScreen.tsx`

A small read-only screen that shows four chips:
1. Room code (monospace, letter-spaced for readability).
2. You: `<name> (host)` or `<name> (guest)`.
3. Opponent: `<opponent name>`.
4. **Match length** chip — orange/warning colour to flag the freshly-agreed value.

Plus a "Leave room" button that calls `disconnect()` and routes the user back to mode selection.

### 20.6 Sequence diagram — what happens when the host picks

```
HOST                                          JOINER
────                                          ──────

[ Both screens are sitting on MultiplayerMatchLengthScreen ]

Host clicks "6 Ball Game"
1. handlePick(6) fires
2. send({type:'MATCH_LENGTH', balls:6})
   ──────  WebRTC data channel  ──────►
3. onMatchLengthSet(6) called locally
4. App.handleMultiplayerMatchLengthSet:
     - setBallsPerInnings(6)
     - setScreen('multiplayerHolding')
5. Host renders MultiplayerHoldingScreen
                                              6. Network message arrives at PeerClient
                                              7. PeerClient.onMessage forwards to
                                                 the subscriber set in the Provider
                                              8. MultiplayerMatchLengthScreen's effect
                                                 receives the message; calls
                                                 onMatchLengthSet(6)
                                              9. App.handleMultiplayerMatchLengthSet:
                                                   - setBallsPerInnings(6)
                                                   - setScreen('multiplayerHolding')
                                              10. Joiner renders MultiplayerHoldingScreen
```

Latency between step 2 and step 9 is the WebRTC data channel round-trip, typically 50–150ms on the same continent. The user perceives both screens flipping "at the same time".

### 20.7 Gotchas / notes for future readers

- **Why `subscribe()` is gated by `if (isHost) return`** — the host doesn't need to receive its own `MATCH_LENGTH` message. PeerJS doesn't echo messages back to the sender by default, but we gate the subscription anyway to make the intent obvious in the code.
- **`useEffect` dep on `subscribe`** — even though `subscribe` is `useCallback`-stable in the provider, listing it satisfies the exhaustive-deps lint rule and makes the dependency explicit. Same pattern across all the multiplayer-aware screens.
- **`ballsPerInnings !== null` guard in the JSX** — the holding screen needs the value as a non-null prop. The guard makes the type checker happy and prevents the screen from rendering with a stale `null` if the user somehow lands here without the message having fired (shouldn't happen, but cheap insurance).
- **`MATCH_LENGTH` is a one-shot event, not a sync** — once both peers have it, no further messages are needed. We don't need to re-broadcast on rematch because (a) Part 24 will design the rematch flow explicitly, and (b) the cricket machine carries `ballsPerInnings` in its own context anyway.
- **The host's `handlePick` calls `onMatchLengthSet(count)` AFTER `send()`** — the order matters subtly. If we called `onMatchLengthSet` first, React would re-render and unmount this screen; the `send()` would still succeed (PeerClient holds the connection independently), but ordering it the other way is conventional ("emit the side effect, then change my own state").

### 20.8 How to test Part 20

Same two-window setup as Part 19, plus an extra step:

1. Window A: enter name → **Play vs Friend** → **Create Room** → share code.
2. Window B: enter name → **Play vs Friend** → **Join Room** → paste code → **Connect**.
3. **Both windows now land on the multiplayer match-length screen** (not the old "Connected!" placeholder).
   - Window A (host) sees the 6-Ball / 12-Ball tiles + a "Opponent is waiting" chip.
   - Window B (joiner) sees a spinner + "Waiting for <host> to pick…".
4. In Window A, click **6 Ball Game**.
5. Within ~100ms, both windows should advance to the **Match ready** holding screen, both showing `"6 balls per innings"`.
6. Test the 12-ball path too: leave the room (both windows), re-connect, host picks 12, verify the chip on both ends reads `"12 balls per innings"`.
7. Test the leave-room button — both peers should be able to gracefully exit back to mode selection.

If the test fails:
- **Joiner doesn't advance when host picks** → check the browser console; the subscriber may have failed to attach. The most common cause is a stale `MultiplayerProvider` instance from a previous match — full-page-refresh both windows and retry.
- **"Cannot find module" errors after pulling this branch** → run `npm install` first to be sure `peerjs` is in `node_modules`.

---

## 20.9 Looking ahead — what Part 21 needs

`MultiplayerHoldingScreen` goes away. The flow after the match-length sync routes into the **multiplayer coin toss**:

- The joiner calls heads/tails (the host already had the "advantage" of choosing the match length, so we balance the privilege).
- The joiner sends `{ type: 'TOSS_CALL', side: 'heads' | 'tails' }`.
- The host computes the random result, sends `{ type: 'TOSS_RESULT', result: 'heads' | 'tails' }`.
- Both peers compute who won (joiner if `side === result`, else host) and advance to the bat/bowl screen.

The visuals re-use the existing 3D coin from `CoinTossScreen`, just driven by network messages instead of local state.

---

## Part 21 — Multiplayer coin toss

### 21.1 What we built

After the match-length sync, both peers now drop into a **multiplayer coin toss** screen. The visual is the same 3D coin from the singleplayer flow — but the timing is driven by network messages instead of local state.

- **Joiner** (the one who joined the room with a code) sees two big tiles: Heads and Tails. They get to call. This balances the asymmetry from Part 20, where the host got the privilege of choosing the match length.
- **Host** sees a spinner + "Waiting for `<opponent>` to call…".

The joiner clicks Heads. Then:
1. Joiner sends `TOSS_CALL { side: 'heads' }`.
2. Joiner's UI updates to "Called heads — waiting for the toss…" (still 'awaiting' phase, no spin yet).
3. Host's PeerClient receives the message. Host immediately rolls a fair 50/50, sets local state (`userChoice = 'heads'`, `result = <rolled>`), transitions to `'rolling'`, and broadcasts `TOSS_RESULT { result }`.
4. Joiner's PeerClient receives the result; joiner sets `result` and transitions to `'rolling'`.
5. **Both peers** animate the 3D coin from 0° to `360 × 4 + (tails ? 180 : 0)` over 2.2s. Same animation, same landing face.
6. Framer Motion's `onAnimationComplete` fires on each peer → `phase = 'revealed'`.
7. Both screens render the result: who won the toss (from each side's local perspective) + a "Continue" button.
8. Either side clicks Continue → the TossOutcome is bubbled to App and the screen advances.

For Part 21, the post-toss landing is the **MultiplayerHoldingScreen** (now extended to show the toss outcome chip). Part 22 will replace it with the real multiplayer bat/bowl picker.

### 21.2 Why this shape

| Choice                                                                                            | Why                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Joiner calls, host rolls.**                                                                      | The joiner is the more passive role until now (they typed a code; the host picked the length). Letting them call balances the screen-time. **Host is authoritative on randomness** so both peers always land on the same face — eliminates any "your coin landed differently than mine" desync.                              |
| Joiner sends call → host rolls + broadcasts immediately.                                          | Round-tripping the call (joiner asks, host approves, joiner commits) would add an extra hop. One-way: joiner says "I called X", host says "OK, result is Y" — two messages total, no negotiation.                                                                                                                              |
| Both peers locally transition `'awaiting' → 'rolling' → 'revealed'`.                              | The cricket machine's `onAnimationComplete` pattern from singleplayer's `CoinTossScreen` is reused verbatim — when the coin's `rotateY` interpolation finishes, the screen knows to show the result. No shared timer between peers; the animation duration is a constant on both ends so they always reveal at the same time. |
| `userChoice` on **both** sides represents the **joiner's** call.                                  | Cleaner mental model than "userChoice is mine on each side". On the host, `userChoice` is set from the incoming TOSS_CALL message; on the joiner, it's set on click. Either way: it's the caller's choice. The "did I win?" computation then knows which perspective to flip from.                                            |
| `localWon` derived per side from `isHost` + `(userChoice === result)`.                            | Joiner wins iff their call matched the rolled side. Host wins iff the joiner's call DIDN'T match. One expression, two interpretations.                                                                                                                                                                                       |
| `MultiplayerHoldingScreen` extended (rather than a brand-new "TossDone" screen).                  | The holding screen was already a "current state placeholder" — it just gained a `tossOutcome` prop and an extra chip. New title text ("Toss done" vs "Match ready") swaps based on whether the toss has been played.                                                                                                          |
| `CoinFace` duplicated from singleplayer rather than extracted to shared.                          | Tiny (~25 lines), only used in two places, and the multiplayer screen is otherwise self-contained. A shared SVG would invite drift over time as one screen evolves; duplication is the lower-friction choice for now.                                                                                                        |

### 21.3 Commands run

```bash
# No new npm installs.

# Verify
npm run lint
npm run lint:fix    # auto-fixed three Prettier line-break warnings
npm run build       # clean tsc + Vite production build
```

### 21.4 File changes

```
src/
  multiplayer/
    messages.ts                                EXTENDED
                                                 - Imported `Side` from game/types
                                                 - Added `| { type: 'TOSS_CALL'; side: Side }`
                                                 - Added `| { type: 'TOSS_RESULT'; result: Side }`

  game/
    types.ts                                   UPDATED
                                                 - Added 'multiplayerCoinToss' to ScreenName
                                                   (between multiplayerMatchLength and multiplayerHolding)

  screens/
    MultiplayerCoinTossScreen.tsx              NEW       Joiner picker + host wait + both-side animation
    MultiplayerHoldingScreen.tsx               UPDATED   Now takes tossOutcome prop and renders it
                                                          when present (title flips "Match ready" → "Toss done")

  App.tsx                                      UPDATED
                                                 - Imports the new screen
                                                 - handleMultiplayerMatchLengthSet now routes to
                                                   'multiplayerCoinToss' (was 'multiplayerHolding')
                                                 - New handleMultiplayerTossComplete sets tossOutcome
                                                   and routes to 'multiplayerHolding'
                                                 - JSX for 'multiplayerCoinToss' branch added; the
                                                   'multiplayerHolding' branch now passes tossOutcome
```

### 21.5 Code anatomy — the new bits

#### `messages.ts` — protocol grew by two

```ts
export type NetworkMessage =
  | { type: 'HELLO'; name: string }
  | { type: 'MATCH_LENGTH'; balls: BallsPerInnings }
  | { type: 'TOSS_CALL'; side: Side }
  | { type: 'TOSS_RESULT'; result: Side }
```

`Side` is the existing `'heads' | 'tails'` from `game/types.ts`. The two messages are independent — `TOSS_CALL` triggers `TOSS_RESULT`; they're not paired into a single round-trip type.

#### `MultiplayerCoinTossScreen.tsx`

The interesting bits:

**Subscription**: a single `useEffect` subscribes to both messages with `isHost`-gated branches:

```ts
useEffect(() => {
  const unsubscribe = subscribe((msg) => {
    if (msg.type === 'TOSS_CALL' && isHost) {
      const rolled = rollCoinSide()
      setUserChoice(msg.side)
      setResult(rolled)
      setPhase('rolling')
      send({ type: 'TOSS_RESULT', result: rolled })
    }
    if (msg.type === 'TOSS_RESULT' && !isHost) {
      setResult(msg.result)
      setPhase('rolling')
    }
  })
  return unsubscribe
}, [subscribe, send, isHost])
```

**Joiner's click handler**:

```ts
const handleJoinerCall = (side: Side) => {
  setUserChoice(side)
  send({ type: 'TOSS_CALL', side })
}
```

`phase` stays in `'awaiting'` until `TOSS_RESULT` arrives — the screen flips from the picker UI to the "Called X, waiting…" UI because `userChoice` is now truthy.

**Winner derivation** (in `handleContinue`):

```ts
const joinerWonToss = userChoice === result
const winner: TossWinner = isHost
  ? joinerWonToss ? 'computer' : 'player'
  : joinerWonToss ? 'player' : 'computer'
```

Same `TossOutcome.winner` semantics as the singleplayer flow (`'player'` = local won, `'computer'` = remote won), so the downstream code doesn't have to care that this was a multiplayer toss.

#### `MultiplayerHoldingScreen.tsx`

Now takes an additional `tossOutcome: TossOutcome | null` prop. The chip stack grows when `tossOutcome` is present:

```tsx
{tossOutcome && (
  <Chip
    label={
      localWonToss
        ? `Toss: ${tossOutcome.result.toUpperCase()} — you won`
        : `Toss: ${tossOutcome.result.toUpperCase()} — ${opponentName ?? 'opponent'} won`
    }
    color={localWonToss ? 'primary' : 'secondary'}
  />
)}
```

The title swaps from "Match ready" to "Toss done", and the checkpoint chip message updates to mention Part 22.

### 21.6 Sequence diagram — what happens between "joiner clicks Heads" and "both show the result"

```
JOINER                                        HOST
──────                                        ────
[ Both are on MultiplayerCoinTossScreen, phase='awaiting' ]

1. Click "Heads"
2. handleJoinerCall('heads'):
     - setUserChoice('heads')
     - send({type:'TOSS_CALL', side:'heads'})
3. UI flips to "Called heads — waiting…"
                                              4. PeerClient receives TOSS_CALL
                                              5. Subscriber fires (isHost branch):
                                                   - rolled = rollCoinSide() → 'tails'
                                                   - setUserChoice('heads')   ← joiner's call
                                                   - setResult('tails')
                                                   - setPhase('rolling')
                                                   - send({type:'TOSS_RESULT', result:'tails'})
                                              6. Coin starts spinning toward targetRotation
                                                 = 360 × 4 + 180 = 1620°
7. PeerClient receives TOSS_RESULT
8. Subscriber fires (!isHost branch):
     - setResult('tails')
     - setPhase('rolling')
9. Coin starts spinning toward 1620°.
   [ Joiner's spin starts ~50-150ms after host's
     due to the round-trip; both take 2.2s ]
10. Framer onAnimationComplete fires
    → setPhase('revealed')
                                              11. Same — onAnimationComplete fires here too.
12. Both render the result block:
    - "It's tails!"
    - "Opponent won the toss." (joiner lost)
                                              12. - "It's tails!"
                                                  - "You won the toss, <name>!" (host won)
13. Either side clicks Continue
14. onComplete(TossOutcome) bubbles up
15. App stores tossOutcome,
    routes to 'multiplayerHolding'
                                              [ The other side will independently
                                                click Continue and do the same ]
```

Note the "either side" at step 13 — each peer's Continue button only advances their own UI. Part 22 will need a synchronisation point so both sides reach the bat/bowl screen together; for now both naturally end up on the holding screen but at potentially different moments.

### 21.7 Gotchas / notes for future readers

- **Don't roll on the joiner**. Even though `Math.random()` is fast, calling it independently on both sides would produce different results. The "host is authoritative on randomness" rule is non-negotiable for any value that has to be agreed by both peers.
- **`userChoice` semantics flip across sides but the type doesn't change.** On the joiner, `userChoice` is "my call". On the host, `userChoice` is "the opponent's call". The state variable is the same; what's different is *whose call it represents from the local perspective*. The `localWon` derivation accounts for this.
- **The "joiner has called but result hasn't arrived yet" state** uses `userChoice` truthiness as its discriminator, not a new `Phase` value. Keeping the phase enum to three values (`awaiting | rolling | revealed`) means the host's phase machine is identical to the joiner's; the joiner just has an extra UI conditional inside `'awaiting'`.
- **`onAnimationComplete` fires on both peers independently**. There's no network sync at the end of the spin — they both rely on the fact that the animation duration is a constant. If we ever wanted slightly different animation timings per side, we'd need a `TOSS_DONE` message; we don't, so we don't have one.
- **The host's TOSS_CALL handler does four state mutations + a send in one synchronous block.** React 18 batches all four into one render; the send happens before any re-render so the message is on the wire as soon as possible.
- **Continue is not synchronised between peers.** Each player clicks their own Continue at their own pace. Part 22 will need to design how the next phase starts — probably "either side clicking Continue advances both" via a `CONTINUE` message, or "advance immediately on the toss-done state and skip the manual Continue". Worth a design decision in Part 22.

### 21.8 How to test Part 21

Two-window setup as before, picking up from a working Part 20:

1. Window A and Window B: name → **Play vs Friend** → host/join → both land on the multiplayer match-length screen.
2. Host picks **6 Ball Game** → both windows advance to the **multiplayer coin toss** screen.
3. Window A (host) shows a spinner: `Waiting for <opponent> to call…`.
4. Window B (joiner) shows: `Call heads or tails, <name>.` with two buttons.
5. In Window B, click **Heads** (or Tails).
6. Window B updates immediately to: `Called heads — waiting for the toss…`.
7. Within ~100ms:
   - Both coins start spinning.
   - After 2.2s, the coin lands on the same side on both windows.
   - The result block appears in both: one window says "You won the toss, X!", the other says "Opponent won the toss."
8. Click **Continue** in either window → that side advances to the **Toss done** holding screen with a new chip showing the result.
9. Click Continue in the other window too → both sides on the holding screen.
10. **Leave room** on either side → both go back to mode selection.

If the test fails:
- **Joiner stays on "Called X, waiting…" forever** → host never received the call. Open browser devtools on the host window and look for PeerJS errors. Most common cause is the connection dropping mid-test (refresh both windows).
- **Coins land on different sides** → shouldn't be possible because the host is authoritative, but if it does happen, check that `TOSS_RESULT` is using the rolled value (not a re-roll on the joiner).
- **One side reveals before the other** → that's expected and OK; the result is the same, just the joiner's spin started a few hundred ms later.

---

## 21.9 Looking ahead — what Part 22 needs

`MultiplayerHoldingScreen` becomes more vestigial — Part 22 should route the post-toss state directly to the multiplayer bat/bowl picker:

- The **toss winner** picks Bat or Bowl. The other player sees "Waiting for X to choose…".
- New message: `{ type: 'ROLE_CHOICE'; role: 'bat' | 'bowl' }`.
- Both peers derive `firstInnings` from `(chooser, role)` using the existing `deriveFirstInnings` logic.
- App stores `roleDecision`; screen advances to a placeholder (or directly to gameplay in Part 23).

The holding screen will likely be deleted entirely by the time Part 24 ships.

---

## Part 22 — Multiplayer bat/bowl choice

### 22.1 What we built

After the coin toss settles, both peers route into a **multiplayer bat/bowl picker** instead of going to the holding placeholder. Same idea as the singleplayer `BatOrBowlScreen` but driven by network messages:

- **Toss winner** (locally `tossOutcome.winner === 'player'`) sees the picker with two large tile buttons — `Bat` (sky-blue) and `Bowl` (purple) — plus a small "your opponent is waiting" chip.
- **Toss loser** sees a spinner with `Waiting for their pick…` and a "Toss to `<opponent>`" header.

When the toss winner clicks Bat or Bowl:
1. Local UI advances immediately (`handlePick` calls `onRoleSet` with `chooser: 'player'`).
2. `ROLE_CHOICE { role }` is broadcast.
3. The loser's PeerClient receives the message, the subscriber on `MultiplayerBatOrBowlScreen` fires, and `onRoleSet` is called with `chooser: 'computer'`.

Both sides feed the same `(chooser, role)` pair into `deriveFirstInnings`, which produces the same `Innings` answer for each from their own perspective. The `RoleDecision` bubbles up to `App`, which stores it and advances both peers to the holding screen.

The `MultiplayerHoldingScreen` is **upgraded** in this Part: it now requires `roleDecision` (no longer optional), drops the conditional title swap from Part 21, and renders the full match summary as a labelled card with five rows — Room, You, Opponent, Length, Toss, First innings.

### 22.2 Why this shape

| Choice                                                                                    | Why                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Toss winner picks (not the host).**                                                     | Mirrors real cricket. The toss is the privilege; the bat/bowl call is the consequence of winning it. The host/joiner distinction is purely a connection role and shouldn't determine in-game privileges past the first decision (match length).                                                          |
| **`deriveFirstInnings` is duplicated here, not imported from `BatOrBowlScreen`.**        | The function is 2 lines and the duplication keeps each screen self-contained. Lifting to a shared `src/game/rules.ts` would be the right move if a third caller ever appeared.                                                                                                                            |
| **Both peers compute the same `firstInnings` independently.**                             | The function is pure. Given the same `(chooser, role)`, both sides produce the same answer. No need to broadcast the derived value — we only ever send the raw `role` and let each side compute its local `firstInnings`. Reduces the message protocol surface and avoids any "they sent me a wrong firstInnings" edge cases. |
| **`MultiplayerHoldingScreen` props tightened to non-null `tossOutcome` and `roleDecision`.** | The holding screen is now only reachable in one specific state — "match fully set up, awaiting gameplay". Optional types invited render edge cases (Part 21's title-flip logic was already a hint). Required types delete the branches and the App.tsx JSX gate handles the null cases explicitly.       |
| **Holding screen reworked into a labelled summary card.**                                 | Five chips stacked were already pushing the readable density; rebuilding as a card with caption-style row labels and a highlighted "First innings" row reads more like a real cricket scorecard. The visual hierarchy makes "you're batting first" the obvious takeaway.                                                |

### 22.3 Commands run

```bash
# No new npm installs.

# Verify
npm run lint
npm run lint:fix    # auto-fixed five Prettier line-break warnings
npm run build       # clean tsc + Vite production build
```

### 22.4 File changes

```
src/
  multiplayer/
    messages.ts                                EXTENDED
                                                 - Imported `Role` from game/types
                                                 - Added `| { type: 'ROLE_CHOICE'; role: Role }`

  game/
    types.ts                                   UPDATED
                                                 - Added 'multiplayerBatOrBowl' to ScreenName

  screens/
    MultiplayerBatOrBowlScreen.tsx             NEW       Toss winner picks / loser waits
    MultiplayerHoldingScreen.tsx               REWRITTEN
                                                 - Props now require tossOutcome + roleDecision
                                                 - Title always "Match ready!" (no more conditional)
                                                 - Full match summary as a labelled card
                                                 - Checkpoint chip mentions Part 23 gameplay

  App.tsx                                      UPDATED
                                                 - Imports the new MultiplayerBatOrBowlScreen
                                                 - handleMultiplayerTossComplete now routes to
                                                   'multiplayerBatOrBowl' (was 'multiplayerHolding')
                                                 - New handleMultiplayerRoleSet sets roleDecision
                                                   and routes to 'multiplayerHolding'
                                                 - JSX branch added for 'multiplayerBatOrBowl';
                                                   'multiplayerHolding' branch now gates on all
                                                   three values (ballsPerInnings + tossOutcome +
                                                   roleDecision) being non-null
```

### 22.5 Code anatomy — the new bits

#### `messages.ts` — protocol grew by one

```ts
export type NetworkMessage =
  | { type: 'HELLO'; name: string }
  | { type: 'MATCH_LENGTH'; balls: BallsPerInnings }
  | { type: 'TOSS_CALL'; side: Side }
  | { type: 'TOSS_RESULT'; result: Side }
  | { type: 'ROLE_CHOICE'; role: Role }
```

#### `MultiplayerBatOrBowlScreen.tsx`

The control flow is symmetric to `MultiplayerMatchLengthScreen` from Part 20 but inverted: there the **host** was the picker, here the **toss winner** is. The conditional is `localWonToss = tossOutcome.winner === 'player'` instead of `isHost`.

**Subscriber** (loser-only):

```ts
useEffect(() => {
  if (localWonToss) return
  const unsubscribe = subscribe((msg) => {
    if (msg.type === 'ROLE_CHOICE') {
      onRoleSet({
        chooser: 'computer',
        role: msg.role,
        firstInnings: deriveFirstInnings('computer', msg.role),
      })
    }
  })
  return unsubscribe
}, [localWonToss, subscribe, onRoleSet])
```

**Winner click handler**:

```ts
const handlePick = (role: Role) => {
  send({ type: 'ROLE_CHOICE', role })
  onRoleSet({
    chooser: 'player',
    role,
    firstInnings: deriveFirstInnings('player', role),
  })
}
```

Note that **the winner doesn't subscribe to ROLE_CHOICE**. They sent it; they don't need their own message echoed back. The `if (localWonToss) return` early-exit at the top of the effect makes this explicit.

#### `MultiplayerHoldingScreen.tsx` — full rewrite

The previous version had branching on `tossOutcome` presence (title flipped between "Match ready" and "Toss done"). Now that the holding screen is only reachable after the bat/bowl decision, both branches collapse into one. The chip stack becomes a single card with six rows:

```
ROOM             K7M3PQ
YOU              Virat (host)
OPPONENT         Rohit
LENGTH           6 balls per innings
TOSS             HEADS — you won
FIRST INNINGS    Virat bats          ← highlighted in primary
```

The "First innings" row gets a `highlight` flag that bumps it to bold + primary colour, because that's the single most actionable piece of information on the screen.

### 22.6 Sequence diagram — what happens when the toss winner clicks Bat

For this diagram assume **the joiner won the toss** (they called heads and the coin landed heads). Both peers are now sitting on `MultiplayerBatOrBowlScreen`.

```
JOINER (toss winner)                          HOST (toss loser)
────────────────────                          ─────────────────

[ Both on MultiplayerBatOrBowlScreen ]
[ Joiner sees Bat/Bowl tiles ]
[ Host sees "Waiting for their pick…" ]

1. Joiner clicks "Bat"
2. handlePick('bat'):
     - send({type:'ROLE_CHOICE', role:'bat'})
     - onRoleSet({
         chooser: 'player',
         role: 'bat',
         firstInnings: 'player',
       })
3. App.handleMultiplayerRoleSet:
     - setRoleDecision({...})
     - setScreen('multiplayerHolding')
4. Joiner renders MultiplayerHoldingScreen,
   "First innings: <joiner> bats" highlighted.
                                              5. PeerClient receives ROLE_CHOICE
                                              6. Subscriber fires:
                                                   - onRoleSet({
                                                       chooser: 'computer',
                                                       role: 'bat',
                                                       firstInnings: 'computer',
                                                     })
                                              7. App.handleMultiplayerRoleSet:
                                                   - setRoleDecision({...})
                                                   - setScreen('multiplayerHolding')
                                              8. Host renders MultiplayerHoldingScreen,
                                                 "First innings: <joiner> bats" highlighted.
```

Both `RoleDecision` objects are different on each side (`chooser` and `firstInnings` flip with perspective) but **point at the same physical reality** — the joiner is batting first.

### 22.7 Gotchas / notes for future readers

- **The winner doesn't subscribe**. We carry over the same pattern from Part 20 (host doesn't subscribe to `MATCH_LENGTH`) and Part 21 (host doesn't subscribe to `TOSS_CALL`, joiner doesn't subscribe to `TOSS_RESULT`). The discriminator is `localWonToss`, not `isHost`, because the privilege swaps independently of the connection role.
- **`firstInnings` is computed twice — once on each side — from the same pure function.** This is intentional. We don't broadcast the derived value because (a) it's fully determined by the raw `role`, (b) computing it locally is free, and (c) it removes a source of "the value I have is wrong" sync bugs.
- **`RoleDecision.chooser` swaps perspective**. On the winner it's `'player'`; on the loser it's `'computer'`. Same pattern as `TossOutcome.winner` in Part 21. Anyone reading App state has to know that 'player' always means "the local one" — not a fixed entity.
- **Holding screen's tightened types catch a class of bugs at compile time.** Before this Part, you could have rendered the holding screen with `tossOutcome = null` and the screen would have happily shown "Match ready" with no toss info. Now TypeScript enforces all three at the App.tsx callsite via the gate `&& ballsPerInnings !== null && tossOutcome && roleDecision`.
- **The `useEffect` dep `localWonToss`** isn't strictly stable across renders — it's a boolean derived from `tossOutcome`, which is a prop. If `tossOutcome` ever changed identity mid-screen, the effect would re-run, the unsubscribe would fire, and a fresh subscriber would attach. In practice `tossOutcome` is set once when the screen mounts and never changes; the dep is there to satisfy exhaustive-deps and isn't a perf concern.

### 22.8 How to test Part 22

Two-window setup, picking up from a working Part 21:

1. Both: name → **Play vs Friend** → host/join → match length → 6 Ball → coin toss.
2. Joiner calls heads or tails; coin lands; both windows show the toss result and click **Continue**.
3. Both advance to the **Multiplayer bat/bowl** screen.
   - One window (the toss winner) shows `You won the toss, <name>!` with Bat/Bowl buttons.
   - The other shows `Toss to <opponent>` with a spinner.
4. Toss winner clicks **Bat** (or Bowl).
5. Within ~100ms both windows advance to the **Match ready!** screen.
6. The match summary card on both windows should agree on:
   - Same room code.
   - Each lists themselves correctly (`<name> (host)` / `<name> (guest)`).
   - Same ball count.
   - Toss row matches (one side reads "you won", the other reads "opponent won").
   - First innings row matches (e.g. both say `Virat bats` if Virat won the toss and chose Bat).
7. **Leave room** on either side returns to mode selection.

If the test fails:
- **Loser stays on "Waiting for their pick…" forever** → the toss winner's `ROLE_CHOICE` never arrived. Most likely cause: connection dropped between the toss and the bat/bowl screen. Refresh both windows and start over.
- **The "First innings" row disagrees** → there's a bug in `deriveFirstInnings` or in the chooser/role mapping. Should not happen with the symmetric pure function; if it does, log the inputs on both sides and compare.

---

## 22.9 Looking ahead — what Part 23 needs

The multiplayer holding screen disappears. After the bat/bowl decision, both peers go straight into a **multiplayer gameplay screen**.

The mechanic to design:
- Each ball, **both players** pick a number 1-6 simultaneously.
- Send `{ type: 'PICK'; number: 1..6 }` to the opponent.
- Each peer waits until it has both picks (its own + the opponent's), then processes the ball locally using the existing cricket machine.

The existing `cricketMachine` was written for singleplayer (where `processBall` rolls the opponent's pick internally). For multiplayer it has to instead **wait for the opponent's pick** and use the network-supplied value. Two reasonable shapes:

1. **Extend `cricketMachine`** with an `opponentPick` event in addition to the local PICK, and a new state `awaitingOpponent`.
2. **Author a parallel `multiplayerCricketMachine`** specifically for the multiplayer path.

Option 1 reuses more code; option 2 keeps each machine's logic clean. Part 23 will likely go with (1) because the rest of the post-ball logic (innings switch, match end, scoring) is identical to singleplayer and shouldn't be duplicated.

---

## Part 23 — Multiplayer gameplay

### 23.1 What we built

The placeholder is gone — both peers now play a real 6-or-12-ball cricket match against each other, with picks exchanged over the PeerJS data channel.

After the bat/bowl decision lands, both peers drop into the **gameplay screen** (the same `GameplayScreen` the singleplayer flow uses, now parameterised). Each ball:

1. Both players see the same UI: scoreboard with their two names + faces, the role banner ("X batting · Y bowling"), the picks area (still showing `?` for both), and a row of `1`–`6` buttons.
2. Each player clicks a number independently. Their click:
   - Stashes the pick locally (`pendingPicks.local`).
   - Disables their own 1-6 buttons (so they can't double-pick).
   - Broadcasts `PICK { number }` over the network.
   - Shows a "Waiting for `<opponent>` to pick…" hint under the buttons.
3. As each peer receives the other's `PICK`, it stashes it (`pendingPicks.opp`).
4. The moment both picks are set, the screen dispatches a single `PICK` event to the local cricket machine with **both** numbers — the machine's `processBall` action uses the supplied `opponentPick` instead of rolling a random one.
5. The machine transitions through `revealing` (1.9s with the existing staggered pick-card animation + outcome banner) → `evaluating` → either `awaitingPick` (next ball) or `switchingInnings` or `complete`.
6. When the machine ticks `ballsThisInnings`, an effect clears the picks accumulator so the next ball starts clean.
7. At `complete`, both peers compute the same `MatchResult` from their (mirror-image) context and route to the existing `MatchResultScreen`.

### 23.2 Why this shape

| Choice                                                                                                | Why                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One `GameplayScreen` parameterised, not a duplicated multiplayer version.**                         | Singleplayer and multiplayer differ only in *how the picks are collected* — every visual, every sub-component, every animation is identical. Duplicating ~430 lines would be ~430 lines of maintenance liability. Added a `mode` prop + `opponentName` prop; threaded the latter through `Scoreboard`, `RoleBanner`, `PicksDisplay`, and the `PlayerCard`/`PickCard` labels. |
| **`cricketMachine` extended, not forked.**                                                            | The only difference at the machine level is the source of the opponent's pick. Adding `opponentPick?: BallNumber` to the `PICK` event and falling back to `randomBallNumber()` when undefined keeps a single machine, single set of guards, single set of rules.                                                                                              |
| **Both peers run the machine independently, with `firstBatter` set from their own perspective.**      | The machine's `currentBatter === 'player'` always means "the local human is batting". From each side, that's a different physical person, but the resulting `batterPick` / `bowlerPick` (and therefore `isOut`, `runs`) are identical because the function is symmetric in its inputs. No "authoritative" peer needed.                                          |
| **`pendingPicks` is a single useState `{ local, opp }`, not two separate ones.**                      | The ball-transition reset needs **one** `setState` call instead of two — which means only **one** `eslint-disable-next-line` to silence the rule against `setState` in effects. Cosmetic but worth it.                                                                                                                                                          |
| **Reset on `ctx.ballsThisInnings` / `ctx.inningsNumber`, not on `state.matches('awaitingPick')`.**    | After the machine processes a ball it transitions to `revealing` for ~1.9s before going back to `awaitingPick`. If we reset on the awaitingPick re-entry, the user could see the picks UI flash with their old pick still in flight. Resetting when `ballsThisInnings` increments fires earlier (immediately after the dispatch) and is monotonic.       |
| **Multiplayer `handlePlayAgain` disconnects and returns to mode select, instead of rematch-loop.**    | A real rematch needs both peers to agree to play again, which is a protocol design (Part 24). For now, "play again" in multiplayer is a clean exit — the player can re-host or re-join from mode select. Singleplayer behaviour is unchanged.                                                                                                                  |

### 23.3 Commands run

```bash
# No new npm installs.

# Verify
npm run lint
npm run lint:fix    # auto-fixed a Prettier line-break warning
npm run build       # clean tsc + Vite production build
```

### 23.4 File changes

```
src/
  game/
    machine.ts                                 EXTENDED
                                                 - CricketEvent.PICK gained an optional opponentPick
                                                 - processBall now uses event.opponentPick ?? randomBallNumber()
    types.ts                                   UPDATED
                                                 - Added 'multiplayerGameplay' to ScreenName
                                                 - Removed 'multiplayerHolding'

  multiplayer/
    messages.ts                                EXTENDED
                                                 - Imported BallNumber
                                                 - Added | { type: 'PICK'; number: BallNumber }

  screens/
    GameplayScreen.tsx                         REFACTORED
                                                 - New props: opponentName, mode (default 'singleplayer')
                                                 - opponentName threaded through Scoreboard, RoleBanner,
                                                   PicksDisplay, and the inner PlayerCard / PickCard labels
                                                   (replacing all hard-coded "Computer" strings)
                                                 - Multiplayer pick collection via pendingPicks useState
                                                 - Subscriber for inbound PICK messages
                                                 - Dispatch-when-both-set effect (no setState, just send)
                                                 - Ball-transition reset effect (with eslint-disable)
                                                 - handlePick branches on mode
                                                 - "Waiting for <opponent> to pick…" hint under buttons
    MultiplayerHoldingScreen.tsx               DELETED  (no longer reachable in the flow)

  App.tsx                                      UPDATED
                                                 - useMultiplayer added for status + opponentName + disconnect
                                                 - Dropped multiplayerHolding import + JSX + handlers
                                                 - handleMultiplayerRoleSet routes to 'multiplayerGameplay'
                                                 - New multiplayerGameplay JSX branch reusing GameplayScreen
                                                   with mode="multiplayer" and opponentName passed
                                                 - Singleplayer GameplayScreen call now also passes
                                                   opponentName="Computer"
                                                 - handlePlayAgain branches on multiplayerStatus —
                                                   disconnect + mode select in multiplayer, regular
                                                   coin-toss rematch in singleplayer
                                                 - handleChangeName disconnects if connected
```

### 23.5 Code anatomy — the new bits in `GameplayScreen`

```ts
// Combined accumulator so the ball-transition reset is one setState call.
const [pendingPicks, setPendingPicks] = useState<{
  local: BallNumber | null
  opp: BallNumber | null
}>({ local: null, opp: null })

// Inbound PICK → stash opponent's pick.
useEffect(() => {
  if (!isMultiplayer) return
  return subscribe((msg) => {
    if (msg.type === 'PICK') {
      setPendingPicks((prev) => ({ ...prev, opp: msg.number }))
    }
  })
}, [isMultiplayer, subscribe])

// Both picks present + machine ready → dispatch both into the machine.
useEffect(() => {
  if (!isMultiplayer) return
  if (pendingPicks.local === null || pendingPicks.opp === null) return
  if (!isAwaiting) return
  send({ type: 'PICK', number: pendingPicks.local, opponentPick: pendingPicks.opp })
}, [isMultiplayer, pendingPicks, isAwaiting, send])

// Ball changed → clear accumulator for the next ball.
useEffect(() => {
  if (!isMultiplayer) return
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setPendingPicks({ local: null, opp: null })
}, [isMultiplayer, ctx.ballsThisInnings, ctx.inningsNumber])

// Click handler — multiplayer branch.
const handlePick = (n: BallNumber) => {
  if (isMultiplayer) {
    if (pendingPicks.local !== null) return // already picked this ball
    setPendingPicks((prev) => ({ ...prev, local: n }))
    sendNetwork({ type: 'PICK', number: n })
  } else {
    send({ type: 'PICK', number: n })
  }
}
```

The machine-side change is even smaller:

```ts
processBall: assign(({ context, event }) => {
  const playerPick = event.number
  // Multiplayer supplies the opponent's pick via the event;
  // singleplayer leaves it undefined and we roll a random 1-6 here.
  const computerPick = event.opponentPick ?? randomBallNumber()
  // ...rest unchanged
})
```

### 23.6 Sequence diagram — one ball played by two peers

Assume Virat is batting first. Both peers are sitting on the gameplay screen, ready for ball 1 of innings 1.

```
VIRAT (currentBatter='player')                ROHIT (currentBatter='computer')
──────────────────────────────                ────────────────────────────────

[ Both: pendingPicks = { local: null, opp: null }, isAwaiting=true ]

1. Virat clicks "3"
2. handlePick(3):
     - setPendingPicks({local:3, opp:null})
     - sendNetwork({type:'PICK', number:3})
3. Virat's UI: buttons disabled,
   "Waiting for Rohit to pick…" shown.

                                              4. Rohit clicks "5"
                                              5. handlePick(5):
                                                   - setPendingPicks({local:5, opp:null})
                                                   - sendNetwork({type:'PICK', number:5})
                                              6. Rohit's UI: buttons disabled,
                                                 "Waiting for Virat to pick…" shown.

7. Virat's PICK arrives at Rohit's PeerClient
                                              8. Subscriber fires:
                                                   setPendingPicks(prev => ({...prev, opp:3}))
                                              9. Both picks set + isAwaiting=true
                                                 → dispatch-effect runs:
                                                   send({type:'PICK', number:5, opponentPick:3})
                                              10. cricketMachine.processBall:
                                                    - playerPick = 5
                                                    - computerPick = 3
                                                    - playerIsBatting = false (Rohit is bowling)
                                                    - batterPick = 3 (Virat)
                                                    - bowlerPick = 5 (Rohit)
                                                    - isOut = false (3 ≠ 5)
                                                    - runs = 3
                                                    - computerScore += 3 (Virat scores 3 from Rohit's POV)

7'. Rohit's PICK arrives at Virat's PeerClient
8'. Subscriber fires:
      setPendingPicks(prev => ({...prev, opp:5}))
9'. Both picks set + isAwaiting=true
     → dispatch-effect runs:
       send({type:'PICK', number:3, opponentPick:5})
10'. cricketMachine.processBall:
      - playerPick = 3
      - computerPick = 5
      - playerIsBatting = true (Virat is batting)
      - batterPick = 3 (Virat)
      - bowlerPick = 5 (Rohit)
      - isOut = false
      - runs = 3
      - playerScore += 3

11. Both machines transition to revealing for 1.9s.
12. ctx.ballsThisInnings goes 0 → 1 on both peers.
13. The ball-reset effect fires on both:
     setPendingPicks({local:null, opp:null})
14. Both screens render the reveal animation:
     - Pick cards swap from "?" to the chosen numbers
     - "+3 runs" chip pops in at the 1.1s mark
     - Animated score increments
15. After 1.9s: machine → evaluating → awaitingPick.
16. Both UIs show "?" again, buttons enabled, ready for ball 2.
```

Both peers compute the same outcome ({batterPick=3, bowlerPick=5, runs=3, isOut=false}) but record it with their own `batter` field — `'player'` on Virat's side, `'computer'` on Rohit's side. The `playerScore` / `computerScore` numbers also flip across sides but represent the same physical scores.

### 23.7 Gotchas / notes for future readers

- **The `eslint-disable-next-line react-hooks/set-state-in-effect`** on the ball-reset effect is a legitimate use of `useEffect` for synchronising view state to machine state. The rule warns against cascading renders; in our case the reset only fires once per ball-counter change, never loops.
- **`pendingPicks` is a single combined state** specifically so the ball-reset is one `setState` (and one eslint-disable). Two separate `useState`s would each have needed their own disable comment.
- **`subscribe` returns an unsubscribe function** — the `return subscribe(...)` pattern relies on that. If you ever change `subscribe`'s contract, every consumer of it (Parts 20, 21, 22, 23) needs a re-check.
- **The subscriber captures `setPendingPicks` lexically**, which is stable because React guarantees setState identity. So the subscription doesn't need to re-attach when picks change. It DOES re-attach if `isMultiplayer` or `subscribe` change — neither does in practice during a match.
- **Don't try to merge the singleplayer and multiplayer click paths into one.** They behave differently: singleplayer is "click → machine"; multiplayer is "click → network + local stash → wait → machine". Branching on `isMultiplayer` inside `handlePick` is the right place.
- **`opponentName` flows through props all the way down** — it's not in a context, even though it lives in `useMultiplayer().opponentName`. The reason is that singleplayer needs to pass `"Computer"` here; making the screen reach into context would tie it to the multiplayer provider always being present (it is, but the screen shouldn't have to know that).
- **React 18 StrictMode double-mounts effects in dev.** The subscriber's `return subscribe(...)` cleanup handles this correctly — first mount attaches a subscriber, cleanup unsubscribes it, second mount attaches a fresh one. The net result is one active subscriber, same as production.
- **If a peer's `PICK` arrives before the local player has clicked**, `pendingPicks.opp` gets set first. Then when the local player clicks, both are set and the dispatch effect fires. Order doesn't matter, only that both arrive.

### 23.8 How to test Part 23

Two windows, picking up from a working Part 22:

1. Both: name → **Play vs Friend** → host/join → match length 6 → coin toss → bat/bowl pick.
2. Both advance into the gameplay screen at the same time.
3. Confirm the scoreboard reads the right names: each window shows their own name as primary (sky-blue) and the opponent's name as secondary (purple). The "X batting · Y bowling" chips should agree on who is batting.
4. Window A clicks **3**. The 1-6 buttons grey out and "Waiting for <opponent> to pick…" appears below.
5. Window B clicks **5**. Same disable-and-wait state.
6. Within ~100ms both windows kick off the reveal: pick cards flip from `?` to the chosen numbers, outcome chip pops in ("+3 runs" since 3 ≠ 5), animated score increments on the batting side.
7. After ~2 seconds both windows return to the awaiting state for ball 2 with picks reset.
8. Play through to the end of the innings (out or all balls used). Both windows agree on the innings switch, the chase target, etc.
9. After both innings, both windows advance to the **MatchResultScreen** (reused from singleplayer). Each window shows the result from its own perspective — one says "You won!", the other "Opponent won!" (or "It's a tie!").
10. Click **Play again** on either window. In multiplayer it disconnects and returns both sides to mode select. Click **Change name** → full reset back to the welcome screen, peer disconnected.

If the test fails:
- **Buttons stay enabled after I pick** → the local stash via `setPendingPicks` didn't happen. Check the browser console for errors.
- **Both windows show different scores** → `processBall` is producing different outputs from the same inputs, which is impossible if it's pure. Most likely the issue is that the `opponentPick` event field isn't reaching the machine on one side. Add a `console.log` in `processBall` to verify.
- **Reveal animations desync** → expected; one peer's network round-trip is ~50-150ms slower. The animations all run for 1.9s though, so by the end of the reveal both are back in sync.
- **Match Result screen shows wrong winner** → check that `playerScore` and `computerScore` are flipped across the two windows (they should be — Virat's `playerScore` = Rohit's `computerScore`).

---

## 23.9 Looking ahead — what Part 24 needs

The multiplayer game loop now plays one full match. What's missing:

1. **Multiplayer rematch.** Both peers click "Play Again" → both go back to the multiplayer coin toss with the same opponent, same match length. Today `handlePlayAgain` just disconnects.
2. **Disconnect handling mid-match.** If the other player closes their tab during gameplay, the local side currently just sits there waiting for the opponent's pick forever. Need a "Opponent left" screen + clean exit.
3. **`MatchResultScreen` multiplayer awareness.** The Play Again button copy is fine for either mode; the Change Name copy could become "Leave match" in multiplayer. Tiny polish.

These are the Part 24 scope.

---

# Part 24 — Multiplayer rematch + disconnect awareness

## 24.1 Summary

Part 24 closes the loop on the multiplayer flow. Two things land:

1. **Rematch handshake.** On the result screen, "Play again" no longer disconnects. In multiplayer it sends a `REMATCH_REQUEST` to the other peer and flips the local button into a "Waiting for opponent…" state. Once both peers have sent the request, the screen advances back to the multiplayer coin toss with the **same** PeerJS connection still alive. Match length is preserved; toss / role / result are cleared.
2. **Mid-flow disconnect awareness.** A top-level effect in [App.tsx](digit-cricket/src/App.tsx) watches the multiplayer status. If the peer connection drops while the user is on any active multiplayer screen (`multiplayerLobby` / `multiplayerMatchLength` / `multiplayerCoinToss` / `multiplayerBatOrBowl` / `multiplayerGameplay`), the user is routed back to the mode-select screen instead of being stuck waiting on a peer that's gone.

Singleplayer behaviour is unchanged in both cases.

## 24.2 Files touched

| File | What changed |
| --- | --- |
| [src/multiplayer/messages.ts](digit-cricket/src/multiplayer/messages.ts) | Added `REMATCH_REQUEST` to the `NetworkMessage` union. |
| [src/screens/MatchResultScreen.tsx](digit-cricket/src/screens/MatchResultScreen.tsx) | Added rematch-handshake state, REMATCH_REQUEST subscription, "Waiting for opponent…" UI, multiplayer-aware button copy. |
| [src/App.tsx](digit-cricket/src/App.tsx) | Simplified `handlePlayAgain` to route based on multiplayer status; added top-level disconnect-aware effect. |

No other files needed changes — the existing `multiplayerCoinToss` / `multiplayerBatOrBowl` / `multiplayerGameplay` screens already accept a fresh `tossOutcome` / `roleDecision` and the `GameplayScreen` resets its own per-match state from the props on mount.

## 24.3 The protocol extension

A single new message kind:

```ts
| { type: 'REMATCH_REQUEST' }
```

No payload — the message itself is the signal. Both peers can fire it independently; the handshake is "received it AND sent it locally → advance." This is the same shape we used for `MATCH_LENGTH` / `TOSS_CALL` / `TOSS_RESULT` / `ROLE_CHOICE` / `PICK` and keeps the protocol symmetric.

## 24.4 The rematch handshake (MatchResultScreen)

Two flags on the result screen:

```tsx
const [localRequested, setLocalRequested] = useState(false)
const [opponentRequested, setOpponentRequested] = useState(false)
```

- `localRequested` flips true when the user clicks **Play again** (multiplayer only).
- `opponentRequested` flips true when a `REMATCH_REQUEST` arrives.

A subscription effect listens for the incoming side, gated on `isMultiplayer` so singleplayer never opens a subscription:

```tsx
useEffect(() => {
  if (!isMultiplayer) return
  return subscribe((msg) => {
    if (msg.type === 'REMATCH_REQUEST') setOpponentRequested(true)
  })
}, [isMultiplayer, subscribe])
```

A second effect fires the parent callback once both sides agree:

```tsx
useEffect(() => {
  if (!isMultiplayer) return
  if (localRequested && opponentRequested) onPlayAgain()
}, [isMultiplayer, localRequested, opponentRequested, onPlayAgain])
```

The click handler is mode-aware:

```tsx
const handlePlayAgainClick = () => {
  if (!isMultiplayer) {
    onPlayAgain()
    return
  }
  sendNetwork({ type: 'REMATCH_REQUEST' })
  setLocalRequested(true)
}
```

Notice the order in the multiplayer branch: send first, then flip the local flag. If we flipped the flag first and the send threw (it can't today — `send` is a no-op when disconnected — but defensively), we'd be stuck showing "Waiting for opponent…" when the opponent never got our request. Send-then-flag means a failed send leaves the button clickable for retry on the next render.

## 24.5 Button UI states

The Play-again button has three visual states:

| State | When | UI |
| --- | --- | --- |
| Singleplayer | `!isMultiplayer` | "Play again" — fires immediately. |
| Multiplayer, idle | `isMultiplayer && !localRequested` | "Play again" — clicking sends REMATCH_REQUEST. |
| Multiplayer, waiting | `isMultiplayer && localRequested` | Disabled, label becomes "Waiting for opponent…", a `CircularProgress` + caption "Waiting for {opponentName} to confirm…" renders below. |

The Change Name button gets a slight copy tweak in multiplayer: it reads "Leave match" instead of "Change name" since it tears down the peer connection and bails to the welcome screen. The action is unchanged.

## 24.6 The App.tsx rewrite

`handlePlayAgain` is now just five lines:

```tsx
const handlePlayAgain = () => {
  setTossOutcome(null)
  setRoleDecision(null)
  setMatchResult(null)
  setScreen(multiplayerStatus === 'connected' ? 'multiplayerCoinToss' : 'coinToss')
}
```

It runs on the **second** activation in multiplayer (after the result screen's handshake) — by which point the connection is still alive and `multiplayerStatus === 'connected'` is true. So the user goes back to the multiplayer coin toss with the same opponent. `ballsPerInnings` is intentionally NOT cleared — that's the rematch contract.

The disconnect effect:

```tsx
useEffect(() => {
  if (multiplayerStatus === 'connected') return
  const activeMultiplayerScreens: ScreenName[] = [
    'multiplayerLobby',
    'multiplayerMatchLength',
    'multiplayerCoinToss',
    'multiplayerBatOrBowl',
    'multiplayerGameplay',
  ]
  if (activeMultiplayerScreens.includes(screen)) {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScreen('modeSelect')
  }
}, [multiplayerStatus, screen])
```

The list intentionally **does not include** `matchResult`. If the opponent leaves at the result screen, the local user can still see the score and manually click Leave / Play Again — Play Again falls through to the singleplayer route in that case (since `multiplayerStatus !== 'connected'`), which is a reasonable graceful degradation.

The local exit paths (Cancel from the lobby, Leave match from the result screen) set the screen explicitly **before** disconnecting, so by the time the effect re-runs the screen is no longer in the multiplayer list — the guard doesn't fire on intentional exits.

## 24.7 Sequence diagram — rematch

```
Virat (host)                         Rohit (joiner)
==============                       ==============

[MatchResultScreen]                  [MatchResultScreen]
       │                                    │
       ├─── click Play again ──┐            │
       │                       │            │
       │  send REMATCH_REQUEST ┼───────────►│
       │  setLocalRequested(t) │            │  setOpponentRequested(t)
       │                       │            │
       │ button: "Waiting…"    │            │
       │                       │            │
       │                       │  ◄───────── click Play again
       │                       │            │  setLocalRequested(t)
       │  ◄────────────────────┼──── send REMATCH_REQUEST
       │  setOpponentRequested(t)           │
       │                                    │
       ├── both flags true ───┐  ┌── both flags true ──┤
       │  onPlayAgain()       │  │  onPlayAgain()      │
       │                      │  │                     │
       ▼                      ▼  ▼                     ▼
[App: clear toss/role/result, route to multiplayerCoinToss]
       │                                    │
       ▼                                    ▼
[MultiplayerCoinTossScreen]          [MultiplayerCoinTossScreen]
```

The handshake is fully symmetric — neither peer is "host" of the rematch. Both flip both flags via the same code path; the order in which the two REMATCH_REQUESTs cross the wire doesn't matter. The connection from the original match is still open, so the next coin-toss screen reuses it immediately.

## 24.8 Sequence diagram — mid-flow disconnect

```
Virat (still in match)               Rohit (closes tab)
======================               ===================

[MultiplayerGameplayScreen]          [MultiplayerGameplayScreen]
       │                                    │
       │                              tab closed
       │                                    ▼
       │                              peer destroyed
       │
       │  ◄── conn.on('close') fires
       │  status: 'connected' → 'idle'
       │
       │ App-level useEffect fires:
       │   - status !== 'connected'
       │   - current screen is multiplayerGameplay (in the list)
       │   - setScreen('modeSelect')
       ▼
[ModeSelectionScreen]
```

There's no banner saying "opponent left" in this Part — they're just back at mode select. That's a deliberate scope cut: the alternative (a dedicated "Opponent disconnected" screen with explanatory copy) felt like polish that could wait. The empty-state-on-modeSelect is unambiguous enough — they were playing, now they're at mode select, ergo something dropped.

## 24.9 Gotchas

- **Why the handshake instead of one peer driving?** Either peer clicking Play Again could be the "host" of the rematch and broadcast a `REMATCH_START` that the other side adopts. But that means one peer waits for the other while seeing no UI feedback ("did my click register?"), and if the other peer never clicks, the first peer is stuck without any indication of why. A handshake lets both sides see "Waiting for opponent…" immediately on click, which is much clearer.
- **REMATCH_REQUEST is not re-armed.** Once a peer flips `opponentRequested` to true, it stays true for the lifetime of the screen mount. That's fine — when both flags hit true the screen unmounts via the effect that fires `onPlayAgain`. If we ever added a "Cancel rematch" button we'd need to add a `REMATCH_CANCEL` message and reset both flags; we haven't, so the simple boolean handshake works.
- **Subscription must unsubscribe.** The subscription effect returns the unsubscribe function directly (`return subscribe(...)`). Without that, navigating away with a pending subscription would leak — and worse, the listener would still flip `opponentRequested` on a stale state setter. The `MultiplayerProvider` subscription set is a `Set` (not an array), so re-subscribes after StrictMode double-invocation don't compound.
- **Disconnect effect lint disable.** `react-hooks/set-state-in-effect` flags the `setScreen` call inside the disconnect effect. The disable is correct here — this is exactly the case the rule is documented as not applying to (a side-effecting navigation in response to an external state change), but the rule can't tell. A single-line disable with no explanation is the standard pattern.
- **Why clear `tossOutcome` / `roleDecision` / `matchResult` but not `ballsPerInnings`?** The match length is the explicit contract of the room ("we're playing 6 balls"), agreed upon by the host's `MATCH_LENGTH` send. Clearing it would force the joiner-of-the-original-match to re-pick, which is wrong: only the host picks. Keeping it lets the rematch reuse the same agreed length.
- **What if the opponent leaves DURING the handshake?** Local user is in "Waiting for opponent…" state, then `multiplayerStatus` drops to `'idle'`. `isMultiplayer` becomes false, the handshake effect bails out, the button copy resets back to "Play again". Clicking it now does the singleplayer rematch path. Not a great UX (no banner saying "opponent left during rematch"), but not broken — and the user is one click away from a working singleplayer match.

## 24.10 Test instructions

You'll need two browser windows / two devices, same as previous Parts.

**Rematch happy path:**
1. Play a full multiplayer match through to the result screen on both windows.
2. Click **Play again** in window A. Verify button changes to disabled "Waiting for opponent…" with a spinner + caption "Waiting for {opponent name} to confirm…".
3. Window B still shows the active "Play again" button.
4. Click **Play again** in window B.
5. **Both** windows should immediately advance to the multiplayer coin toss.
6. The PeerJS connection should still be alive — check by completing the rematch flow without any reconnection prompt.
7. Window roles in the rematch (caller / roller) follow the same host/joiner mapping as the original match.

**Rematch from window B first:**
1. Same as above, but click Play again in window B first, then A.
2. Verify the same outcome — the handshake is order-independent.

**Mid-flow disconnect:**
1. Start a match. Get to the gameplay screen.
2. Close one window (or hit Refresh, or use DevTools to kill the tab).
3. The remaining window should auto-navigate to **ModeSelectionScreen** within ~1 second of the close event firing.
4. The remaining user can pick singleplayer or host/join a new room — no leftover state.

**Disconnect during lobby:**
1. Window A hosts, window B is on the join input but hasn't joined yet.
2. Close window A.
3. Window B doesn't notice anything (no connection was established) — when B submits the code it gets the "No room found with that code" error from PeerJS.

**Disconnect during result screen:**
1. Play a full match to the result screen.
2. Close window B.
3. Window A: button copy stays as "Play again" (because `isMultiplayer` falls to false). Clicking it does a singleplayer rematch using the same `ballsPerInnings`.
4. Or click **Leave match** to fully reset.

**Leave match button:**
1. On the result screen in multiplayer, verify the secondary button reads "Leave match" (not "Change name").
2. Click it. Verify it disconnects the peer and returns to the welcome screen (player name input).
3. Repeat in singleplayer — the button reads "Change name" and does the same reset, no disconnect (nothing to disconnect).

If the test fails:
- **Local window stuck on "Waiting for opponent…" after both have clicked** → check the browser console on both sides. Most likely the `REMATCH_REQUEST` message isn't crossing — try the connection's `data` event log in `peerClient.ts`.
- **Rematch lands on singleplayer coin toss instead of multiplayer** → `multiplayerStatus` was no longer `'connected'` when `handlePlayAgain` ran. The connection dropped between the click and the navigation. Re-test with both windows on the same network.
- **Mid-flow disconnect doesn't navigate** → check that the `MultiplayerProvider`'s `onDisconnected` callback actually flips `status` to `'idle'`. Add a `console.log` at the status setter to verify.
- **`useEffect` lint error appears in `App.tsx`** → the `eslint-disable-next-line` comment was lost or moved. It needs to sit on the line directly above `setScreen('modeSelect')`.

---

## 24.11 What this completes

The multiplayer flow now covers the full match lifecycle: lobby → match length → coin toss → bat/bowl → gameplay → result → rematch, with mid-flow disconnect handling for any link drop along the way. From a user's point of view, multiplayer is feature-equivalent to singleplayer at this point — every singleplayer entry point has a multiplayer counterpart.

Future Parts will likely focus on:
- Visual polish for the lobby (resolving the deferred room-code styling bug, plus loading-state transitions).
- A proper "Opponent disconnected" toast or banner so mid-flow drops have a textual explanation, not just a silent navigation.
- Reconnection support — if the peer connection is briefly interrupted (network blip), try to re-open before bailing to mode select.
- Stats / rematch counter — show "Rematch 2" / "Rematch 3" on the multiplayer coin toss so players can see how many in a row they've played.

---

# Conclusion — The full multiplayer build, step by step

This section retells the entire multiplayer implementation as one continuous story, in the order things were actually built. Read top-to-bottom and you should be able to reproduce the feature on a fresh checkout. Every step lists the files involved, the functions / logic added, and the reason behind the choice. Parts 19–24 above are the detailed checkpoints; this section is the executive summary.

## C.1 Architectural foundation (no code yet)

**Step 1 — Pick the transport.**
WebRTC peer-to-peer via the [PeerJS](https://peerjs.com/) library. No backend to host, signalling goes through PeerJS's free public broker, and once two peers are paired the data flows directly between browsers.

**Step 2 — Pick the topology.**
Symmetric. Both peers run the **same** XState cricket machine locally. The only thing that crosses the wire is each peer's pick on each ball plus a few handshake messages. No host-authoritative server, no asymmetric latency.

**Step 3 — Pick the room-code shape.**
6-character codes drawn from a 31-symbol unambiguous alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no `I`/`O`/`0`/`1`). The code IS the host's PeerJS peer ID, so the joiner just types it back to dial.

## C.2 The network layer

**Step 4 — Install PeerJS.**
```bash
npm install peerjs
```
Added to [package.json](digit-cricket/package.json) under `dependencies`. PeerJS ships its own TypeScript types, no `@types/peerjs` needed.

**Step 5 — Define the wire protocol.**
[src/multiplayer/messages.ts](digit-cricket/src/multiplayer/messages.ts) — a single discriminated union, one `type` literal per message kind:

```ts
export type NetworkMessage =
  | { type: 'HELLO'; name: string }
  | { type: 'MATCH_LENGTH'; balls: BallsPerInnings }
  | { type: 'TOSS_CALL'; side: Side }
  | { type: 'TOSS_RESULT'; result: Side }
  | { type: 'ROLE_CHOICE'; role: Role }
  | { type: 'PICK'; number: BallNumber }
  | { type: 'REMATCH_REQUEST' }
```

Plus a `MessageHandler = (msg: NetworkMessage) => void` alias for subscribers. Every new feature in Parts 19–24 added exactly one new variant — the protocol grew incrementally rather than being designed up-front.

**Step 6 — Wrap PeerJS in a testable class.**
[src/multiplayer/peerClient.ts](digit-cricket/src/multiplayer/peerClient.ts) — a `PeerClient` class with no React inside it. Surface area:
- `host()` → generates a code via `generateRoomCode()`, creates `new Peer(code)`, waits for the broker `open` event, returns the code. 15-second timeout via `setTimeout`. On a PeerJS `error` event the promise rejects with a friendly message (mapped by `describeError()` — `unavailable-id` / `peer-unavailable` / `network` / etc.).
- `join(code)` → creates `new Peer()` with a random ID, then `peer.connect(code, { reliable: true })`. Same timeout + error mapping as host.
- `attachConnection(conn)` — private. Wires the DataConnection's `open` / `data` / `close` / `error` events into the supplied callbacks. The `data` handler defensively checks `data && typeof data === 'object' && 'type' in data` before forwarding, so a malformed packet can't crash the app.
- `send(msg)` — `this.conn?.send(msg)` if open, else no-op (callers don't need to guard).
- `destroy()` — closes the connection and destroys the peer. Safe to call multiple times.

This is the only file that touches the PeerJS API directly. Everything above this layer talks to `PeerClient`.

**Step 7 — Bridge to React with a Provider + hook split.**
Two files, intentionally split for Fast Refresh compliance:

- [src/multiplayer/useMultiplayer.ts](digit-cricket/src/multiplayer/useMultiplayer.ts) — owns the `MultiplayerContext`, the `MultiplayerStatus` type (`'idle' | 'hosting' | 'joining' | 'connected' | 'error'`), the context value shape, and exports a `useMultiplayer()` hook that throws if used outside the provider.
- [src/multiplayer/MultiplayerProvider.tsx](digit-cricket/src/multiplayer/MultiplayerProvider.tsx) — owns the `PeerClient` instance via `useRef`, the subscriber `Set` (also a ref so it doesn't drive re-renders), and the React state slots (`status`, `isHost`, `roomCode`, `opponentName`, `errorMessage`). Functions exposed via context:
  - `ensureClient()` — lazily creates the `PeerClient` and wires its callbacks into the React state setters. The `onMessage` callback intercepts `HELLO` to pull out `opponentName`, then fans the message out to every subscriber.
  - `host()` / `join()` — flip status, call the matching `PeerClient` method, catch and surface errors via state.
  - `send()` — proxies to `clientRef.current?.send(msg)`.
  - `disconnect()` — destroys the client, clears subscribers, resets all state to `'idle'`.
  - `subscribe(handler)` — adds the handler to the set, returns an unsubscribe closure for use in `useEffect` cleanup.

Mounted at the app root in [src/main.tsx](digit-cricket/src/main.tsx), wrapping `<App />` alongside the existing `SoundProvider` / `StadiumModeProvider` / `StadiumReactionProvider`.

## C.3 Mode selection + lobby (Part 19)

**Step 8 — Branch the post-name-entry flow.**
Added `'singleplayer' | 'multiplayer'` to the [`GameMode`](digit-cricket/src/game/types.ts) type. [`ScreenName`](digit-cricket/src/game/types.ts) gained `'modeSelect'`, `'multiplayerLobby'`, `'multiplayerMatchLength'`, `'multiplayerCoinToss'`, `'multiplayerBatOrBowl'`, `'multiplayerGameplay'`.

**Step 9 — Build the mode chooser.**
[src/screens/ModeSelectionScreen.tsx](digit-cricket/src/screens/ModeSelectionScreen.tsx). Two tile buttons, primary/secondary colour-keyed. `onSelect(mode)` callback bubbles the choice up to App.

**Step 10 — Build the lobby.**
[src/screens/MultiplayerLobbyScreen.tsx](digit-cricket/src/screens/MultiplayerLobbyScreen.tsx). Three sub-views driven by a local `LobbyView = 'menu' | 'hosting' | 'joining'` state:
- `MenuView` — Host / Join / Back buttons.
- `HostingView` — three states inside it: "Reaching the signalling server…" (waiting for broker), "Room created" (code visible + Copy button + waiting indicator), or "Could not create room" (error message + retry).
- `JoiningView` — TextField for the code (uppercased, monospaced, 6-char max), Connect button.

Functions:
- `handleHost()` — flips view, calls `host()`.
- `handleJoinStart()` — flips view to the input form.
- `handleJoinSubmit()` — trims + uppercases the code, calls `join(code)`.
- `handleCancel()` — `disconnect()` + reset to menu.
- `handleCopy()` — `navigator.clipboard.writeText(roomCode)` with silent fallback.

A top-level `useEffect` watches `status`; the moment it becomes `'connected'` it sends `{ type: 'HELLO', name: playerName }` and fires `onConnected()` to advance App.

## C.4 Match-length sync (Part 20)

**Step 11 — Add MATCH_LENGTH to the protocol.**
One new variant in [messages.ts](digit-cricket/src/multiplayer/messages.ts).

**Step 12 — Build the multiplayer match-length picker.**
[src/screens/MultiplayerMatchLengthScreen.tsx](digit-cricket/src/screens/MultiplayerMatchLengthScreen.tsx). Branches on `isHost`:

- **Host view (`HostView`)** — same 6/12 tile buttons as the singleplayer screen. `handlePick(count)` sends `{ type: 'MATCH_LENGTH', balls: count }` AND immediately advances the host's own UI via `onMatchLengthSet(count)`.
- **Joiner view (`JoinerView`)** — spinner. A `useEffect` subscribes to `MATCH_LENGTH` and calls `onMatchLengthSet(msg.balls)` when it arrives.

This is the pattern the rest of the multiplayer screens follow: the actor of the moment sends the message AND advances its own UI; the recipient subscribes and adopts the value.

## C.5 Coin toss (Part 21)

**Step 13 — Add TOSS_CALL + TOSS_RESULT.**
Two new protocol variants. The joiner calls (heads or tails) and the host rolls the result. Host-authoritative randomness — only one side rolls so they can't disagree.

**Step 14 — Build the multiplayer coin toss screen.**
[src/screens/MultiplayerCoinTossScreen.tsx](digit-cricket/src/screens/MultiplayerCoinTossScreen.tsx). Local phase: `'awaiting' | 'rolling' | 'revealed'`.

- **Joiner** — clicks Heads/Tails → `handleJoinerCall(side)` stashes the call locally and sends `TOSS_CALL`. Then waits.
- **Host** — sits in `'awaiting'` with a spinner. The `useEffect` subscribed to messages catches `TOSS_CALL`, rolls `rollCoinSide()` (`Math.random() < 0.5 ? 'heads' : 'tails'`), stores the call + result locally, flips to `'rolling'`, and broadcasts `TOSS_RESULT`.
- **Joiner (again)** — its subscriber catches `TOSS_RESULT`, adopts the value, flips to `'rolling'`.

Both peers compute `targetRotation = 360 × FLIP_ROTATIONS + (result === 'tails' ? 180 : 0)` and animate the 3D coin to the same landing face. `handleContinue()` derives the winner from each side's local perspective (the joiner won if `userChoice === result`; host inverts) and hands a `TossOutcome` up to App.

## C.6 Bat-or-bowl decision (Part 22)

**Step 15 — Add ROLE_CHOICE.**
One protocol variant.

**Step 16 — Build the multiplayer bat/bowl screen.**
[src/screens/MultiplayerBatOrBowlScreen.tsx](digit-cricket/src/screens/MultiplayerBatOrBowlScreen.tsx). Branches on `localWonToss = tossOutcome.winner === 'player'`.

- **Toss winner** (`PickerView`) — two tile buttons. `handlePick(role)` sends `ROLE_CHOICE` and calls `onRoleSet({ chooser: 'player', role, firstInnings: deriveFirstInnings('player', role) })`.
- **Toss loser** (`WaitingView`) — spinner. A `useEffect` subscribes to `ROLE_CHOICE` and calls `onRoleSet({ chooser: 'computer', role: msg.role, firstInnings: deriveFirstInnings('computer', msg.role) })`.

`deriveFirstInnings(chooser, role)` is the pure helper that turns "I chose to bat" / "they chose to bowl" into a concrete `Innings` value. Both peers compute it from their local perspective.

## C.7 Gameplay (Part 23)

This is the load-bearing step. Reusing the singleplayer `GameplayScreen` instead of forking it.

**Step 17 — Extend the cricket machine with an optional opponent pick.**
[src/game/machine.ts](digit-cricket/src/game/machine.ts):

```ts
type CricketEvent = { type: 'PICK'; number: BallNumber; opponentPick?: BallNumber }
// In processBall:
const computerPick = event.opponentPick ?? randomBallNumber()
```

Singleplayer dispatches `{ type: 'PICK', number: 4 }` — `opponentPick` is undefined and `processBall` rolls a random 1-6 for the computer. Multiplayer dispatches `{ type: 'PICK', number: 4, opponentPick: 2 }` and `processBall` uses the supplied opponent pick. Same machine, same `processBall` logic, one optional field at the entry point.

**Step 18 — Parameterise `GameplayScreen` with an `opponentName` and a `mode` prop.**
[src/screens/GameplayScreen.tsx](digit-cricket/src/screens/GameplayScreen.tsx):

```tsx
type Props = {
  playerName: string
  opponentName: string  // "Computer" in singleplayer, opponent's name in multiplayer
  firstBatter: Innings
  ballsPerInnings: BallsPerInnings
  mode?: GameMode      // defaults to 'singleplayer'
  onComplete: (result: MatchResult) => void
}
```

No new screen file. The same component renders both flows.

**Step 19 — Add the local pick-collection state.**
Inside `GameplayScreen`, in multiplayer mode only:

```tsx
const [pendingPicks, setPendingPicks] = useState<{
  local: BallNumber | null
  opp: BallNumber | null
}>({ local: null, opp: null })
```

Both picks live in one object so the per-ball reset is one `setState` call (and one `eslint-disable-next-line`).

**Step 20 — Wire the three multiplayer effects.**

(a) **Subscribe to inbound PICK.** When a `PICK` message arrives, stash `msg.number` into `pendingPicks.opp`. Cleanup unsubscribes on unmount.

(b) **Dispatch when both picks are in.** When `pendingPicks.local !== null && pendingPicks.opp !== null && state.matches('awaitingPick')`, dispatch one `{ type: 'PICK', number: pendingPicks.local, opponentPick: pendingPicks.opp }` to the machine. The machine processes the ball and transitions to `revealing`.

(c) **Reset on ball transition.** When `ctx.ballsThisInnings` or `ctx.inningsNumber` changes, clear `pendingPicks` back to `{ local: null, opp: null }` so the next ball starts fresh.

**Step 21 — Update `handlePick(n)` to branch on mode.**

```tsx
const handlePick = (n: BallNumber) => {
  if (isMultiplayer) {
    if (pendingPicks.local !== null) return  // already picked
    setPendingPicks((prev) => ({ ...prev, local: n }))
    sendNetwork({ type: 'PICK', number: n })
  } else {
    send({ type: 'PICK', number: n })  // straight to the machine
  }
}
```

Singleplayer is unchanged. Multiplayer stashes locally and broadcasts; the dispatch happens in effect (b) once the opponent's pick arrives.

**Step 22 — Show a "waiting for opponent" hint.**
A `waitingForOpponent` flag is true when the local player has picked but the opponent hasn't. A `<CircularProgress>` + caption renders below the pick buttons in that state.

## C.8 Rematch + disconnect awareness (Part 24)

**Step 23 — Add REMATCH_REQUEST.**
One final protocol variant. No payload — the message itself is the signal.

**Step 24 — Wire the rematch handshake in `MatchResultScreen`.**
[src/screens/MatchResultScreen.tsx](digit-cricket/src/screens/MatchResultScreen.tsx). Two boolean flags, `localRequested` and `opponentRequested`. Three effects:

(a) Subscribe to `REMATCH_REQUEST` when `isMultiplayer`. On receive: `setOpponentRequested(true)`.

(b) Watch both flags. When `localRequested && opponentRequested`, fire the parent's `onPlayAgain()` callback.

(c) The click handler `handlePlayAgainClick()`:

```tsx
const handlePlayAgainClick = () => {
  if (!isMultiplayer) {
    onPlayAgain()  // singleplayer fires immediately
    return
  }
  sendNetwork({ type: 'REMATCH_REQUEST' })
  setLocalRequested(true)
}
```

UI states the button cycles through: "Play again" → (clicked) → disabled "Waiting for opponent…" with a spinner + caption "Waiting for {opponentName} to confirm…" → (opponent confirms) → screen advances. The secondary button copy switches between "Change name" (singleplayer) and "Leave match" (multiplayer).

**Step 25 — Route the rematch in App.tsx.**
[src/App.tsx](digit-cricket/src/App.tsx). `handlePlayAgain()` becomes a one-liner branch:

```tsx
const handlePlayAgain = () => {
  setTossOutcome(null)
  setRoleDecision(null)
  setMatchResult(null)
  setScreen(multiplayerStatus === 'connected' ? 'multiplayerCoinToss' : 'coinToss')
}
```

`ballsPerInnings` is deliberately NOT cleared — the match length is the contract of the room, agreed at hosting time.

**Step 26 — Add mid-flow disconnect awareness.**
A top-level `useEffect` in `App.tsx` watches `multiplayerStatus`. If it drops below `'connected'` while the user is on any active multiplayer screen (lobby / matchLength / coinToss / batOrBowl / gameplay), navigate them back to `'modeSelect'` so they're never stuck waiting on a vanished peer. The local exit paths (Cancel / Leave match) navigate explicitly before disconnecting, so they don't trip this guard.

## C.9 The data-flow recap

Here's how a single ball in multiplayer travels through the system from button press to scoreboard update on both peers:

```
1. Virat clicks "4"
   └─ GameplayScreen.handlePick(4)
      ├─ setPendingPicks({ local: 4, opp: null })
      └─ multiplayerCtx.send({ type: 'PICK', number: 4 })
         └─ MultiplayerProvider.send
            └─ PeerClient.send
               └─ DataConnection.send  ─────────── network ──────────►

2. Rohit's PeerClient receives the message
   └─ DataConnection.on('data', ...)
      └─ PeerClient callbacks.onMessage
         └─ MultiplayerProvider.onMessage
            └─ subscribers.forEach(handler => handler(msg))
               └─ GameplayScreen's subscribe callback fires
                  └─ setPendingPicks(prev => ({ ...prev, opp: 4 }))

3. Rohit has also clicked his number (say "2") locally — same path as step 1.
   Now pendingPicks = { local: 2, opp: 4 } on Rohit's side.

4. Rohit's "both picks in" effect fires:
   └─ send({ type: 'PICK', number: 2, opponentPick: 4 })
      └─ cricketMachine processes the ball deterministically.
      └─ Machine transitions to 'revealing'.
      └─ Score, lastBall, events all update in CricketContext.

5. Virat goes through the same flow with his { local: 4, opp: 2 } picks.
   Same processBall → same lastBall → same scores. Two independent machines,
   one shared truth.
```

## C.10 Files map of the multiplayer build

Created from scratch for multiplayer:

```
src/multiplayer/messages.ts                       # Network protocol union
src/multiplayer/peerClient.ts                     # PeerJS wrapper class
src/multiplayer/useMultiplayer.ts                 # Context + hook
src/multiplayer/MultiplayerProvider.tsx           # Provider that owns PeerClient
src/screens/ModeSelectionScreen.tsx               # Singleplayer / multiplayer fork
src/screens/MultiplayerLobbyScreen.tsx            # Host / join lobby
src/screens/MultiplayerMatchLengthScreen.tsx      # Host picks, joiner adopts
src/screens/MultiplayerCoinTossScreen.tsx         # Joiner calls, host rolls
src/screens/MultiplayerBatOrBowlScreen.tsx        # Toss winner picks, loser waits
```

Touched to support multiplayer alongside singleplayer:

```
src/game/types.ts                                 # +GameMode, +multiplayer screen names
src/game/machine.ts                               # PICK gained optional opponentPick
src/screens/GameplayScreen.tsx                    # Reused for both modes (mode prop)
src/screens/MatchResultScreen.tsx                 # Rematch handshake + leave-match copy
src/App.tsx                                       # Multiplayer routes + disconnect guard
src/main.tsx                                      # MultiplayerProvider mounted at root
package.json                                      # +peerjs
```

## C.11 What you'd type into a fresh checkout to rebuild this

For anyone reading this from scratch, here's the chronological action list:

1. `npm install peerjs` and commit `package.json` + `package-lock.json`.
2. Create `src/multiplayer/messages.ts` with the first version of `NetworkMessage` (just `HELLO`).
3. Create `src/multiplayer/peerClient.ts` with `PeerClient` (host / join / send / destroy + error mapping).
4. Create `src/multiplayer/useMultiplayer.ts` (context + hook + `MultiplayerStatus` type).
5. Create `src/multiplayer/MultiplayerProvider.tsx` (state slots + callbacks wiring + subscribe set).
6. Mount `<MultiplayerProvider>` in `src/main.tsx` around `<App />`.
7. Add `'modeSelect'` etc. to `ScreenName`; add `GameMode` to `src/game/types.ts`.
8. Create `src/screens/ModeSelectionScreen.tsx` and wire it into `App.tsx` (post-name-entry fork).
9. Create `src/screens/MultiplayerLobbyScreen.tsx` (menu / hosting / joining sub-views) and wire it for `screen === 'multiplayerLobby'`.
10. Verify Part 19: open two browser windows, host one, join the other, both reach `status === 'connected'`.
11. Add `MATCH_LENGTH` to `NetworkMessage`. Create `MultiplayerMatchLengthScreen.tsx` (host picks + sends; joiner subscribes + adopts). Wire into `App.tsx`.
12. Verify Part 20: host picks 6, joiner auto-advances to coin toss with `ballsPerInnings = 6`.
13. Add `TOSS_CALL` + `TOSS_RESULT`. Create `MultiplayerCoinTossScreen.tsx` (joiner calls; host rolls; both animate). Wire into `App.tsx`.
14. Verify Part 21: joiner clicks Heads, host rolls, both windows land on the same face with consistent winner.
15. Add `ROLE_CHOICE`. Create `MultiplayerBatOrBowlScreen.tsx` (winner picks + broadcasts; loser subscribes). Wire into `App.tsx`.
16. Verify Part 22: toss winner picks Bat, both peers advance with consistent `RoleDecision`.
17. Add `PICK` to `NetworkMessage`. Extend `CricketEvent` in `machine.ts` with optional `opponentPick`; have `processBall` consume it.
18. Add the `pendingPicks` state + three multiplayer effects to `GameplayScreen.tsx`. Update `handlePick` to branch on mode. Add `opponentName` and `mode` props. Pass `mode="multiplayer"` from `App.tsx` for the multiplayer route.
19. Verify Part 23: play a full multiplayer match end-to-end. Both windows show identical scores / events. `MatchResultScreen` displays the result.
20. Add `REMATCH_REQUEST`. Wire the handshake (`localRequested` + `opponentRequested`) into `MatchResultScreen.tsx`. Update the click handler. Branch button copy.
21. Update `handlePlayAgain` in `App.tsx` to route to `multiplayerCoinToss` when connected; add the top-level disconnect-aware `useEffect`.
22. Verify Part 24: rematch handshake works; mid-flow disconnect bounces the surviving peer to mode select.

That's the whole multiplayer feature. Six files of new code, five files of careful additions, no backend, no database, no auth. Roughly 1,400 lines of production code (excluding docs and tests) for a complete peer-to-peer multiplayer experience riding on a free public broker.

---

_Future Parts (25+) will be appended below as they land._
