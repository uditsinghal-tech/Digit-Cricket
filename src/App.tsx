import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import { AnimatePresence } from 'framer-motion'
import PlayerNameScreen from './screens/PlayerNameScreen'
import ModeSelectionScreen from './screens/ModeSelectionScreen'
import MatchLengthScreen from './screens/MatchLengthScreen'
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
import { useMultiplayer } from './multiplayer/useMultiplayer'
import type { NetworkMessage } from './multiplayer/messages'
import type {
  BallsPerInnings,
  GameMode,
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

  // Saves the entered name and advances to the mode selector.
  const handleNameSubmit = (name: string) => {
    setPlayerName(name)
    setScreen('modeSelect')
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

  // Singleplayer match-length picker callback — saves the chosen number of
  // balls per innings and advances to the coin toss.
  const handleMatchLengthSelect = (count: BallsPerInnings) => {
    setBallsPerInnings(count)
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

  // Stores the final match result and advances to the result screen.
  const handleMatchComplete = (result: MatchResult) => {
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
      <Box sx={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
      <AnimatePresence mode="wait">
        {screen === 'playerName' && (
          <PlayerNameScreen key="player-name" onSubmit={handleNameSubmit} />
        )}
        {screen === 'modeSelect' && (
          <ModeSelectionScreen
            key="mode-select"
            playerName={playerName}
            onSelect={handleModeSelect}
          />
        )}
        {screen === 'matchLength' && (
          <MatchLengthScreen
            key="match-length"
            playerName={playerName}
            onSelect={handleMatchLengthSelect}
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
            opponentName="Computer"
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
    </Box>
  )
}

export default App
