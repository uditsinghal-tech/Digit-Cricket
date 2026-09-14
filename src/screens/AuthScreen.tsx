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
import { signup, login } from '../api/client'

type Props = {
  // Fires with the verified email once signup/login succeeds.
  onAuthed: (email: string) => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// Basic email shape check — good enough for a trust-boundary gate; the
// server validates for real.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Entry screen. Collects an email + password and calls either the signup
// or login endpoint depending on the selected mode. On success it hands
// the email up to App, which uses it as the identity for quiz stats.
export default function AuthScreen({ onAuthed }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const emailOk = EMAIL_PATTERN.test(email.trim())
  const passwordOk = password.length >= 8
  const canSubmit = emailOk && passwordOk && !busy

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const trimmed = email.trim()
      // A 2xx is success — the client throws on any non-2xx. Don't inspect
      // failureMessage here: the server returns both message fields on
      // every response, so it's non-empty even on success. Signup success
      // is treated as an automatic sign-in and advances just like login.
      if (mode === 'signup') await signup(trimmed, password)
      else await login(trimmed, password)
      onAuthed(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

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
            value={mode}
            onChange={(_, next) => {
              if (next) {
                setMode(next)
                setError(null)
              }
            }}
            size="small"
          >
            <ToggleButton value="login">Sign In</ToggleButton>
            <ToggleButton value="signup">Sign Up</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            autoFocus
            fullWidth
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={email.length > 0 && !emailOk}
            helperText={email.length > 0 && !emailOk ? 'Enter a valid email' : ' '}
          />

          <TextField
            fullWidth
            type="password"
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={password.length > 0 && !passwordOk}
            helperText={password.length > 0 && !passwordOk ? 'Min 8 characters' : ' '}
          />

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
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}
