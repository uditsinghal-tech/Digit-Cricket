import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import HomeIcon from '@mui/icons-material/Home'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import { motion, type Variants } from 'framer-motion'
import type { ContestGrade } from '../api/client'

// Contest result. Server-graded, so we only show the summary totals —
// deliberately no per-question right/wrong breakdown (the answer key
// never comes back to the client).

type Props = {
  grade: ContestGrade
  onHome: () => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

export default function ContestResultScreen({ grade, onHome }: Props) {
  const rows: [string, number][] = [
    ['Correct', grade.correct],
    ['Incorrect', grade.incorrect],
    ['Score', grade.score],
    ['Time (s)', grade.timeSeconds],
  ]

  return (
    <motion.div
      key="contest-result-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box sx={{ width: '100%', maxWidth: 440, px: 3, py: 4 }}>
        <Stack spacing={3} alignItems="stretch">
          <Stack spacing={1} alignItems="center">
            <EmojiEventsIcon sx={{ fontSize: 48, color: '#fbbf24' }} />
            <Typography variant="h4" component="h1" className="title">
              Contest submitted!
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              Here's how you did.
            </Typography>
          </Stack>

          <Stack spacing={1}>
            {rows.map(([label, value]) => (
              <Stack
                key={label}
                direction="row"
                justifyContent="space-between"
                sx={{
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: 2,
                  px: 2,
                  py: 1.25,
                  background: 'rgba(15, 23, 42, 0.55)',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <Typography sx={{ opacity: 0.8 }}>{label}</Typography>
                <Typography sx={{ fontWeight: 700 }}>{value}</Typography>
              </Stack>
            ))}
          </Stack>

          <Button variant="contained" startIcon={<HomeIcon />} onClick={onHome}>
            Home
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}
