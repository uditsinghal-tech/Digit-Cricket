export type ScreenName =
  | 'playerName'
  | 'matchLength'
  | 'coinToss'
  | 'batOrBowl'
  | 'gameplay'
  | 'matchResult'

export type Side = 'heads' | 'tails'

export type TossWinner = 'player' | 'computer'

export type TossOutcome = {
  userChoice: Side
  result: Side
  winner: TossWinner
}

export type Role = 'bat' | 'bowl'

export type Innings = 'player' | 'computer'

export type RoleDecision = {
  chooser: TossWinner
  role: Role
  firstInnings: Innings
}

export type BallNumber = 1 | 2 | 3 | 4 | 5 | 6

export const BALL_NUMBERS: readonly BallNumber[] = [1, 2, 3, 4, 5, 6]

// How many balls each side gets per innings — chosen by the player on the
// MatchLengthScreen and carried through to the cricket machine.
export type BallsPerInnings = 6 | 12

export type BallEvent = {
  innings: 1 | 2
  batter: Innings
  batterPick: BallNumber
  bowlerPick: BallNumber
  runs: number
  isOut: boolean
}

export type MatchWinner = 'player' | 'computer' | 'tie'

export type MatchResult = {
  playerName: string
  firstBatter: Innings
  ballsPerInnings: BallsPerInnings
  playerScore: number
  computerScore: number
  winner: MatchWinner
  events: BallEvent[]
}

export const MAX_PLAYER_NAME_LENGTH = 20
