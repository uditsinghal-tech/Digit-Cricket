import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import PersonIcon from '@mui/icons-material/Person'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import { AnimatePresence } from 'framer-motion'
import AuthScreen from './screens/AuthScreen'
import PlayerNameScreen from './screens/PlayerNameScreen'
import StartChoiceScreen, { type StartChoice } from './screens/StartChoiceScreen'
import ModeSelectionScreen from './screens/ModeSelectionScreen'
import MatchLengthScreen from './screens/MatchLengthScreen'
import QuizModeScreen from './screens/QuizModeScreen'
import QuizDifficultyScreen from './screens/QuizDifficultyScreen'
import CustomizeQuizScreen from './screens/CustomizeQuizScreen'
import QuizScreen, { type QuizResult } from './screens/QuizScreen'
import QuizResultScreen from './screens/QuizResultScreen'
import ContestResultScreen from './screens/ContestResultScreen'
import type { QuizDifficultyChoice, QuizQuestion } from './quiz/questions'
import MultiplayerLobbyScreen from './screens/MultiplayerLobbyScreen'
import MultiplayerCoinTossScreen from './screens/MultiplayerCoinTossScreen'
import MultiplayerBatOrBowlScreen from './screens/MultiplayerBatOrBowlScreen'
import CoinTossScreen from './screens/CoinTossScreen'
import BatOrBowlScreen from './screens/BatOrBowlScreen'
import GameplayScreen from './screens/GameplayScreen'
import MatchResultScreen from './screens/MatchResultScreen'
import StadiumBackground from './components/StadiumBackground'
import MuteToggle from './components/MuteToggle'
import DayNightToggle from './components/DayNightToggle'
import HowToPlayButton from './components/HowToPlayButton'
import StatsButton from './components/StatsButton'
import LeaderboardButton from './components/LeaderboardButton'
import CricketHistoryButton from './components/CricketHistoryButton'
import { recordMatch, recordQuiz } from './stats/playerStats'
import { logout, type ContestGrade } from './api/client'
import { useMultiplayer } from './multiplayer/useMultiplayer'
import type { NetworkMessage } from './multiplayer/messages'
import type {
  BallsPerInnings,
  GameMode,
  MatchResult,
  RoleDecision,
  ScreenName,
  TossOutcome,
  TotalInnings,
} from './game/types'
import type { MatchLengthChoice } from './screens/MatchLengthScreen'
import './App.css'

