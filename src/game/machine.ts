import { assign, setup } from 'xstate'
import {
  BALL_NUMBERS,
  type BallEvent,
  type BallNumber,
  type BallsPerInnings,
  type Innings,
  type MatchWinner,
} from './types'

export type CricketContext = {
  playerName: string
  firstBatter: Innings
  currentBatter: Innings
  inningsNumber: 1 | 2
  ballsThisInnings: number
  ballsPerInnings: BallsPerInnings
  playerScore: number
  computerScore: number
  target: number | null
  lastBall: BallEvent | null
  events: BallEvent[]
}

export type CricketInput = {
  playerName: string
  firstBatter: Innings
  ballsPerInnings: BallsPerInnings
}

export type CricketEvent = { type: 'PICK'; number: BallNumber }

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
      const computerPick = randomBallNumber()

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
    // Flips the batter, advances to innings 2, and seeds the chase target
    // as the first innings score + 1.
    switchInnings: assign(({ context }) => {
      const firstInningsScore = scoreFor(context.currentBatter, context)
      const newBatter: Innings = context.currentBatter === 'player' ? 'computer' : 'player'
      return {
        currentBatter: newBatter,
        inningsNumber: 2 as const,
        ballsThisInnings: 0,
        target: firstInningsScore + 1,
        lastBall: null,
      }
    }),
  },
  guards: {
    // True when innings 2 is over: chase target hit, batter out, or all balls bowled.
    matchOver: ({ context }) => {
      if (context.inningsNumber !== 2) return false
      const chasingScore = scoreFor(context.currentBatter, context)
      const targetReached = context.target !== null && chasingScore >= context.target
      const inningsEnded =
        context.lastBall?.isOut === true || context.ballsThisInnings >= context.ballsPerInnings
      return targetReached || inningsEnded
    },
    // True when innings 1 is over: batter out or all balls bowled.
    firstInningsOver: ({ context }) => {
      if (context.inningsNumber !== 1) return false
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
        { guard: 'firstInningsOver', target: 'switchingInnings' },
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
