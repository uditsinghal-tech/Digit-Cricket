import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import HomeIcon from '@mui/icons-material/Home'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import ShareIcon from '@mui/icons-material/Share'
import { motion, type Variants } from 'framer-motion'
import type { ContestGrade } from '../api/client'
import { OPEN_LEADERBOARD_EVENT } from '../components/LeaderboardButton'

// Contest result. Server-graded, so we only show the summary totals —
// deliberately no per-question right/wrong breakdown (the answer key
// never comes back to the client). Shows the player's current rank, opens
// the leaderboard on this contest, and makes a shareable story image.

type Props = {
  grade: ContestGrade
  playerName: string
  onHome: () => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

export default function ContestResultScreen({ grade, playerName, onHome }: Props) {
  const [shareNote, setShareNote] = useState<string | null>(null)
  const rows: [string, number][] = [
    ['Correct', grade.correct],
    ['Incorrect', grade.incorrect],
    ['Score (out of 100)', grade.score],
    ['Time (s)', grade.timeSeconds],
  ]

  const handleShare = async () => {
    setShareNote(null)
    try {
      const blob = await drawResultCard(grade, playerName)
      const file = new File([blob], 'digit-cricket-result.png', { type: 'image/png' })
      const text = `I scored ${grade.score} in ${grade.contestTitle} on Digit Cricket 🏏 ${window.location.origin}`
      // Phones: native share sheet (Instagram Story, WhatsApp...). Elsewhere: download the image.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
        setShareNote('Image downloaded. Post it to your Instagram story!')
      }
    } catch (e) {
      // Closing the share sheet throws AbortError: not a failure.
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setShareNote("Couldn't create the image on this device.")
      }
    }
  }

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
              {grade.contestTitle}
            </Typography>
            <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', pt: 1 }}>
              You're #{grade.rank} of {grade.totalPlayers}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.65 }}>
              Rank right now; it can change as more people play.
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

          <Stack direction="row" spacing={1.5}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LeaderboardIcon />}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(OPEN_LEADERBOARD_EVENT, {
                    detail: { title: grade.contestTitle },
                  }),
                )
              }
            >
              Leaderboard
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              startIcon={<ShareIcon />}
              onClick={() => void handleShare()}
            >
              Share
            </Button>
          </Stack>
          {shareNote && <Alert severity="info">{shareNote}</Alert>}

          <Button variant="contained" startIcon={<HomeIcon />} onClick={onHome}>
            Home
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}

// Instagram-story sized (1080x1920) result card drawn on a canvas: no image
// libraries, nothing uploaded. Returns a PNG blob.
function drawResultCard(grade: ContestGrade, playerName: string): Promise<Blob> {
  const W = 1080
  const H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('no canvas'))

  // Night-stadium background: deep navy into pitch green.
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0b1023')
  bg.addColorStop(0.62, '#13203f')
  bg.addColorStop(1, '#14532d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Floodlight glow.
  const glow = ctx.createRadialGradient(W / 2, 360, 40, W / 2, 360, 700)
  glow.addColorStop(0, 'rgba(56, 189, 248, 0.35)')
  glow.addColorStop(1, 'rgba(56, 189, 248, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const font = (weight: number, size: number) =>
    `${weight} ${size}px Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
  const center = (text: string, y: number, size: number, color: string, weight = 700) => {
    ctx.font = font(weight, size)
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.fillText(text, W / 2, y, W - 120)
  }

  // Brand title in the app's blue-to-purple gradient.
  ctx.font = font(800, 110)
  const brand = ctx.createLinearGradient(240, 0, 840, 0)
  brand.addColorStop(0, '#38bdf8')
  brand.addColorStop(1, '#a855f7')
  ctx.fillStyle = brand
  ctx.textAlign = 'center'
  ctx.fillText('Digit Cricket', W / 2, 330)

  center('🏏', 560, 170, '#ffffff', 400)
  center(playerName, 760, 64, '#e2e8f0', 600)
  center('scored', 850, 48, '#94a3b8', 500)
  center(String(grade.score), 1050, 220, '#fbbf24', 900)
  center('out of 100', 1130, 46, '#94a3b8', 500)
  center(`in ${grade.contestTitle}`, 1260, 60, '#f8fafc', 700)

  // Rank pill.
  const pillW = 620
  const pillH = 120
  const px = (W - pillW) / 2
  const py = 1350
  ctx.fillStyle = 'rgba(56, 189, 248, 0.18)'
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(px, py, pillW, pillH, 60)
  ctx.fill()
  ctx.stroke()
  center(`Rank #${grade.rank} of ${grade.totalPlayers}`, py + 80, 58, '#7dd3fc', 800)

  center(
    `${grade.correct}/${grade.correct + grade.incorrect} correct · ${grade.timeSeconds}s`,
    1580,
    44,
    '#cbd5e1',
    500,
  )
  center('Think you can beat me?', 1730, 54, '#f8fafc', 700)
  center(window.location.host, 1810, 44, '#38bdf8', 600)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  )
}
