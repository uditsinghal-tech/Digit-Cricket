import { assign, setup } from 'xstate'
import {
  BALL_NUMBERS,
  type BallEvent,
  type BallNumber,
  type BallsPerInnings,
  type Innings,
  type MatchWinner,
  type TotalInnings,
} from './types'

export type CricketContext = {
  playerName: string
  firstBatter: Innings
  currentBatter: Innings
  // Widened from 1|2 to 1..4 to support the 4-innings test match format.
  // For a standard 2-innings match this still only ever reaches 2.
  inningsNumber: 1 | 2 | 3 | 4
  ballsThisInnings: number
  ballsPerInnings: BallsPerInnings
  // Total innings the match runs for. Drives the matchOver and switch
  // guards generically so the same machine handles both formats.
  totalInnings: TotalInnings
  playerScore: number
  computerScore: number
  target: number | null
  lastBall: BallEvent | null
  events: BallEvent[]
}

type CricketInput = {
  playerName: string
  firstBatter: Innings
  ballsPerInnings: BallsPerInnings
  // Optional for backward compatibility — callers that don't pass it get
  // the original 2-innings behaviour.
  totalInnings?: TotalInnings
}

// The PICK event carries the local player's pick. In multiplayer the view
// also supplies the opponent's pick (received over the network); in
// singleplayer it's omitted and processBall rolls a random one instead.
type CricketEvent = { type: 'PICK'; number: BallNumber; opponentPick?: BallNumber }

// How long the machine lingers in the `revealing` state so the view can
// stagger the player pick, computer pick, and outcome chip on screen.
const REVEAL_DURATION_MS = 1900

// Uniformly random pick between 1 and 6 — the computer's move on every ball.
// Range is tied to BALL_NUMBERS (1..6), independent of how many balls per innings.
function randomBallNumber(): BallNumber {
  return (Math.floor(Math.random() * BALL_NUMBERS.length) + 1) as BallNumber
}

// Reads the running score for the given side out of the machine context.
function scoreFor(side: Innings, ctx: CricketContext): number {
  return side === 'player' ? ctx.playerScore : ctx.computerScore
}

// The cricket state machine. States: awaitingPick → revealing → evaluating
// → (awaitingPick | switchingInnings | complete). All game rules live in the
// `processBall` / `switchInnings` actions and the two guards below.
export const cricketMachine = setup({
  types: {
    context: {} as CricketContext,
    events: {} as CricketEvent,
    input: {} as CricketInput,
  },
  actions: {
    // Runs once per PICK event. Rolls the computer's number, decides if it's
    // a wicket, adds runs to the batting side, and appends the ball event.
    processBall: assign(({ context, event }) => {
      const playerPick = event.number
      // Multiplayer supplies the opponent's pick via the event; singleplayer
      // leaves it undefined and we roll a random 1-6 here instead.
      const computerPick = event.opponentPick ?? randomBallNumber()

      const playerIsBatting = context.currentBatter === 'player'
      const batterPick = playerIsBatting ? playerPick : computerPick
      const bowlerPick = playerIsBatting ? computerPick : playerPick

      const isOut = batterPick === bowlerPick
      const runs = isOut ? 0 : batterPick

      const ballEvent: BallEvent = {
        innings: context.inningsNumber,
        batter: context.currentBatter,
        batterPick,
        bowlerPick,
        runs,
        isOut,
      }

      return {
        ballsThisInnings: context.ballsThisInnings + 1,
        playerScore: context.playerScore + (playerIsBatting ? runs : 0),
        computerScore: context.computerScore + (playerIsBatting ? 0 : runs),
        lastBall: ballEvent,
        events: [...context.events, ballEvent],
      }
    }),
    // Advances to the next innings, flips the batter, and (only when
    // entering the FINAL innings) seeds the chase target as the opposing
    // side's accumulated total + 1.
    //
    // For a 2-innings match the chase target lands at the start of innings
    // 2 — same as before. For a 4-innings test match it lands at the start
    // of innings 4, by which point the first batter has played both their
    // innings and their cumulative score is what the second batter has
    // to chase. Intermediate innings (innings 2 and 3 of a test) have
    // target = null, since there's no end-of-match condition yet.
    switchInnings: assign(({ context }) => {
      const nextInningsNumber = (context.inningsNumber + 1) as 1 | 2 | 3 | 4
      const newBatter: Innings = context.currentBatter === 'player' ? 'computer' : 'player'
      const isFinalInnings = nextInningsNumber === context.totalInnings
      // The chaser needs to beat the OTHER side's total runs; that side is
      // whoever is NOT the new batter.
      const opposingSideScore = newBatter === 'player' ? context.computerScore : context.playerScore
      const target = isFinalInnings ? opposingSideScore + 1 : null
      return {
        currentBatter: newBatter,
        inningsNumber: nextInningsNumber,
        ballsThisInnings: 0,
        target,
        lastBall: null,
      }
    }),
  },
  guards: {
    // True when the FINAL innings is over: chase target hit, batter out,
    // or all balls bowled. Generalises across both 2- and 4-innings formats
    // by comparing `inningsNumber` to the configured `totalInnings`.
    matchOver: ({ context }) => {
      if (context.inningsNumber !== context.totalInnings) return false
      const chasingScore = scoreFor(context.currentBatter, context)
      const targetReached = context.target !== null && chasingScore >= context.target
      const inningsEnded =
        context.lastBall?.isOut === true || context.ballsThisInnings >= context.ballsPerInnings
      return targetReached || inningsEnded
    },
    // True when a non-final innings is over (batter out or all balls
    // bowled) and the machine needs to switch to the next innings.
    needsInningsSwitch: ({ context }) => {
      if (context.inningsNumber >= context.totalInnings) return false
      return context.lastBall?.isOut === true || context.ballsThisInnings >= context.ballsPerInnings
    },
  },
}).createMachine({
  id: 'cricket',
  context: ({ input }) => ({
    playerName: input.playerName,
    firstBatter: input.firstBatter,
    currentBatter: input.firstBatter,
    inningsNumber: 1,
    ballsThisInnings: 0,
    ballsPerInnings: input.ballsPerInnings,
    totalInnings: input.totalInnings ?? 2,
    playerScore: 0,
    computerScore: 0,
    target: null,
    lastBall: null,
    events: [],
  }),
  initial: 'awaitingPick',
  states: {
    awaitingPick: {
      on: {
        PICK: {
          actions: 'processBall',
          target: 'revealing',
        },
      },
    },
    revealing: {
      after: {
        [REVEAL_DURATION_MS]: 'evaluating',
      },
    },
    evaluating: {
      always: [
        { guard: 'matchOver', target: 'complete' },
        { guard: 'needsInningsSwitch', target: 'switchingInnings' },
        { target: 'awaitingPick' },
      ],
    },
    switchingInnings: {
      entry: 'switchInnings',
      always: { target: 'awaitingPick' },
    },
    complete: {},
  },
})

// Decides the final result from the two side scores.
export function deriveWinner(ctx: CricketContext): MatchWinner {
  if (ctx.playerScore > ctx.computerScore) return 'player'
  if (ctx.computerScore > ctx.playerScore) return 'computer'
  return 'tie'
}
