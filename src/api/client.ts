// Thin fetch wrappers for the four backend endpoints documented in
// api.md (signup, login, leaderboard, contest fetch + submit). Base URL
// comes from VITE_API_BASE_URL at build time (same env convention as the
// Gemini client); defaults to '/api' so a same-origin backend or a dev
// proxy just works without config.

import type { QuizQuestion } from '../quiz/questions'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api') as string

// POSTs json and returns the parsed body. Throws Error(failureMessage)
// on a non-2xx response so callers can surface the server's message.
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.failureMessage || data?.error || `Request failed (${res.status})`)
  }
  return data as T
}

// Sign up / sign in set an HttpOnly session cookie (sent automatically on
// same-origin fetches) that identifies the player to the contest endpoints,
// and return the display name. `admin` unlocks the leaderboard export.
type AuthResponse = { successMessage?: string; name: string; admin?: boolean }
type MessageResponse = { successMessage?: string }

// 1a. POST /signup/send-code: checks name + email are free and emails a 6-digit code.
export function sendSignupCode(name: string, email: string) {
  return post<MessageResponse>('/signup/send-code', { name, email })
}

// 1b. POST /signup: creates the account once the emailed code checks out.
export function signup(name: string, email: string, password: string, code: string) {
  return post<AuthResponse>('/signup', { name, email, password, code })
}

// 2. POST /login
export function login(email: string, password: string) {
  return post<AuthResponse>('/login', { email, password })
}

// Forgot password: email a code, then set a new password with it.
export function sendResetCode(email: string) {
  return post<MessageResponse>('/password/send-code', { email })
}

export function resetPassword(email: string, code: string, password: string) {
  return post<MessageResponse>('/password/reset', { email, code, password })
}

// POST /logout: ends the server session so the cookie stops identifying the player.
export function logout() {
  return post<{ successMessage?: string }>('/logout', {})
}

// 3. GET /quiz/stats — public leaderboards, one per contest that has
// submissions, most recently active first. Each board is already ranked by
// the server (score high→low, ties: less time, then earlier submit); rank
// is the array position. Titles + display names only, no coupons/emails.
export type LeaderboardEntry = {
  name: string
  score: number
}

export type ContestBoard = {
  id: string
  title: string
  entries: LeaderboardEntry[]
}

// 4. POST /quiz/contest — validate a coupon code and, on success, get the
// contest's 20-question set back. A bad/used code is a non-2xx (post()
// throws its failureMessage). No correctIndex: contest questions are
// graded server-side on submit, so the answer key never reaches the
// client mid-quiz. Mapped to the bundled bank's shape so QuizScreen
// renders them with no special-casing.
type RawContestQuestion = {
  question?: unknown
  options?: unknown
}

export async function validateCoupon(couponCode: string): Promise<QuizQuestion[]> {
  const data = await post<{ questions?: unknown }>('/quiz/contest', { couponCode })
  const raw = data?.questions
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Contest returned no questions. Try again.')
  }
  return raw.map((entry, idx): QuizQuestion => {
    const q = entry as RawContestQuestion
    if (typeof q.question !== 'string' || !q.question.trim()) {
      throw new Error(`Contest question #${idx + 1} is missing text.`)
    }
    if (
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      q.options.some((o) => typeof o !== 'string')
    ) {
      throw new Error(`Contest question #${idx + 1} needs exactly 4 text options.`)
    }
    return {
      // Offset above the bundled bank + gemini ranges so ids never collide.
      id: 200000 + idx,
      difficulty: 'medium',
      question: q.question.trim(),
      options: (q.options as string[]).map((o) => o.trim()) as [string, string, string, string],
      // correctIndex intentionally omitted — server grades on submit.
    }
  })
}

// 5. POST /quiz/contest/submit — send the coupon, the player's chosen
// option index per question (null = skipped, in the order the questions
// were served) and the milliseconds spent on each. The player is identified
// by the session cookie. The server scores out of 100 and returns the
// summary — no per-question breakdown, so the answer key never leaks.
export type ContestGrade = {
  correct: number
  incorrect: number
  score: number
  timeSeconds: number
  // Leaderboard position right now, out of everyone who has started this contest.
  rank: number
  totalPlayers: number
  contestTitle: string
}

export async function submitContest(input: {
  couponCode: string
  answers: (number | null)[]
  timesMs: number[]
}): Promise<ContestGrade> {
  return post<ContestGrade>('/quiz/contest/submit', input)
}

export async function fetchLeaderboard(): Promise<ContestBoard[]> {
  const res = await fetch(`${BASE}/quiz/stats`)
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return (await res.json()) as ContestBoard[]
}

// Admin only (server checks the session): every entry with emails, for contacting winners.
export type AdminEntry = {
  rank: number
  name: string
  email: string
  finished: boolean
  score: number
  correct: number | null
  timeSeconds: number | null
  startedAt: string
  submittedAt: string | null
}

export async function fetchAdminResults(): Promise<
  { id: string; title: string; entries: AdminEntry[] }[]
> {
  const res = await fetch(`${BASE}/quiz/admin/results`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.failureMessage || `Request failed (${res.status})`)
  return data
}
