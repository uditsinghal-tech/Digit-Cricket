# Digit Cricket — Single Player Build

A feature-by-feature narrative of how the single-player game was built. Where `doc.md` walks the build Part by Part with all the detail of each checkpoint, this file is the high-level read: what was implemented, the logic behind it, and how it was wired together.

Read this top-to-bottom for the story; jump into `doc.md` if you need the granular per-Part diff.

---

## Project overview

Digit Cricket is a frontend-only browser game built around the classic hand-cricket rule:

- Each ball, both batter and bowler pick a number **1–6**.
- If the numbers **match**, the batter is **OUT** and the innings ends.
- If they **don't** match, the batter scores the **batter's pick** as runs.
- An innings lasts up to a configurable number of balls (6 or 12).

The match runs through five screens:

```
Welcome → Match Length → Coin Toss → Bat or Bowl → 6/12-ball Gameplay → Result
```

The single-player opponent (the computer) picks uniformly at random. Every visual and audio cue is generated client-side — no external services, no backend.

---

## Tech stack and why

| Layer       | Choice                  | Reason                                                                                              |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| UI          | **React 18 + TypeScript** | Hooks-first composition with type safety across props, screens, and machine context.                |
| Build       | **Vite**                  | Instant HMR, zero-config TypeScript, sub-second production builds.                                  |
| Styling     | **MUI v6 + plain CSS**   | MUI for primitives (`Box`, `Stack`, `Button`, `Chip`, `IconButton`); custom CSS for the stadium SVG. |
| Animation   | **Framer Motion v12**    | Declarative animations for screen transitions, coin flip, picks reveal, score/trophy entrances.     |
| State       | **XState v5**            | The cricket rules are a finite state machine; XState makes the transitions explicit and testable.   |
| Lint/Format | **ESLint flat + Prettier** | Consistent code style; flat config for the ESLint 9+ era.                                          |

---

## Architecture at a glance

### Provider stack (`src/main.tsx`)

```
<ThemeProvider>          ← MUI dark theme
  <CssBaseline />        ← MUI normalize
  <SoundProvider>        ← mute state, master gain, crowd.mp3 + speech commentary
    <StadiumModeProvider>      ← day / night palette, persisted to localStorage
      <StadiumReactionProvider>← per-event crowd colour reactions
        <App />
```

### Screen router (`src/App.tsx`)

`App` is a tiny state machine of its own: a `ScreenName` enum value picks which screen renders inside `<AnimatePresence mode="wait">`, and a handful of `useState` slots carry the match data (`playerName`, `ballsPerInnings`, `tossOutcome`, `roleDecision`, `matchResult`) forward through the flow.

### The XState machine (`src/game/machine.ts`)

The single source of truth for the gameplay rules.

```
awaitingPick ──PICK──► revealing ──(after 1.9s)──► evaluating
                                                       │
                       ┌───────────────────────────────┤
                       │                               │
                       ▼               ▼               ▼
                 awaitingPick   switchingInnings   complete
                                      │
                                  awaitingPick
```

- `processBall` action: rolls the computer's 1-6 pick, decides if it's a wicket, adds runs to the batting side.
- `switchInnings` action: flips the batter, sets `inningsNumber = 2`, seeds the chase target as `firstInningsScore + 1`.
- `matchOver` guard: innings 2 ends when the chaser hits the target OR is out OR finishes all the balls.
- `firstInningsOver` guard: innings 1 ends on out OR after all the balls.

The machine takes an `input` of `{ playerName, firstBatter, ballsPerInnings }` and the view (`GameplayScreen`) projects from its `context`.

### File layout

