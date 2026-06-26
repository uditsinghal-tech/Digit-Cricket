// Player stats persistence. Stats live entirely in localStorage under a
// single namespaced key; no provider, no context, no server. Reads happen
// once when the StatsButton dialog opens, writes happen when a match or
// quiz finishes. Failures (private mode, quota, SSR) are swallowed —
// stats are a nice-to-have, not part of the gameplay path.

const STATS_STORAGE_KEY = 'digit-cricket:player-stats'

// One row of match-format stats. `played` is the count of finished
// matches of that format / opponent, `won` are the ones the player won,
// `tied` the equal-totals ones. Losses = played - won - tied.
// `runs` is the total runs the player scored across all matches in this
// bucket, `ballsFaced` is total deliveries faced (drives strike-rate),
// `highScore` is the best single-match total the player has put up.
// `fours` / `sixes` are running totals of boundary-value picks.
export type MatchBucket = {
  played: number
  won: number
  tied: number
  runs: number
  ballsFaced: number
  highScore: number
  fours: number
  sixes: number
}

// The three match formats the app supports. Test match (4 innings) is
// flagged by totalInnings === 4 in the cricket machine; the other two
// are distinguished by ballsPerInnings.
export type MatchFormat = 'sixBall' | 'twelveBall' | 'test'

// One side of the matches breakdown. Vs Computer is singleplayer; Vs
// Friend is multiplayer.
export type MatchesByFormat = {
  sixBall: MatchBucket
  twelveBall: MatchBucket
  test: MatchBucket
}

export type QuizBucket = {
  // Total number of questions the player has been SHOWN across all quiz
  // runs (10 per finished quiz).
  seen: number
  // The subset of those that the player actually picked an answer for.
  // Skipped questions don't count as attempted.
  attempted: number
  // The subset of attempted questions that were correct.
  correct: number
}

export type PlayerStats = {
  matches: {
    vsComputer: MatchesByFormat
    vsFriend: MatchesByFormat
  }
  quiz: QuizBucket
}

// Used when no stats are saved yet, or when localStorage is unreadable.
function emptyBucket(): MatchBucket {
  return {
    played: 0,
    won: 0,
    tied: 0,
    runs: 0,
    ballsFaced: 0,
    highScore: 0,
    fours: 0,
    sixes: 0,
  }
}

function emptyMatchesByFormat(): MatchesByFormat {
  return {
    sixBall: emptyBucket(),
    twelveBall: emptyBucket(),
    test: emptyBucket(),
  }
}

export function emptyStats(): PlayerStats {
  return {
    matches: {
      vsComputer: emptyMatchesByFormat(),
      vsFriend: emptyMatchesByFormat(),
    },
    quiz: { seen: 0, attempted: 0, correct: 0 },
  }
}

// Merges a saved per-format object onto an empty shape so missing /
// newer fields default to zero instead of throwing in the UI.
function mergeByFormat(
  saved: Partial<MatchesByFormat> | undefined,
): MatchesByFormat {
  const base = emptyMatchesByFormat()
  return {
    sixBall: { ...base.sixBall, ...saved?.sixBall },
    twelveBall: { ...base.twelveBall, ...saved?.twelveBall },
    test: { ...base.test, ...saved?.test },
  }
}

// Reads the persisted stats from localStorage, merging onto an empty
// shape so missing / newer fields don't crash the UI. Returns empty
// stats if storage is unreadable or empty.
export function readStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY)
    if (!raw) return emptyStats()
    const parsed = JSON.parse(raw) as Partial<PlayerStats>
    const base = emptyStats()
    return {
      matches: {
        vsComputer: mergeByFormat(parsed?.matches?.vsComputer),
        vsFriend: mergeByFormat(parsed?.matches?.vsFriend),
      },
      quiz: { ...base.quiz, ...parsed?.quiz },
    }
  } catch {
    return emptyStats()
  }
}

// Writes the stats blob to localStorage. Silent on failure.
function writeStats(stats: PlayerStats): void {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // ignore
  }
}

// Maps a finished match's (ballsPerInnings, totalInnings) pair to one of
// the three format buckets. Test format is 4 innings; the other two are
// distinguished by their over count.
export function formatFromMatch(
  ballsPerInnings: 6 | 12,
  totalInnings: 2 | 4,
): MatchFormat {
  if (totalInnings === 4) return 'test'
  return ballsPerInnings === 6 ? 'sixBall' : 'twelveBall'
}

