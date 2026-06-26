// Chat-safety pipeline. Runs on both sides of the wire:
//   - Sender: sanitises before `sendNetwork(...)` so we don't transmit
//     raw control characters or oversized strings.
//   - Receiver: sanitises again on inbound CHAT, because a hostile peer
//     could bypass their local sanitiser and send a hand-crafted payload.
//
// React's JSX rendering already escapes HTML, so injection via `<script>`
// is not a vector here — the text is rendered through Typography
// children, not `dangerouslySetInnerHTML`. This module's job is to:
//   1. Strip ASCII control characters (except \n and \t).
//   2. Strip zero-width / Unicode bidi-control characters that could be
//      used to spoof what the rendered text actually says.
//   3. Collapse pathological whitespace runs so a peer can't flood the
//      chat with an all-space message.
//   4. Enforce the protocol length cap.
//
// Profanity / abusive-word filtering is intentionally NOT shipped with
// this codebase. If you need it, plug in a third-party moderation
// library (e.g. `bad-words`, `obscenity`) and call its sanitise function
// inside `sanitizeChatMessage` below.

// Public entry point. Takes a raw chat message and the protocol's max
// length, returns the cleaned text, or `null` if the message reduced to
// nothing useful (empty after trim, or only control characters).
export function sanitizeChatMessage(input: unknown, maxLength: number): string | null {
  if (typeof input !== 'string') return null

  // 1. Strip ASCII control characters (NUL through US, plus DEL) but
  //    keep \n and \t so multi-line messages still arrive readably.
  let text = input.replace(/[ --]/g, '')

  // 2. Strip zero-width and Unicode bidi-control characters used to
  //    spoof what the rendered text actually says.
  text = text.replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')

  // 3. Collapse pathological whitespace runs and trim.
  text = text.replace(/\s+/g, ' ').trim()

  if (!text) return null

  // 4. Enforce the protocol length cap.
  if (text.length > maxLength) text = text.slice(0, maxLength)

  return text
}
