import { useState, type FormEvent } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import { motion, type Variants } from 'framer-motion'
import { MAX_PLAYER_NAME_LENGTH, MIN_PLAYER_NAME_LENGTH } from '../game/types'

// Whitelist of characters allowed in a player name. Letters (incl. Unicode
// for international names), digits, and spaces only. Everything else —
// quotes, angle brackets, ampersands, backticks, slashes, semicolons, etc.
// — is rejected. Rendering already escapes via React, but blocking these
// at input time keeps malformed names out of the PeerJS HELLO payload and
// out of the scoreboard / result UI.
const ALLOWED_NAME_PATTERN = /^[\p{L}\p{N} ]*$/u

type Props = {
  onSubmit: (name: string) => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

// Welcome / name entry. Trims input, blocks empty names and overlong ones,
// and only shows the error message after the field has been touched.
export default function PlayerNameScreen({ onSubmit }: Props) {
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)

  const trimmed = value.trim()
  const isEmpty = trimmed.length === 0
  const isTooShort = trimmed.length > 0 && trimmed.length < MIN_PLAYER_NAME_LENGTH
  const isTooLong = trimmed.length > MAX_PLAYER_NAME_LENGTH
  const hasInvalidChars = trimmed.length > 0 && !ALLOWED_NAME_PATTERN.test(trimmed)
  const isInvalid = isEmpty || isTooShort || isTooLong || hasInvalidChars
  const showEmptyError = touched && isEmpty
  const showShortError = touched && isTooShort
  const showLengthError = isTooLong
  const showInvalidCharsError = touched && hasInvalidChars
  const errorText = showEmptyError
    ? 'Please enter a name to continue'
    : showShortError
      ? `Min ${MIN_PLAYER_NAME_LENGTH} characters`
      : showLengthError
        ? `Max ${MAX_PLAYER_NAME_LENGTH} characters`
        : showInvalidCharsError
          ? 'Only letters, numbers, and spaces allowed'
          : ' '

  // Form submit handler. Marks the field as touched so errors are allowed to
  // show, blocks if invalid, otherwise hands the trimmed name to the parent.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched(true)
    if (isInvalid) return
    onSubmit(trimmed)
  }

  return (
    <motion.div
      key="player-name-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: '100%',
          maxWidth: 480,
          px: 3,
          py: 6,
          textAlign: 'center',
        }}
      >
        <Stack spacing={4} alignItems="center">
          <BouncingBatBall />

          <Stack spacing={1} alignItems="center">
            <Typography variant="h3" component="h1" className="title">
              Welcome to Digit Cricket
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.75 }}>
              Enter your name to start the match.
            </Typography>
          </Stack>

          <TextField
            autoFocus
            fullWidth
            label="Player name"
            placeholder="e.g. Virat"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            error={showEmptyError || showLengthError}
            helperText={errorText}
            slotProps={{ htmlInput: { maxLength: MAX_PLAYER_NAME_LENGTH + 5 } }}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={isInvalid}
            sx={{ py: 1.25, fontSize: '1rem' }}
          >
            Continue
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}