```
src/
  App.tsx                Top-level screen router
  main.tsx               Entry — mounts the four provider layers + <App />
  theme.ts               MUI dark theme
  App.css                App-shell layout + the gradient title class
  index.css              Global resets

  components/
    StadiumBackground.tsx   Animated SVG stadium behind every screen
    StadiumBackground.css   CSS variables for day/night palette + crowd reaction keyframes
    AnimatedFace.tsx        Mood-aware player avatar
    MuteToggle.tsx          Top-right mute toggle
    DayNightToggle.tsx      Top-right day/night toggle

  audio/
    sounds.ts               Web Audio API graph + crowd.mp3 + speech commentary
    useSounds.ts            SoundContext + useSounds() hook
    SoundProvider.tsx       Provider that persists mute state, starts the crowd

  stadium/
    useStadiumReaction.ts   StadiumReactionContext + hook
    StadiumReactionProvider.tsx  Provider with auto-clear timer
    useStadiumMode.ts       StadiumModeContext + hook
    StadiumModeProvider.tsx Provider that persists day/night choice

  game/
    types.ts                All shared types and constants
    machine.ts              The XState cricket machine

  screens/
    PlayerNameScreen.tsx    Welcome + name validation
    MatchLengthScreen.tsx   6-ball or 12-ball selection
    CoinTossScreen.tsx      3D coin flip with heads/tails call
    BatOrBowlScreen.tsx     Player or computer picks bat/bowl
    GameplayScreen.tsx      Drives the cricket machine; scoreboard, picks, 1-6 buttons
    MatchResultScreen.tsx   Trophy + headline + innings breakdown + play-again

public/
  sounds/crowd.mp3          Looping crowd ambience (real recording)
```

---

## Features, in the order they were built

### 1. Welcome screen — name entry

**What**: a form that captures the player's name with light validation.

**Logic**: trim the input, block empty names, cap at 20 characters. Errors only show after the field has been touched (blur or submit), so the user isn't yelled at on first paint.

**Implementation**: `PlayerNameScreen` is a `<form>` whose submit handler calls back to `App.handleNameSubmit(name)`. Local `useState` for the input and a `touched` flag. Framer Motion fade-up entrance on the container; the cricket bat icon springs in at 0.15s.

---

### 2. Match length selection — 6 ball or 12 ball

**What**: between name entry and the toss, the player picks how many balls per innings.

**Logic**: a typed literal union `BallsPerInnings = 6 | 12` carries the choice through `App` state into the cricket machine's `input`. The machine stores it in `context.ballsPerInnings`, and the guards (`matchOver`, `firstInningsOver`) compare `ballsThisInnings >= context.ballsPerInnings`.

**Why a literal union (not `number`)**: compile-time checking of every state initialiser, prop, and machine input against the same two options. Adding a future "24 Ball Game" is a one-line union extension and TypeScript flags every place that needs updating.

**Implementation**: `MatchLengthScreen` renders two tile buttons. Selecting one calls `App.handleMatchLengthSelect(count)`, which stores the value and routes to the coin toss.

---

### 3. Coin toss — 3D-feeling flip

**What**: player calls Heads or Tails; a coin spins and lands; the toss winner is declared.

**Logic**: when the player picks, we immediately randomise the landing side and store it. The coin then animates `rotateY` from 0 to `360 × 4 + (tails ? 180 : 0)` — four full rotations for momentum, plus a half-turn if and only if the result is tails. The math ensures the coin **lands** on the correct face rather than jumping to it.

**Why a 3-phase local machine instead of XState**: the coin toss has exactly three phases (`'choosing' | 'flipping' | 'revealed'`) and lives entirely inside one screen. `useState<Phase>` is the right tool. XState is reserved for the gameplay rules.

**Implementation**: `CoinTossScreen` owns the phase and the user pick. The 3D coin is two absolutely-positioned `<CoinFace>` divs inside a `transformStyle: 'preserve-3d'` parent, with the back face pre-rotated 180° on Y. `backface-visibility: hidden` hides whichever face isn't currently facing camera. Framer Motion's `onAnimationComplete` callback flips the phase from `flipping` to `revealed` so timing stays synced with the animation duration.

---

### 4. Bat or Bowl — branching for who chooses

**What**: the toss winner picks Bat or Bowl. If the player won, they pick directly. If the computer won, it picks for itself after a brief "thinking" delay.

**Logic**: `deriveFirstInnings(chooser, role)` maps `(toss winner, their pick)` to who actually bats first:

- Chooser bats → chooser is first innings.
- Chooser bowls → the other side is first innings.

**Why the "computer is thinking…" delay**: the random pick is instantaneous, but skipping straight to the decision makes the computer feel like a sticker, not an opponent. A short `setTimeout(1.6s)` + spinner sells the illusion of deliberation.

