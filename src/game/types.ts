export type ScreenName =
  | 'playerName'
  | 'modeSelect'
  | 'matchLength'
  | 'multiplayerLobby'
  | 'multiplayerCoinToss'
  | 'multiplayerBatOrBowl'
  | 'multiplayerGameplay'
  | 'coinToss'
  | 'batOrBowl'
  | 'gameplay'
  | 'matchResult'

// Singleplayer (vs computer) or multiplayer (vs friend over WebRTC).
export type GameMode = 'singleplayer' | 'multiplayer'

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

// 1-6 are the picks a player can choose via the on-screen buttons.
// 0 is reserved for the auto-pick fired when the per-ball 10-second timer
// runs out without a manual selection. The cricket rules degrade gracefully
// for a 0: 0 never equals 1-6, so a 0-batter scores 0 runs but can't be out,
// and a 0-bowler can't get the batter out (batter scores freely). If both
// peers time out the same ball, both pick 0 → they "match" → batter out
// with 0 runs, which is consistent with the standard rule "matching picks
// = wicket".
export type BallNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6

// Numbers shown on the pick buttons. Excludes 0 — that's only ever produced
// by the timeout auto-pick path, never selected manually.
export const BALL_NUMBERS: readonly (1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6]

// How many balls each side gets per innings — chosen by the player on the
// MatchLengthScreen and carried through to the cricket machine.
export type BallsPerInnings = 6 | 12

// How many innings the match runs for in total.
//   2 → standard 6-ball / 12-ball match: each side bats once.
//   4 → test match: each side bats twice (innings 1+3 belong to the first
//       batter, innings 2+4 belong to the second batter).
// The cricket machine drives the innings counter from this; nothing else.
export type TotalInnings = 2 | 4

export type BallEvent = {
  // Widened to 1..4 so the test format can tag innings 3 and 4 without a
  // schema change. Standard 6/12-ball matches still only ever emit 1 or 2.
  innings: 1 | 2 | 3 | 4
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
  // Carried into the result so MatchResultScreen knows whether to render
  // one batting card per side (2 innings) or fold innings 1+3 and 2+4 into
  // one combined card per side (4 innings / test match).
  totalInnings: TotalInnings
  playerScore: number
  computerScore: number
  winner: MatchWinner
  events: BallEvent[]
}

export const MIN_PLAYER_NAME_LENGTH = 2
export const MAX_PLAYER_NAME_LENGTH = 20