// Top-level app. Owns which screen is showing and the running match data
// (player name, match length, toss outcome, role decision, final result),
// and animates between screens with AnimatePresence.
function App() {
  const [screen, setScreen] = useState<ScreenName>('auth')
  // Guests entered with a display name only (no account / session), so the
  // contest is off-limits to them; everything else works the same.
  const [isGuest, setIsGuest] = useState(false)
  // Signed in with the admin email (server decides): unlocks the leaderboard export.
  const [isAdmin, setIsAdmin] = useState(false)
  // Name-chip menu (Log out / Sign In) and the entry tab to open on return.
  const [accountMenuAnchor, setAccountMenuAnchor] = useState<HTMLElement | null>(null)
  const [authTab, setAuthTab] = useState<'signup' | 'login'>('signup')
  const [playerName, setPlayerName] = useState('')
  const [ballsPerInnings, setBallsPerInnings] = useState<BallsPerInnings | null>(null)
  // Total innings the match runs for. Defaults to 2 (standard format).
  // Set to 4 only when the user picks the Test Match tile on the length
  // screen. Multiplayer paths leave it at 2 (no test format over the wire).
  const [totalInnings, setTotalInnings] = useState<TotalInnings>(2)
  const [tossOutcome, setTossOutcome] = useState<TossOutcome | null>(null)
  const [roleDecision, setRoleDecision] = useState<RoleDecision | null>(null)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  // The latest finished quiz session. Reset on a "Try Again" so a fresh
  // 10-question sample is sampled.
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  // The difficulty band the player picked for the current quiz run. Held
  // so "Try Again" re-uses the same band without bouncing them back to the
  // difficulty picker. Cleared when the user goes Home.
  const [quizDifficulty, setQuizDifficulty] = useState<QuizDifficultyChoice>('mixed')
  // Holds the questions Gemini generated for a Customize Quiz session.
  // Reset to null whenever the user goes back to the difficulty picker
  // so a Try Again on a custom quiz uses the same set, but going back
  // and rebuilding starts from scratch.
  const [customQuestions, setCustomQuestions] = useState<QuizQuestion[] | null>(null)
  // Coupon code for the current contest quiz, or null for a non-contest
  // run. Its presence tells QuizScreen to grade server-side on Finish.
  const [contestCoupon, setContestCoupon] = useState<string | null>(null)
  // Server-graded contest summary, shown on the contest result screen.
  const [contestGrade, setContestGrade] = useState<ContestGrade | null>(null)

  // Pulled so the post-match handlers can branch on whether the player is
  // currently in a multiplayer room. `subscribe` is used to receive the
  // host-broadcast MATCH_LENGTH on the joiner side. Disconnect is the clean
  // exit path.
  const { status: multiplayerStatus, opponentName, disconnect, subscribe } = useMultiplayer()

  // Joiner-side subscription. The host broadcasts MATCH_LENGTH right after
  // the connection opens (it's cached in the lobby BEFORE the room code is
  // generated), so by the time the joiner reaches any gameplay screen
  // ballsPerInnings is populated. Singleplayer ignores this entirely.
  useEffect(() => {
    return subscribe((msg: NetworkMessage) => {
      if (msg.type === 'MATCH_LENGTH') {
        setBallsPerInnings(msg.balls)
      }
    })
  }, [subscribe])

  // If the peer connection drops while we're inside any active in-match
  // multiplayer flow, route the user back to mode selection so they're never
  // stuck waiting on a peer that's gone. The lobby itself is excluded — it's
  // normal for status to be 'idle' / 'hosting' / 'joining' there, that's the
  // whole point of the screen. The lobby has its own Cancel + error UI for
  // disconnects. The local exit paths (Leave match etc.) set the screen
  // explicitly before disconnecting, so they don't trip this guard either.
  useEffect(() => {
    if (multiplayerStatus === 'connected') return
    const inMatchMultiplayerScreens: ScreenName[] = [
      'multiplayerCoinToss',
      'multiplayerBatOrBowl',
      'multiplayerGameplay',
    ]
    if (inMatchMultiplayerScreens.includes(screen)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScreen('modeSelect')
    }
  }, [multiplayerStatus, screen])

  // Signup/login succeeded — the account's display name comes back from
  // the server, so skip name entry and go straight to the start choice.
  // (The session cookie identifies the player to the contest endpoints.)
  const handleAuthed = (name: string, admin: boolean) => {
    setIsGuest(false)
    setIsAdmin(admin)
    setPlayerName(name)
    setScreen('startChoice')
  }

  // "Play as guest": display name only, straight to the start choice.
  const handleGuest = (name: string) => {
    setIsGuest(true)
    setPlayerName(name)
    setScreen('startChoice')
  }

  // Back to the entry screen with everything cleared (name, guest flag, any
  // match / quiz / contest in progress, multiplayer room). `tab` picks which
  // entry tab opens: Sign In when a guest asked to sign in.
  const goHome = (tab: 'signup' | 'login') => {
    setAccountMenuAnchor(null)
    if (multiplayerStatus === 'connected') disconnect()
    setIsGuest(false)
    setIsAdmin(false)
    setPlayerName('')
    setBallsPerInnings(null)
    setTotalInnings(2)
    setTossOutcome(null)
    setRoleDecision(null)
    setMatchResult(null)
    setQuizResult(null)
    setQuizDifficulty('mixed')
    setCustomQuestions(null)
    setContestCoupon(null)
    setContestGrade(null)
    setAuthTab(tab)
    setScreen('auth')
  }

  // Ends the server session too, so the cookie stops identifying this player
  // (shared phone). Goes home even if the call fails: worst case the stale
  // session is replaced at the next sign in.
  const handleLogout = () => {
    logout().catch(() => {})
    goHome('signup')
  }

  // A contest quiz on screen: its single attempt is live, so the name-chip
  // menu is disabled until it's submitted.
  const contestInProgress = screen === 'quiz' && contestCoupon !== null

  // Saves the entered name and advances to the new start-choice screen
  // (Play Cricket / Quiz). The cricket flow continues from there.
  const handleNameSubmit = (name: string) => {
    setPlayerName(name)
    setScreen('startChoice')
  }

  // Branches between the cricket match flow and the quiz mode. The quiz
  // path now goes through the difficulty picker first.
  const handleStartChoice = (choice: StartChoice) => {
    if (choice === 'play') {
      setScreen('modeSelect')
    } else {
      setQuizResult(null)
      setScreen('quizMode')
    }
  }

  // "Play For Fun" on the quiz-mode screen — the existing sampled-quiz
  // path, starting from the difficulty picker.
  const handlePlayForFun = () => {
    setQuizResult(null)
    setScreen('quizDifficulty')
  }

  // Contest coupon validated — the backend returned the question set, so
  // run it verbatim through QuizScreen (same path as a custom quiz). The
  // coupon is held so QuizScreen can submit answers for server grading.
  const handleContestStart = (questions: QuizQuestion[], couponCode: string) => {
    setCustomQuestions(questions)
    setContestCoupon(couponCode)
    setQuizResult(null)
    setScreen('quiz')
  }

  // Difficulty picked — stash it and start the quiz.
  const handleQuizDifficulty = (difficulty: QuizDifficultyChoice) => {
    setQuizDifficulty(difficulty)
    setQuizResult(null)
    setCustomQuestions(null)
    setContestCoupon(null)
    setScreen('quiz')
  }

  // "Customize Quiz" picked on the difficulty screen — route to the
  // form rather than launching a regular sampled quiz.
  const handleCustomizeQuiz = () => {
    setQuizResult(null)
    setCustomQuestions(null)
    setScreen('customizeQuiz')
  }

  // Gemini handed back the generated questions — stash them and route
  // to the quiz screen which will use them instead of sampling.
  const handleCustomQuizGenerated = (questions: QuizQuestion[]) => {
    setCustomQuestions(questions)
    setContestCoupon(null)
    setQuizResult(null)
    setScreen('quiz')
  }

  // Play For Fun / custom quiz finished — purely local, exactly as it was
  // before the backend existed: stash the summary, persist per-session
  // totals into localStorage stats, and show the review result screen.
  const handleQuizFinish = (result: QuizResult) => {
    const attempted = result.entries.filter((e) => e.selectedDisplayIndex !== null).length
    recordQuiz({
      seen: result.totalQuestions,
      attempted,
      correct: result.correctCount,
    })
    setQuizResult(result)
    setScreen('quizResult')
  }

  // Contest finished — the server already graded it, so just stash the
  // summary and show the totals-only contest result screen.
  const handleContestFinish = (grade: ContestGrade) => {
    setContestGrade(grade)
    setScreen('contestResult')
  }

  // "Try Again" from the result screen: clear the previous result and
  // re-mount QuizScreen so it samples a fresh 10 questions.
  const handleQuizTryAgain = () => {
    setQuizResult(null)
    setScreen('quiz')
  }

  // Branches into the singleplayer flow (match-length picker) or the
  // multiplayer flow (lobby) based on the chosen mode.
  const handleModeSelect = (mode: GameMode) => {
    setScreen(mode === 'singleplayer' ? 'matchLength' : 'multiplayerLobby')
  }

  // Called by the lobby once the PeerJS connection has opened. The host
  // already committed to a match length in the lobby (before the room code
  // was generated) and passes it in here so we can stash it and skip
  // straight to the coin toss. Joiner passes null — its ballsPerInnings is
  // populated by the top-level MATCH_LENGTH subscription above.
  const handleMultiplayerConnected = (hostMatchLength: BallsPerInnings | null) => {
    if (hostMatchLength !== null) {
      setBallsPerInnings(hostMatchLength)
    }
    setScreen('multiplayerCoinToss')
  }

  // Singleplayer match-length picker callback — saves the chosen format
  // (balls per innings + total innings) and advances to the coin toss.
  const handleMatchLengthSelect = (choice: MatchLengthChoice) => {
    setBallsPerInnings(choice.ballsPerInnings)
    setTotalInnings(choice.totalInnings)
    setScreen('coinToss')
  }

  // Multiplayer coin-toss completion — fires on both peers once the coin has
  // landed (host computes the random result and broadcasts; joiner adopts
  // it). Stores the outcome and advances to the bat/bowl picker.
  const handleMultiplayerTossComplete = (outcome: TossOutcome) => {
    setTossOutcome(outcome)
    setScreen('multiplayerBatOrBowl')
  }

  // Multiplayer bat/bowl decision — fires on both peers once the toss winner
  // has picked (the winner picks locally, the loser via the ROLE_CHOICE
  // message). Stores the decision and advances to multiplayer gameplay.
  const handleMultiplayerRoleSet = (decision: RoleDecision) => {
    setRoleDecision(decision)
    setScreen('multiplayerGameplay')
  }

  // User cancelled out of the multiplayer lobby — back to mode selection.
  const handleLobbyCancel = () => {
    setScreen('modeSelect')
  }

  // Stores the toss outcome and advances to the bat/bowl decision screen.
  const handleTossComplete = (outcome: TossOutcome) => {
    setTossOutcome(outcome)
    setScreen('batOrBowl')
  }

  // Stores who bats first and advances to the gameplay screen.
  const handleRoleComplete = (decision: RoleDecision) => {
    setRoleDecision(decision)
    setScreen('gameplay')
  }

  // Stores the final match result, persists the played-won-tied tally
  // (plus runs / balls faced / highest score) into the player's stats so
  // the My-stats dialog reflects it, and advances to the result screen.
  // The vs-friend flag is read from the current screen — at this call
  // site `screen` is still the gameplay variant.
  const handleMatchComplete = (result: MatchResult) => {
    const playerEvents = result.events.filter((e) => e.batter === 'player')
    const playerBallsFaced = playerEvents.length
    const playerFours = playerEvents.filter((e) => e.runs === 4).length
    const playerSixes = playerEvents.filter((e) => e.runs === 6).length
    recordMatch({
      vsFriend: screen === 'multiplayerGameplay',
      ballsPerInnings: result.ballsPerInnings,
      totalInnings: result.totalInnings,
      winner: result.winner,
      playerScore: result.playerScore,
      playerBallsFaced,
      playerFours,
      playerSixes,
    })
    setMatchResult(result)
    setScreen('matchResult')
  }

  // Quick rematch. In singleplayer: keep the name + match length, drop
  // straight into the coin toss. In multiplayer: both peers have confirmed
  // the rematch (MatchResultScreen handshake), so we clear the per-match
  // state and route back to the multiplayer coin toss with the same
  // connection still alive.
  const handlePlayAgain = () => {
    setTossOutcome(null)
    setRoleDecision(null)
    setMatchResult(null)
    setScreen(multiplayerStatus === 'connected' ? 'multiplayerCoinToss' : 'coinToss')
  }

  // Full reset: clear everything including the name and tear down any
  // active multiplayer connection. Returns to the welcome screen.
  const handleChangeName = () => {
    if (multiplayerStatus === 'connected') {
      disconnect()
    }
    setPlayerName('')
    setBallsPerInnings(null)
    setTotalInnings(2)
    setTossOutcome(null)
    setRoleDecision(null)
    setMatchResult(null)
    setScreen('playerName')
  }

  return (
    <Box className="app-shell">
      <StadiumBackground />
      <CricketHistoryButton />
      {/* Display names of accounts are unique, so a name match is this player's row. */}
      <LeaderboardButton highlightName={isGuest ? null : playerName || null} isAdmin={isAdmin} />
      <StatsButton />
      <HowToPlayButton />
      <DayNightToggle />
      <MuteToggle />
      {/* Who's playing, top-left (the icon row owns the top-right). Hidden on the
          entry screen; long names truncate so the chip never runs into the icons. */}
      {screen !== 'auth' && playerName && (
        <Chip
          icon={<PersonIcon />}
          label={isGuest ? `${playerName} · Guest` : playerName}
          onClick={(e) => setAccountMenuAnchor(e.currentTarget)}
          // Mid-contest, leaving would silently burn the one attempt.
          disabled={contestInProgress}
          sx={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 20,
            maxWidth: { xs: 'calc(100vw - 300px)', sm: 260 },
            minWidth: 0,
            color: 'rgba(248,250,252,0.95)',
            fontWeight: 600,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            '& .MuiChip-icon': { color: 'rgba(248,250,252,0.85)' },
            '&:hover': { background: 'rgba(15, 23, 42, 0.85)' },
            '&.Mui-disabled': { opacity: 0.6 },
          }}
        />
      )}
      <Menu
        anchorEl={accountMenuAnchor}
        open={accountMenuAnchor !== null}
        onClose={() => setAccountMenuAnchor(null)}
      >
        {isGuest ? (
          <MenuItem onClick={() => goHome('login')}>
            <ListItemIcon>
              <LoginIcon fontSize="small" />
            </ListItemIcon>
            Sign In
          </MenuItem>
        ) : (
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            Log out
          </MenuItem>
        )}
      </Menu>
      <Box
        component="footer"
        sx={{
          position: 'fixed',
          bottom: 8,
          left: 0,
          right: 0,
          zIndex: 10,
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'rgba(248, 250, 252, 0.7)',
          pointerEvents: 'none',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
        }}
      >
        ⚡ May the digits be in your favor | 
        {/* Developed by{' '}
        <a
          href="https://www.linkedin.com/in/udit-singhal2404/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'inherit',
            textDecoration: 'underline',
            pointerEvents: 'auto',
          }}
        >
          Udit Singhal
        </a>{' '} */}
        | Powered by Numbers 📊
      </Box>
      {/* Every screen sits on one dark glass panel. The screens use the dark MUI
          theme (light text, light-blue accents), which vanishes against the bright
          day sky; the panel keeps contrast the same in day and night mode. */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          width: 'calc(100% - 24px)',
          maxWidth: 680,
          mt: 9,
          mb: 6,
          display: 'flex',
          justifyContent: 'center',
          borderRadius: 4,
          background: 'rgba(15, 23, 42, 0.78)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
        }}
      >
      <AnimatePresence mode="wait">
        {screen === 'auth' && (
          <AuthScreen key="auth" onAuthed={handleAuthed} onGuest={handleGuest} initialMode={authTab} />
        )}
        {screen === 'playerName' && (
          <PlayerNameScreen key="player-name" onSubmit={handleNameSubmit} />
        )}
        {screen === 'startChoice' && (
          <StartChoiceScreen
            key="start-choice"
            playerName={playerName}
            onSelect={handleStartChoice}
            onBack={() => setScreen('playerName')}
          />
        )}
        {screen === 'modeSelect' && (
          <ModeSelectionScreen
            key="mode-select"
            playerName={playerName}
            onSelect={handleModeSelect}
            onBack={() => setScreen('startChoice')}
          />
        )}
        {screen === 'quizMode' && (
          <QuizModeScreen
            key="quiz-mode"
            playerName={playerName}
            isGuest={isGuest}
            onSignIn={() => goHome('login')}
            onPlayForFun={handlePlayForFun}
            onContestStart={handleContestStart}
            onBack={() => setScreen('startChoice')}
          />
        )}
        {screen === 'quizDifficulty' && (
          <QuizDifficultyScreen
            key="quiz-difficulty"
            playerName={playerName}
            onSelect={handleQuizDifficulty}
            onCustomize={handleCustomizeQuiz}
            onBack={() => setScreen('quizMode')}
          />
        )}
        {screen === 'customizeQuiz' && (
          <CustomizeQuizScreen
            key="customize-quiz"
            playerName={playerName}
            onGenerated={handleCustomQuizGenerated}
            onBack={() => setScreen('quizDifficulty')}
          />
        )}
        {screen === 'quiz' && (
          <QuizScreen
            key={`quiz-${customQuestions ? 'custom' : quizDifficulty}`}
            playerName={playerName}
            customQuestions={customQuestions ?? undefined}
            couponCode={contestCoupon ?? undefined}
            difficulty={quizDifficulty}
            onFinish={handleQuizFinish}
            onContestFinish={handleContestFinish}
            onBack={() => setScreen('quizDifficulty')}
          />
        )}
        {screen === 'quizResult' && quizResult && (
          <QuizResultScreen
            key="quiz-result"
            result={quizResult}
            onTryAgain={handleQuizTryAgain}
            onHome={() => setScreen('startChoice')}
          />
        )}
        {screen === 'contestResult' && contestGrade && (
          <ContestResultScreen
            key="contest-result"
            grade={contestGrade}
            playerName={playerName}
            onHome={() => {
              setContestGrade(null)
              setCustomQuestions(null)
              setContestCoupon(null)
              setScreen('startChoice')
            }}
          />
        )}
        {screen === 'matchLength' && (
          <MatchLengthScreen
            key="match-length"
            playerName={playerName}
            onSelect={handleMatchLengthSelect}
            onBack={() => setScreen('modeSelect')}
          />
        )}
        {screen === 'multiplayerLobby' && (
          <MultiplayerLobbyScreen
            key="multiplayer-lobby"
            playerName={playerName}
            onCancel={handleLobbyCancel}
            onConnected={handleMultiplayerConnected}
          />
        )}
        {screen === 'multiplayerCoinToss' && (
          <MultiplayerCoinTossScreen
            key="multiplayer-coin-toss"
            playerName={playerName}
            onComplete={handleMultiplayerTossComplete}
          />
        )}
        {screen === 'multiplayerBatOrBowl' && tossOutcome && (
          <MultiplayerBatOrBowlScreen
            key="multiplayer-bat-or-bowl"
            playerName={playerName}
            tossOutcome={tossOutcome}
            onRoleSet={handleMultiplayerRoleSet}
          />
        )}
        {screen === 'multiplayerGameplay' && roleDecision && ballsPerInnings !== null && (
          <GameplayScreen
            key="multiplayer-gameplay"
            playerName={playerName}
            opponentName={opponentName ?? 'Opponent'}
            firstBatter={roleDecision.firstInnings}
            ballsPerInnings={ballsPerInnings}
            mode="multiplayer"
            onComplete={handleMatchComplete}
          />
        )}
        {screen === 'coinToss' && (
          <CoinTossScreen key="coin-toss" playerName={playerName} onComplete={handleTossComplete} />
        )}
        {screen === 'batOrBowl' && tossOutcome && (
          <BatOrBowlScreen
            key="bat-or-bowl"
            playerName={playerName}
            tossOutcome={tossOutcome}
            onComplete={handleRoleComplete}
          />
        )}
        {screen === 'gameplay' && roleDecision && ballsPerInnings !== null && (
          <GameplayScreen
            key="gameplay"
            playerName={playerName}
            opponentName="DigitCricket"
            firstBatter={roleDecision.firstInnings}
            ballsPerInnings={ballsPerInnings}
            totalInnings={totalInnings}
            onComplete={handleMatchComplete}
          />
        )}
        {screen === 'matchResult' && matchResult && (
          <MatchResultScreen
            key="match-result"
            result={matchResult}
            onPlayAgain={handlePlayAgain}
            onChangeName={handleChangeName}
          />
        )}
      </AnimatePresence>
      </Box>
    </Box>
  )
}

export default App
