# Digit Cricket

Browser-based hand cricket. Enter a name, win the toss (or don't), pick bat or bowl, play six balls each, see who wins.

## Stack

React 18 · TypeScript · Vite · Material UI · Framer Motion · XState · ESLint + Prettier.

## Getting started

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
```

## Scripts

| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the dev server with HMR         |
| `npm run build`     | Type-check and produce a prod bundle  |
| `npm run preview`   | Serve the production build locally    |
| `npm run lint`      | ESLint check                          |
| `npm run lint:fix`  | ESLint check with auto-fix            |
| `npm run format`    | Prettier write                        |

## Project layout

```
src/
  App.tsx                  Top-level screen router
  main.tsx                 Entry point (mounts ThemeProvider + App)
  theme.ts                 MUI dark theme
  App.css                  App shell layout + the gradient title class
  index.css                Global resets

  components/
    StadiumBackground.tsx  Animated SVG stadium behind every screen
    AnimatedFace.tsx       Mood-aware player avatar

  game/
    types.ts               Shared types and constants
    machine.ts             XState cricket machine (the game engine)

  screens/
    PlayerNameScreen.tsx   Welcome / name entry
    CoinTossScreen.tsx     Heads or tails
    BatOrBowlScreen.tsx    Bat or bowl decision (player or computer)
    GameplayScreen.tsx     6-ball innings, driven by the machine
    MatchResultScreen.tsx  Final result, ball-by-ball summary, play-again
```

See [`doc.md`](./doc.md) for the build history Part by Part.
