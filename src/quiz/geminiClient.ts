// Thin wrapper around the official Google Generative AI SDK that turns
// a user's custom-quiz choices into a real quiz of N validated multiple
// choice questions. Reads the API key from the Vite env at module load
// (Vite inlines anything prefixed with `VITE_` into the bundle at build
// time, so the key is set per developer / per deploy, never typed in by
// the player).
//
// The exported `generateCustomQuiz` is the only entry point — it builds
// the prompt, calls Gemini in JSON mode, parses the response, validates
// every field, and hands back an array shaped exactly like the static
// QuizQuestion type so the existing QuizScreen can render it without
// any special-case branching.

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Difficulty, QuizQuestion } from './questions'

// Vite injects env vars whose names start with VITE_ at build time.
// Anything else stays on the server. We read once at module load
// because the value never changes during a session.
const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY ?? '') as string

// Pick the model centrally so a future upgrade is a one-line change.
// `gemini-3.5-flash` is the fast / cheap option for short JSON
// generations like this. Swap to `gemini-3.5-flash` for higher quality
// at the cost of latency.
const MODEL_ID = 'gemini-3.5-flash'

// Choices the user makes on the Customize Quiz screen.
export type CustomQuizOptions = {
  // 1..20, clamped server-side too.
  count: number
  // Multiselect: the user can want men's only, women's only, or both.
  scopes: ('mens' | 'womens')[]
  // Multiselect: which slices of the sport the questions should cover.
  // These are the labels the dropdown renders.
  topics: string[]
}

// What we expect Gemini to return per question, before validation. Kept
// permissive on the way in (string for correctIndex etc.) so we can
// trip detailed errors instead of a runtime crash.
type RawGeminiQuestion = {
  question?: unknown
  options?: unknown
  correctIndex?: unknown
  difficulty?: unknown
}

const ALLOWED_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme']

// Public entry point. Builds the prompt, calls Gemini, parses + validates
// the response, and returns the questions in the same shape the bundled
// QUIZ_QUESTIONS bank uses.
export async function generateCustomQuiz(options: CustomQuizOptions): Promise<QuizQuestion[]> {
  if (!API_KEY) {
    throw new Error(
      'Ooohhh Damm!! AI is sleeping... Zzzz...')
  }

  // Sanity-bound the count so a bad caller can't ask for 9999 questions
  // and stall the API.
  const count = Math.max(1, Math.min(20, Math.round(options.count)))

  const ai = new GoogleGenerativeAI(API_KEY)
  const model = ai.getGenerativeModel({
    model: MODEL_ID,
    // Force the model to emit JSON only. This is the cleanest way to
    // get a parseable response; without it the model tends to wrap the
    // JSON in markdown code fences or add a polite preamble.
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })

  const prompt = buildPrompt(count, options.scopes, options.topics)

  const result = await model.generateContent(prompt)
  const raw = result.response.text()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Ooohhh Damm!! You need to try again buddy')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Ooohhh Damm!! You need to try again buddy')
  }

  // Validate each entry. We're strict here on purpose: a malformed
  // question would render as a broken card in the quiz, which is worse
  // than a clear error and a retry.
  const questions: QuizQuestion[] = []
  parsed.forEach((entry, idx) => {
    const q = entry as RawGeminiQuestion
    if (typeof q.question !== 'string' || !q.question.trim()) {
      throw new Error(`Question #${idx + 1} is missing or empty.`)
    }
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question #${idx + 1} needs exactly 4 options.`)
    }
    if (q.options.some((o) => typeof o !== 'string' || !o.trim())) {
      throw new Error(`Question #${idx + 1} has an empty option.`)
    }
    const correctIndex = Number(q.correctIndex)
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      throw new Error(`Question #${idx + 1} has an invalid correctIndex.`)
    }
    const difficulty =
      typeof q.difficulty === 'string' && (ALLOWED_DIFFICULTIES as string[]).includes(q.difficulty)
        ? (q.difficulty as Difficulty)
        : 'medium'

    questions.push({
      // Synthetic id offset above the bundled bank's 1..1000 range so
      // the two never collide if they ever land in the same screen.
      id: 100000 + idx,
      difficulty,
      question: q.question.trim(),
      options: q.options.map((o) => (o as string).trim()) as [string, string, string, string],
      correctIndex: correctIndex as 0 | 1 | 2 | 3,
    })
  })

  if (questions.length === 0) {
    throw new Error('Gemini returned an empty set of questions. Try again.')
  }

  return questions
}

// Builds the prompt sent to Gemini. Kept in one place so tweaking the
// instructions is a single edit. The structure follows the standard
// LLM-prompt pattern: role first, then constraints, then the strict
// output format with an example schema, then a reminder to return only
// the JSON.
function buildPrompt(count: number, scopes: CustomQuizOptions['scopes'], topics: string[]): string {
  const scopeText =
    scopes.length === 0
      ? "any cricket"
      : scopes.length === 2
        ? "both men's and women's cricket"
        : scopes[0] === 'mens'
          ? "men's cricket only"
          : "women's cricket only"

  const topicsText =
    topics.length === 0 ? 'general cricket knowledge' : topics.join(', ')

  return `You are an expert cricket trivia author writing a multiple choice quiz.

Generate exactly ${count} unique multiple choice questions about cricket.

Scope: ${scopeText}.
Topics to cover: ${topicsText}.

Rules:
1. Every question must be factually accurate and verifiable.
2. Every question has exactly four plausible options. One is the right answer, the other three are realistic distractors.
3. Vary the difficulty across the set. Tag each question with a difficulty value of "easy", "medium", "hard", or "extreme".
4. Do not repeat questions across the set.
5. Phrase questions as a single sentence ending with a question mark.
6. Do not reference the player by name or address them directly.
7. Do not include explanations or commentary in the response.

Return ONLY a valid JSON array. No markdown, no code fences, no prose before or after. The array must look exactly like this schema (values are examples):

[
  {
    "question": "Which country won the inaugural ICC Cricket World Cup in 1975?",
    "options": ["Australia", "England", "West Indies", "India"],
    "correctIndex": 2,
    "difficulty": "easy"
  }
]

correctIndex is the zero based index into the options array of the right answer. It must be 0, 1, 2, or 3.

Return only the JSON array now.`
}
