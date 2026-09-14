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

type AuthResponse = { successMessage?: string; failureMessage?: string }

// 1. POST /signup
export function signup(email: string, password: string) {
  return post<AuthResponse>('/signup', { email, password })
}

// 2. POST /login
export function login(email: string, password: string) {
  return post<AuthResponse>('/login', { email, password })
}

// 3. GET /quiz/stats — leaderboard of every player. No params. Populated
// by contest submissions (Play For Fun quizzes stay local, never posted).
export type LeaderboardEntry = {
  email: string
  score: number
  timeSeconds: number
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
    if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => typeof o !== 'string')) {
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
// were served), the player's email, and the total time spent. The server
// grades and returns the summary. No per-question breakdown comes back —
// the contest result screen only shows the totals.
export type ContestGrade = {
  correct: number
  incorrect: number
  score: number
  timeSeconds: number
}

export async function submitContest(input: {
  couponCode: string
  answers: (number | null)[]
  email: string
  timeSeconds: number
}): Promise<ContestGrade> {
  return post<ContestGrade>('/quiz/contest/submit', input)
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${BASE}/quiz/stats`)
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  const rows = (await res.json()) as LeaderboardEntry[]
  // Rank order: score high→low, then time low→high on a tie. The API
  // returns it sorted, but re-sort here so the rank column is correct
  // regardless of what the server sends back.
  return [...rows].sort((a, b) => b.score - a.score || a.timeSeconds - b.timeSeconds)
}
