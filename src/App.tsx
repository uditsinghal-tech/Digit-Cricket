import { useState } from 'react'
import Box from '@mui/material/Box'
import { AnimatePresence } from 'framer-motion'
import PlayerNameScreen from './screens/PlayerNameScreen'
import MatchLengthScreen from './screens/MatchLengthScreen'
import CoinTossScreen from './screens/CoinTossScreen'
import BatOrBowlScreen from './screens/BatOrBowlScreen'
import GameplayScreen from './screens/GameplayScreen'
import MatchResultScreen from './screens/MatchResultScreen'
import StadiumBackground from './components/StadiumBackground'
import MuteToggle from './components/MuteToggle'
import DayNightToggle from './components/DayNightToggle'
import type {
  BallsPerInnings,
  MatchResult,
  RoleDecision,
  ScreenName,
  TossOutcome,
} from './game/types'
import './App.css'

// Top-level app. Owns which screen is showing and the running match data
// (player name, match length, toss outcome, role decision, final result),
// and animates between screens with AnimatePresence.
function App() {
  const [screen, setScreen] = useState<ScreenName>('playerName')
  const [playerName, setPlayerName] = useState('')
  const [ballsPerInnings, setBallsPerInnings] = useState<BallsPerInnings | null>(null)
  const [tossOutcome, setTossOutcome] = useState<TossOutcome | null>(null)
  const [roleDecision, setRoleDecision] = useState<RoleDecision | null>(null)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)

  // Saves the entered name and advances to the match-length selector.
  const handleNameSubmit = (name: string) => {
    setPlayerName(name)
    setScreen('matchLength')
  }

  // Saves the chosen number of balls per innings and advances to the coin toss.
  const handleMatchLengthSelect = (count: BallsPerInnings) => {
    setBallsPerInnings(count)
    setScreen('coinToss')
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

  // Stores the final match result and advances to the result screen.
  const handleMatchComplete = (result: MatchResult) => {
    setMatchResult(result)
    setScreen('matchResult')
  }

  // Quick rematch: keep the name AND the chosen match length, drop straight
  // back into the coin toss.
  const handlePlayAgain = () => {
    setTossOutcome(null)
    setRoleDecision(null)
    setMatchResult(null)
    setScreen('coinToss')
  }

  // Full reset: clear everything including the name and match length, back to
  // the welcome screen.
  const handleChangeName = () => {
    setPlayerName('')
    setBallsPerInnings(null)
    setTossOutcome(null)
    setRoleDecision(null)
    setMatchResult(null)
    setScreen('playerName')
  }

  return (
    <Box className="app-shell">
      <StadiumBackground />
      <DayNightToggle />
      <MuteToggle />
      <AnimatePresence mode="wait">
        {screen === 'playerName' && (
          <PlayerNameScreen key="player-name" onSubmit={handleNameSubmit} />
        )}
        {screen === 'matchLength' && (
          <MatchLengthScreen
            key="match-length"
            playerName={playerName}
            onSelect={handleMatchLengthSelect}
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
            firstBatter={roleDecision.firstInnings}
            ballsPerInnings={ballsPerInnings}
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
  )
}

export default App