**Implementation**: `BatOrBowlScreen` starts in phase `'choosing'` if the player won the toss, otherwise `'computing'`. A `useEffect` watches the computing phase and fires the random pick after the delay, then advances to `'decided'`. Cleanup `clearTimeout` makes the effect safe under React 18 StrictMode's double-invocation.

---

### 5. Gameplay — XState-driven 6/12-ball innings

**What**: the actual cricket. Both teams bat for the chosen number of balls (or until out); whoever scores more wins.

**Logic**: the cricket state machine is the brain.

1. Player presses a number 1-6 → `send({ type: 'PICK', number })`.
2. Machine fires the `processBall` action:
   - Generates the computer's 1-6 random pick.
   - Decides batter/bowler based on `currentBatter`.
   - `isOut` = `batterPick === bowlerPick`.
   - Runs = `isOut ? 0 : batterPick`.
   - Updates score on the batting side, appends a `BallEvent` to the events log.
3. Machine transitions to `revealing`, where it waits 1.9s via `after: { 1900: 'evaluating' }`.
4. The view choreographs the reveal inside that 1.9s window: player pick lands at 0s, computer pick at 0.6s, outcome chip at 1.1s.
5. The transient `evaluating` state runs an `always` array of guards in priority order:
   - `matchOver` (innings 2 + (target reached OR out OR balls done)) → `complete`.
   - `firstInningsOver` (innings 1 + (out OR balls done)) → `switchingInnings`.
   - Default → back to `awaitingPick` for the next ball.

**Why the random pick lives in the machine action, not the view**: it makes the machine the single source of truth. The view becomes a pure projection — `useMachine` hands back state, the view renders it. The whole match can be replayed deterministically from the event log without touching the view.

**Implementation**: `GameplayScreen` uses `useMachine(cricketMachine, { input })`. The scoreboard reads `ctx.playerScore`, `ctx.computerScore`, `ctx.ballsThisInnings`, `ctx.ballsPerInnings`, and `ctx.target`. The pick cards read `ctx.lastBall`. The 1-6 buttons are disabled outside `awaitingPick`. When the machine reaches `complete`, a `useEffect` bubbles a `MatchResult` payload up to `App`.

---

### 6. Result and play-again

**What**: trophy, headline, score side-by-side, ball-by-ball innings breakdown, and two restart paths.

**Logic**:
- `deriveWinner(ctx)`: returns `'player' | 'computer' | 'tie'` from the final scores.
- Player won → `playerMood: 'happy'`, computer is sad, **confetti** falls.
- Computer won → mirror; no confetti (no mocking on a loss).
- Tie → both neutral.

The result reveal is staged: trophy spring-in at 150ms, headline at 400ms, sub-line at 550ms, winner badge at 700ms, per-ball pills start at 800ms / 1000ms (one per innings, 50ms stagger between pills), buttons at 900ms. The sequence gives the player a moment to absorb the result before reaching for "Play Again".

**Two restart paths**:
- **Play Again**: keeps `playerName` AND `ballsPerInnings`; routes straight to the coin toss. Two clicks to next match.
- **Change Name**: full reset including name and length; back to the welcome screen.

**Implementation**: `MatchResultScreen` reads the `MatchResult` from props, builds the headline / sub-line / mood mapping, and renders four blocks (trophy+headline, scores card with mood faces, two `InningsRow` strips of `BallPill` chips, button stack). The `<Confetti>` overlay mounts only when `playerWon === true`.

---

### 7. Stadium background — animated SVG scene

**What**: a fixed-position animated SVG cricket stadium that sits behind every screen.

**Layers (back to front)**:
1. Sky gradient (CSS variables drive the colour; day/night toggle swaps the palette).
2. Twinkling stars (Framer Motion per-star opacity loops; in a `night-only` group that fades out in day mode).
3. Sun (in a `day-only` group; layered circles + radial gradient).
4. Drifting clouds (two layers, different speeds, classed `cloud-blob` so fill/opacity swap by mode).
5. Four pulsing floodlights (each in its own `<g>`; the whole set is wrapped in `floodlight-set` whose opacity dims to 0.12 in day mode).
6. Stadium seating tiers (two layered paths).
7. **Crowd** — 750 dots across 10 rows.
8. Field ellipse, boundary line, pitch.
9. Vignette overlay (variable-driven, softer in day mode).

