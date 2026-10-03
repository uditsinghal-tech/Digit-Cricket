import { useState, type FormEvent } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { motion, type Variants } from 'framer-motion'
import { login, resetPassword, sendResetCode, sendSignupCode, signup } from '../api/client'
import { ALLOWED_NAME_PATTERN, MAX_PLAYER_NAME_LENGTH, MIN_PLAYER_NAME_LENGTH } from '../game/types'

type Props = {
  // Fires with the account's display name (and admin flag) once signup/login
  // succeeds. The server-side session cookie carries the identity from here on.
  onAuthed: (name: string, admin: boolean) => void
  // Guest entry: display name only, no account and no session, so the
  // backend refuses contest calls. Play For Fun works as normal.
  onGuest: (name: string) => void
  // Which tab to open on. Defaults to Sign Up; a guest choosing "Sign In"
  // from the name chip lands on Sign In.
  initialMode?: 'signup' | 'login'
}

type Mode = 'signup' | 'login' | 'guest' | 'reset'

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// Basic email shape check — good enough for a trust-boundary gate; the
// server validates for real.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_PATTERN = /^\d{6}$/

// Entry screen. Tabs:
//   Sign Up       - name + email + password -> "Send code" emails a 6-digit code ->
//                   enter it -> account created (proves the email is theirs).
//   Sign In       - email + password, with "Forgot password?" -> reset view
//                   (email -> code -> new password).
//   Play as Guest - display name only, no account.
export default function AuthScreen({ onAuthed, onGuest, initialMode = 'signup' }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  // Step 2 of sign up / reset: a code has been emailed and the code field shows.
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const trimmedName = name.trim()
  const trimmedEmail = email.trim()
  const nameOk =
    trimmedName.length >= MIN_PLAYER_NAME_LENGTH &&
    trimmedName.length <= MAX_PLAYER_NAME_LENGTH &&
    ALLOWED_NAME_PATTERN.test(trimmedName)
  const emailOk = EMAIL_PATTERN.test(trimmedEmail)
  const passwordOk = password.length >= 8 && password.length <= 72
  const codeOk = CODE_PATTERN.test(code.trim())

  const canSubmit =
    !busy &&
    (mode === 'guest'
      ? nameOk
      : mode === 'login'
        ? emailOk && passwordOk
        : mode === 'signup'
          ? nameOk && emailOk && passwordOk && (!codeSent || codeOk)
          : emailOk && (!codeSent || (codeOk && passwordOk)))

  const switchMode = (next: Mode) => {
    setMode(next)
    setCodeSent(false)
    setCode('')
    setError(null)
    setInfo(null)
  }

  // Runs an API call with the busy flag + error/info handling shared by every step.
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const sendCode = () =>
    run(async () => {
      const res =
        mode === 'signup'
          ? await sendSignupCode(trimmedName, trimmedEmail)
          : await sendResetCode(trimmedEmail)
      setCodeSent(true)
      setCode('')
      setInfo(`${res.successMessage ?? 'Code sent.'} Check your inbox (and spam).`)
    })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    if (mode === 'guest') {
      onGuest(trimmedName)
      return
    }
    if ((mode === 'signup' || mode === 'reset') && !codeSent) {
      await sendCode()
      return
    }
    await run(async () => {
      if (mode === 'reset') {
        const res = await resetPassword(trimmedEmail, code.trim(), password)
        switchMode('login')
        setPassword('')
        setInfo(res.successMessage ?? 'Password updated. Sign in with your new password.')
        return
      }
      // A 2xx is success — the client throws on any non-2xx. Signup also
      // signs the player in (the server sets the session cookie on both).
      const res =
        mode === 'signup'
          ? await signup(trimmedName, trimmedEmail, password, code.trim())
          : await login(trimmedEmail, password)
      onAuthed(res.name, res.admin === true)
    })
  }

  const submitLabel = busy
    ? 'Please wait…'
    : mode === 'guest'
      ? 'Continue as guest'
      : mode === 'login'
        ? 'Sign in'
        : !codeSent
          ? mode === 'signup'
            ? 'Send verification code'
            : 'Send reset code'
          : mode === 'signup'
            ? 'Create account'
            : 'Reset password'

  const codeField = (
    <TextField
      autoFocus
      fullWidth
      label="6-digit code"
      placeholder="Check your email"
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'one-time-code' } }}
      helperText={
        <Button
          size="small"
          disabled={busy}
          onClick={() => void sendCode()}
          sx={{ p: 0, minWidth: 0, textTransform: 'none' }}
        >
          Didn't get it? Send a new code
        </Button>
      }
    />
  )

  return (
    <motion.div
      key="auth-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ width: '100%', maxWidth: 420, px: 3, pt: 1, pb: 2, textAlign: 'center' }}
      >
        <Stack spacing={2} alignItems="center">
          <Typography variant="h3" component="h1" className="title">
            Digit Cricket
          </Typography>

          <ToggleButtonGroup
            exclusive
            value={mode === 'reset' ? 'login' : mode}
            onChange={(_, next: Mode | null) => {
              if (next) switchMode(next)
            }}
            fullWidth
            color="primary"
          >
            <ToggleButton value="signup">Sign Up</ToggleButton>
            <ToggleButton value="login">Sign In</ToggleButton>
            <ToggleButton value="guest">Play as Guest</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'guest' && (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Playing as a guest: Play For Fun quizzes and cricket are open. Contests need an
              account.
            </Typography>
          )}
          {mode === 'reset' && (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Forgot your password? We'll email you a code to set a new one.
            </Typography>
          )}

          {(mode === 'signup' || mode === 'guest') && (
            <TextField
              fullWidth
              autoFocus={mode === 'guest'}
              disabled={codeSent}
              label="Display name"
              placeholder={
                mode === 'guest' ? 'What should we call you?' : 'Shown on the leaderboard'
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={name.length > 0 && !nameOk}
              helperText={
                name.length > 0 && !nameOk
                  ? `${MIN_PLAYER_NAME_LENGTH}-${MAX_PLAYER_NAME_LENGTH} letters, numbers or spaces`
                  : mode === 'guest'
                    ? ' '
                    : 'Must be unique. Shown on the leaderboard'
              }
            />
          )}

          {mode !== 'guest' && (
            <TextField
              autoFocus={!codeSent}
              fullWidth
              disabled={codeSent}
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={email.length > 0 && !emailOk}
              helperText={
                email.length > 0 && !emailOk
                  ? 'Enter a valid email'
                  : mode === 'signup'
                    ? "We'll email a code to confirm it's yours"
                    : ' '
              }
            />
          )}

          {(mode === 'login' || mode === 'signup' || (mode === 'reset' && codeSent)) && (
            <TextField
              fullWidth
              disabled={mode === 'signup' && codeSent}
              type="password"
              label={mode === 'reset' ? 'New password' : 'Password'}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={password.length > 0 && !passwordOk}
              helperText={password.length > 0 && !passwordOk ? '8-72 characters' : ' '}
            />
          )}

          {codeSent && (mode === 'signup' || mode === 'reset') && codeField}

          {info && !error && (
            <Alert severity="success" sx={{ width: '100%', textAlign: 'left' }}>
              {info}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ width: '100%', textAlign: 'left' }}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={!canSubmit}
            sx={{ py: 1.25, fontSize: '1rem' }}
          >
            {submitLabel}
          </Button>

          {mode === 'login' && (
            <Button size="small" onClick={() => switchMode('reset')} sx={{ textTransform: 'none' }}>
              Forgot password?
            </Button>
          )}
          {mode === 'reset' && (
            <Button size="small" onClick={() => switchMode('login')} sx={{ textTransform: 'none' }}>
              Back to sign in
            </Button>
          )}
          {mode === 'signup' && codeSent && (
            <Button
              size="small"
              onClick={() => switchMode('signup')}
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              Change name, email or password
            </Button>
          )}
        </Stack>
      </Box>
    </motion.div>
  )
}
