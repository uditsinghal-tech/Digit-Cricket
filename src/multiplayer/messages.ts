import type { BallNumber, BallsPerInnings, Role, Side } from '../game/types'

// Network protocol used by the two peers to communicate over the PeerJS
// data channel. Every message is a JSON object with a literal `type` field —
// new message kinds are added by extending this union.
//
// Future Parts will add PICK, REPLAY_REQUEST, etc.
export type NetworkMessage =
  // Sent right after the connection opens. Carries the player's display name
  // so the other side can label them in the UI.
  | { type: 'HELLO'; name: string }
  // Sent by the host once they've chosen 6 or 12 balls per innings. The
  // joiner subscribes to this and adopts the same value locally.
  | { type: 'MATCH_LENGTH'; balls: BallsPerInnings }
  // Sent by the joiner when they call heads or tails. The host receives this,
  // generates the random coin result, and broadcasts TOSS_RESULT.
  | { type: 'TOSS_CALL'; side: Side }
  // Sent by the host after it has rolled the random coin. The joiner adopts
  // this as the authoritative coin-landing side.
  | { type: 'TOSS_RESULT'; result: Side }
  // Sent by the toss winner once they've picked Bat or Bowl. The other side
  // adopts the choice and both derive firstInnings locally.
  | { type: 'ROLE_CHOICE'; role: Role }
  // Sent by each peer on every ball with their chosen 1-6 number. Both sides
  // exchange picks; each peer dispatches PICK to its local cricket machine
  // once it has both its own and the opponent's pick.
  | { type: 'PICK'; number: BallNumber }
  // Sent when a peer clicks "Play again" on the result screen. The local
  // side enters a "waiting for opponent" state; once both peers have sent
  // REMATCH_REQUEST, both navigate back to the multiplayer coin toss.
  | { type: 'REMATCH_REQUEST' }

// Convenience type for anyone subscribing to incoming messages.
export type MessageHandler = (msg: NetworkMessage) => void