**Performance choice**: the 750-dot crowd uses **CSS `@keyframes`** for its reactions, not Framer Motion. With 750 elements all animating simultaneously, Framer's per-element JS animation engine would have bottlenecked; CSS keyframes run on the GPU compositor. Same reason the day/night palette swap is CSS-variable transitions, not Framer animations.

**Implementation**: `StadiumBackground.tsx` builds the SVG; `StadiumBackground.css` holds the day/night CSS variables, the four idle crowd-dot shade classes, and the five reaction keyframes.

---

### 8. Animated player faces — mood-aware avatars

**What**: little SVG portraits of the two players, sitting in the scoreboard and on the result screen, with expressions that reflect the latest ball.

**Logic**: `deriveMood(perspective, ctx, isRevealing)`:
- If we're not in `revealing`, or there's no `lastBall`: `'neutral'`.
- If `perspective` was the batter on the last ball: `'sad'` on out, `'happy'` on runs.
- Otherwise (`perspective` was the bowler): inverted — `'happy'` on out, `'sad'` on runs.

On the result screen, mood is derived once from the final `winner` (winner → happy, loser → sad, tie → neutral) rather than per-ball.

**Implementation**: `AnimatedFace.tsx` is a small SVG with a coloured head, a cricket cap, two eyes that blink on a 3.2s loop (player and computer offset by 0.7s so they don't blink in sync), and a mouth shape that swaps between `path` keyframes for smile / frown / line. The whole face does a 2.6s vertical bob for a "breathing" feel.

---

### 9. Crowd reactions — visual

**What**: the 750-dot crowd flashes a colour wave on every boundary, wicket, and match-end event.

**Logic**: a tiny global `StadiumReactionContext` exposes:
- `reaction: 'four' | 'six' | 'wicket' | 'win' | 'lose' | null`
- `triggerReaction(kind)` — sets the value and auto-clears it after 1.8s.

The screens (`GameplayScreen` per ball, `MatchResultScreen` on win/lose) call `triggerReaction(name)` next to `play(name)` for the audio. `StadiumBackground` reads `reaction` and sets `className="crowd crowd--four"` (or whichever) on the crowd `<g>`. The CSS handles the rest:

```css
.crowd--four .crowd-dot {
  animation: crowd-four 1.6s ease-out var(--stagger-delay, 0s);
}
```

Each dot has its `--stagger-delay` set inline based on its x position, so the colour wave **ripples left-to-right** across the seating bowl over ~350ms.

**Why a separate context (not just bus events)**: React's context model + `setState` give automatic re-render on change, and the 1.8s auto-clear is easier to express as a `setTimeout` inside a provider than as a window event listener.

---

### 10. Sound — recorded crowd + speech commentary

**What**:
- A **looping crowd recording** (`public/sounds/crowd.mp3`) plays continuously once the user has interacted with the page.
- On boundaries, wickets, and match-end, the crowd's gain temporarily **boosts** (sounds louder) AND a male voice **calls the moment** — "That's a boundary!", "Wow, that's a six!", "Clean bowled!".

**Logic**:
- The audio graph is one `AudioContext` with a single master `GainNode`. Everything else feeds into master; muting is a single ramp to 0.
- The crowd mp3 plays through an `HTMLAudioElement` whose output is routed into the Web Audio graph via `createMediaElementSource()`. That puts it under our gain control just like a synthesised source would be.
- `boostCheer(peak, duration)` ramps `crowdGain` to `peak` over 100ms and back to baseline (`0.4`) over `duration` seconds — a swell that says "the crowd reacted".
- Commentary uses `window.speechSynthesis` (Web Speech API), picking a deeper English voice when one is installed, with pitch lowered to `0.92` and rate to `0.95` so it lands closer to "commentator" than "GPS direction".
- Mute (top-right toggle) does two things: ramps `masterGain` to 0 over 80ms AND calls `speechSynthesis.cancel()` so a mid-sentence mute actually silences the page.

**Why a real recording instead of synthesised noise**: an earlier pass tried synthesising the crowd with filtered pink noise + scheduled voice bursts + claps. It sounded ambient but never quite "stadium" — at best it read as static, at worst as a sparse audio art project. A 600KB looping recording dropped into `public/sounds/` is dramatically more convincing and adds essentially no complexity.

**Why a one-shot listener pattern for autoplay**: browsers block `AudioContext` and `audio.play()` outside a user gesture. `SoundProvider` attaches one-shot `pointerdown` / `keydown` / `touchstart` listeners on mount, and the first one to fire calls `startCrowd()`. Inside that gesture, the AudioContext creates running and the audio element plays without rejection.

---

### 11. Day / Night toggle

**What**: a top-right sun/moon button flips the stadium between night (default) and day palettes.

**Logic**: the toggle writes to a context (`useStadiumMode`); the wrapper `<div>` in `StadiumBackground` toggles between `className="stadium"` and `className="stadium stadium--day"`. CSS variables on each class drive every colour:

```css
.stadium       { --sky-top: #080524; --field-top: #15803d; ... }
.stadium--day  { --sky-top: #93c5fd; --field-top: #4ade80; ... }
```

SVG gradient stops use `style={{ stopColor: 'var(--sky-top)' }}`, and a CSS `transition: stop-color 1s ease` rule on every `<stop>` makes the change a smooth crossfade. Stars are in a `night-only` group, the sun in a `day-only` group — both bound by their `opacity: var(--night-opacity)` / `var(--day-opacity)`. Floodlights stay on but their group opacity multiplies to `0.12` in day.

**Why CSS variables instead of Framer Motion**: variable transitions are GPU-cheap, animate every dependent property in lock-step, and don't require per-element animation controllers. The mode swap is a one-line className change on the wrapper.

**Persistence**: `localStorage` key `digit-cricket:stadium-mode`. The mute preference and the day/night preference are persisted separately.

---

### 12. Mute toggle

**What**: a top-right speaker icon that silences (or restores) all game audio.

**Logic**: `useSounds` exposes `{ muted, toggleMute, play }`. `muted` is persisted in `localStorage` under `digit-cricket:muted` and ramps `masterGain` between 0 and 1 over 80ms when flipped. While muted, `play()` short-circuits before scheduling new sounds, and `speechSynthesis.cancel()` kills any in-flight commentary.

**Implementation**: `MuteToggle.tsx` is a fixed-position `IconButton` with a `VolumeUp` / `VolumeOff` swap. The day/night toggle sits 60px to its left, both styled with the same frosted-glass look so they read as a single utility cluster.

---

## Cross-cutting design choices

### Why each provider is split across two files

`SoundProvider` lives in `SoundProvider.tsx`; the hook + context in `useSounds.ts`. Same split for the two stadium providers. The reason is React Fast Refresh: its `react-refresh/only-export-components` rule complains when a `.tsx` file exports both a component and a non-component value. Splitting into a `.ts` module (hook + context) and a `.tsx` module (provider component) keeps Fast Refresh fast and the dependency direction explicit.

### Why every screen owns its own `containerVariants`

Each screen file defines its own Framer Motion `containerVariants` for the fade-up entrance / fade-out exit. They look identical because they were intentionally kept identical — the same enter/exit feel across the whole flow. Centralising them was considered, but the win is small (~10 lines saved) and the cost is one more cross-file dependency. Local copy wins on simplicity.

### Why `useEffect` callbacks always clean up `setTimeout`s

React 18 StrictMode in dev double-invokes effects to catch missing cleanup. Every `setTimeout`-using effect in the codebase returns `() => clearTimeout(...)`, so the second invocation cancels the first timer cleanly. Without the cleanup, the "computer is thinking" spinner would resolve twice, the per-ball sound would schedule twice, etc.

### Why the result screen's mood is derived from `winner` (not `lastBall`)

On the gameplay screen, mood is per-ball — batter goes happy on runs, sad on out. On the result screen, the "feeling" is about the whole match, not the last ball. Deriving from `winner` lets the loser frown even if they got the wicket on the last ball, and lets the winner smile even if they finished by getting bowled themselves.

---

## How to run

```bash
npm install
npm run dev      # http://localhost:5173 — Vite HMR
npm run build    # production build into dist/
npm run preview  # serve the dist/ build locally
npm run lint     # ESLint check
npm run format   # Prettier write
```

See `doc.md` for the full Part-by-Part development history. This file is the "what" and "how"; `doc.md` is the "when" and "why".
