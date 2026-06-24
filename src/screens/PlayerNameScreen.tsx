import { useState, type FormEvent } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import SportsCricketIcon from '@mui/icons-material/SportsCricket'
import { motion, type Variants } from 'framer-motion'
import { MAX_PLAYER_NAME_LENGTH } from '../game/types'

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
  const isTooLong = trimmed.length > MAX_PLAYER_NAME_LENGTH
  const showEmptyError = touched && isEmpty
  const showLengthError = isTooLong
  const errorText = showEmptyError
    ? 'Please enter a name to continue'
    : showLengthError
      ? `Max ${MAX_PLAYER_NAME_LENGTH} characters`
      : ' '

  // Form submit handler. Marks the field as touched so errors are allowed to
  // show, blocks if invalid, otherwise hands the trimmed name to the parent.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched(true)
    if (isEmpty || isTooLong) return
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
          <motion.div
            initial={{ rotate: -8, scale: 0.8, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 120 }}
          >
            <SportsCricketIcon sx={{ fontSize: 64, color: 'primary.main' }} />
          </motion.div>

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
            disabled={isEmpty || isTooLong}
            sx={{ py: 1.25, fontSize: '1rem' }}
          >
            Continue
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}