// Increments the right bucket for a finished match. Called from App.tsx
// on the match-complete handler so persistence happens before the
// result screen mounts. `playerScore` is the runs the user scored in
// this match (summed across both innings for the Test format);
// `playerBallsFaced` is the balls they faced — both used to roll up
// the highest-score / average / strike-rate fields.
export function recordMatch(input: {
  vsFriend: boolean
  ballsPerInnings: 6 | 12
  totalInnings: 2 | 4
  winner: 'player' | 'computer' | 'tie'
  playerScore: number
  playerBallsFaced: number
  playerFours: number
  playerSixes: number
}): void {
  const stats = readStats()
  const sideKey = input.vsFriend ? 'vsFriend' : 'vsComputer'
  const format = formatFromMatch(input.ballsPerInnings, input.totalInnings)
  const bucket = stats.matches[sideKey][format]
  bucket.played += 1
  if (input.winner === 'player') bucket.won += 1
  if (input.winner === 'tie') bucket.tied += 1
  bucket.runs += input.playerScore
  bucket.ballsFaced += input.playerBallsFaced
  bucket.fours += input.playerFours
  bucket.sixes += input.playerSixes
  if (input.playerScore > bucket.highScore) bucket.highScore = input.playerScore
  writeStats(stats)
}

// Increments the quiz bucket for a finished quiz session.
export function recordQuiz(input: {
  seen: number
  attempted: number
  correct: number
}): void {
  const stats = readStats()
  stats.quiz.seen += input.seen
  stats.quiz.attempted += input.attempted
  stats.quiz.correct += input.correct
  writeStats(stats)
}

// Wipes all stored stats. Called from the StatsDialog Reset button after
// confirmation.
export function resetStats(): void {
  try {
    localStorage.removeItem(STATS_STORAGE_KEY)
  } catch {
    // ignore
  }
}

// Helpers used by the StatsDialog rendering. Kept here so the dialog
// stays a pure view layer.

// Sums two buckets into a third. `highScore` becomes the max of the two
// (it's already the per-match best inside each input).
function sumBuckets(a: MatchBucket, b: MatchBucket): MatchBucket {
  return {
    played: a.played + b.played,
    won: a.won + b.won,
    tied: a.tied + b.tied,
    runs: a.runs + b.runs,
    ballsFaced: a.ballsFaced + b.ballsFaced,
    highScore: Math.max(a.highScore, b.highScore),
    fours: a.fours + b.fours,
    sixes: a.sixes + b.sixes,
  }
}

export function totalAcross(buckets: MatchesByFormat): MatchBucket {
  return sumBuckets(sumBuckets(buckets.sixBall, buckets.twelveBall), buckets.test)
}

export function grandTotal(stats: PlayerStats): MatchBucket {
  return sumBuckets(totalAcross(stats.matches.vsComputer), totalAcross(stats.matches.vsFriend))
}

// Win percentage for a bucket, returned as a 0-100 integer. Zero matches
// shows as "—" in the UI so we return null here for that case.
export function winPercent(bucket: MatchBucket): number | null {
  if (bucket.played === 0) return null
  return Math.round((bucket.won / bucket.played) * 100)
}

// Average runs per match for the player. `null` when no matches yet.
// Rounded to one decimal place to match cricket-stat conventions.
export function average(bucket: MatchBucket): number | null {
  if (bucket.played === 0) return null
  return Math.round((bucket.runs / bucket.played) * 10) / 10
}

// Strike rate: runs per 100 balls faced. `null` until the player has
// actually faced a delivery (so a brand-new bucket doesn't divide by 0).
export function strikeRate(bucket: MatchBucket): number | null {
  if (bucket.ballsFaced === 0) return null
  return Math.round((bucket.runs / bucket.ballsFaced) * 1000) / 10
}

// Correct percentage for the quiz bucket. Based on ATTEMPTED, not seen,
// so a player who skipped half the questions isn't penalised for the
// skipped half. Returns null when nothing has been attempted.
export function correctPercent(quiz: QuizBucket): number | null {
  if (quiz.attempted === 0) return null
  return Math.round((quiz.correct / quiz.attempted) * 100)
}
