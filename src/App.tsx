import { useState } from 'react'
import Box from '@mui/material/Box'
import { AnimatePresence } from 'framer-motion'
import PlayerNameScreen from './screens/PlayerNameScreen'
import CoinTossScreen from './screens/CoinTossScreen'
import BatOrBowlScreen from './screens/BatOrBowlScreen'
import GameplayScreen from './screens/GameplayScreen'
import MatchResultScreen from './screens/MatchResultScreen'
import StadiumBackground from './components/StadiumBackground'
import type { MatchResult, RoleDecision, ScreenName, TossOutcome } from './game/types'
import './App.css'

// Top-level app. Owns which screen is showing and the running match data
// (player name, toss outcome, role decision, final result), and animates
// between screens with AnimatePresence.
function App() {
  const [screen, setScreen] = useState<ScreenName>('playerName')
  const [playerName, setPlayerName] = useState('')
  const [tossOutcome, setTossOutcome] = useState<TossOutcome | null>(null)
  const [roleDecision, setRoleDecision] = useState<RoleDecision | null>(null)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)

  const handleNameSubmit = (name: string) => {
    setPlayerName(name)
    setScreen('coinToss')
  }

  const handleTossComplete = (outcome: TossOutcome) => {
    setTossOutcome(outcome)
    setScreen('batOrBowl')
  }

  const handleRoleComplete = (decision: RoleDecision) => {
    setRoleDecision(decision)
    setScreen('gameplay')
  }

  const handleMatchComplete = (result: MatchResult) => {
    setMatchResult(result)
    setScreen('matchResult')
  }

  // Quick rematch: keep the name, drop straight back into the coin toss.
  const handlePlayAgain = () => {
    setTossOutcome(null)
    setRoleDecision(null)
    setMatchResult(null)
    setScreen('coinToss')
  }

  // Full reset: clear everything including the name, back to the welcome screen.
  const handleChangeName = () => {
    setPlayerName('')
    setTossOutcome(null)
    setRoleDecision(null)
    setMatchResult(null)
    setScreen('playerName')
  }

  return (
    <Box className="app-shell">
      <StadiumBackground />
      <AnimatePresence mode="wait">
        {screen === 'playerName' && (
          <PlayerNameScreen key="player-name" onSubmit={handleNameSubmit} />
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
        {screen === 'gameplay' && roleDecision && (
          <GameplayScreen
            key="gameplay"
            playerName={playerName}
            firstBatter={roleDecision.firstInnings}
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