// Welcome-screen ornament. A red leather cricket ball falls straight down,
// strikes a horizontal willow bat, and rebounds straight back up on a loop.
// The bat dips a couple of pixels at the moment of contact so the impact
// reads as a real hit rather than a sprite passing through a flat shape.
function BouncingBatBall() {
  // Shared duration keeps the ball drop / rise and the bat dip in lockstep.
  // 1.4s feels lively without becoming busy.
  const cycle = 1.4
  return (
    <Box
      className="welcome-logo"
      sx={{
        position: 'relative',
        width: 200,
        height: 160,
        // Soft ground shadow underneath the bat for a sense of "floor".
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 130,
          height: 8,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.4), transparent 70%)',
          filter: 'blur(2px)',
        },
      }}
    >
      {/* Horizontal bat. Sits flat with the flat blade-face up so the ball
          can drop straight onto it. Dips a couple of pixels on contact
          (t ≈ 0.5 of the cycle) then springs back. */}
      <motion.div
        animate={{ y: [0, 0, 4, 1, 0] }}
        transition={{
          duration: cycle,
          repeat: Infinity,
          times: [0, 0.42, 0.5, 0.58, 1],
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          bottom: 32,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <svg width="200" height="44" viewBox="0 0 200 44">
          <defs>
            {/* Vertical gradient on the willow so the top reads as the
                struck face (slightly lighter) and the underside is in shadow. */}
            <linearGradient id="willowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="55%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
            <linearGradient id="gripGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1f2937" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          {/* Bat blade: long rounded "loaf" lying on its back, flat-top to
              receive the ball. Handle is on the right. */}
          <path
            d="M 6 14 Q 4 8 14 6 L 134 6 Q 142 6 142 12 L 142 30 Q 142 36 134 36 L 14 36 Q 4 34 6 28 Z"
            fill="url(#willowGrad)"
            stroke="#78350f"
            strokeWidth="1.4"
          />
          {/* Wood-grain hints running along the length of the blade. */}
          <path d="M 14 14 Q 70 12 134 14" stroke="#b45309" strokeWidth="0.9" fill="none" opacity="0.55" />
          <path d="M 14 22 Q 70 21 134 22" stroke="#b45309" strokeWidth="0.9" fill="none" opacity="0.55" />
          <path d="M 14 30 Q 70 29 134 30" stroke="#b45309" strokeWidth="0.9" fill="none" opacity="0.4" />

          {/* Shoulder transition from blade to handle. */}
          <path d="M 142 14 L 152 16 L 152 26 L 142 28 Z" fill="#a16207" />

          {/* Handle: dark wrapped grip with binding rings. */}
          <rect x="152" y="16" width="44" height="10" rx="3" fill="url(#gripGrad)" />
          <rect x="158" y="16" width="2" height="10" fill="#475569" />
          <rect x="166" y="16" width="2" height="10" fill="#475569" />
          <rect x="174" y="16" width="2" height="10" fill="#475569" />
          <rect x="182" y="16" width="2" height="10" fill="#475569" />
          <rect x="190" y="16" width="2" height="10" fill="#475569" />
          {/* Knob at the far end of the handle. */}
          <circle cx="196" cy="21" r="3" fill="#0f172a" />
        </svg>
      </motion.div>

      {/* Red leather cricket ball. Drops straight down (easeIn = gravity)
          onto the top edge of the blade, then rebounds straight up (easeOut
          = decelerating rise) for the next drop. No horizontal motion;
          motion is purely vertical to read as a clean bat-ball impact. */}
      <motion.div
        animate={{
          y: [0, 80, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: cycle,
          repeat: Infinity,
          times: [0, 0.5, 1],
          ease: ['easeIn', 'easeOut'],
        }}
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          width: 22,
          height: 22,
          marginLeft: -11,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22">
          <defs>
            {/* Radial gradient gives the ball a leather sheen with a darker
                shaded underside, so it doesn't read as a flat circle. */}
            <radialGradient id="ballGrad" cx="35%" cy="32%" r="70%">
              <stop offset="0%" stopColor="#fecaca" />
              <stop offset="40%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </radialGradient>
          </defs>
          <circle cx="11" cy="11" r="10" fill="url(#ballGrad)" stroke="#450a0a" strokeWidth="0.6" />
          {/* Equatorial seam with off-white stitching. */}
          <path d="M 2 11 Q 11 6 20 11" stroke="#fef9c3" strokeWidth="0.9" fill="none" />
          <path d="M 2 11 Q 11 16 20 11" stroke="#fef9c3" strokeWidth="0.9" fill="none" opacity="0.5" />
          {/* Tick marks suggesting individual stitches. */}
          {[4, 7, 10, 13, 16, 19].map((x, i) => (
            <line
              key={i}
              x1={x}
              y1={10}
              x2={x}
              y2={12}
              stroke="#fef9c3"
              strokeWidth="0.5"
            />
          ))}
          {/* Small specular highlight to sell the leather sheen. */}
          <ellipse cx="7" cy="6" rx="3.4" ry="1.8" fill="rgba(255,255,255,0.55)" />
        </svg>
      </motion.div>
    </Box>
  )
}
