import { useEffect, useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import BarChartIcon from '@mui/icons-material/BarChart'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import GroupsIcon from '@mui/icons-material/Groups'
import QuizIcon from '@mui/icons-material/Quiz'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { motion } from 'framer-motion'
import {
  readStats,
  resetStats,
  grandTotal,
  totalAcross,
  winPercent,
  average,
  strikeRate,
  correctPercent,
  type MatchBucket,
  type MatchesByFormat,
  type PlayerStats,
} from '../stats/playerStats'

// ATTEMPT 3 — "premium dashboard" look.
// Sleek SaaS-dashboard aesthetic: muted slate palette, soft elevation,
// large circular progress rings for the headline percentages, and
// animated counters that tick from 0 to value on open. No bright
// decorative gradients — the focus is the numbers, with one cool-cyan
// accent and traffic-light status colours.
//
// Logic + state are identical to attempts 1 and 2; only visuals changed.

const COLORS = {
  bg: '#0b1220',
  card: 'rgba(30, 41, 59, 0.7)',
  cardBorder: 'rgba(148, 163, 184, 0.18)',
  cardBorderStrong: 'rgba(148, 163, 184, 0.35)',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  accent: '#06b6d4',
  win: '#10b981',
  tie: '#f59e0b',
  loss: '#ef4444',
  highScore: '#fbbf24',
  ring: '#1e293b',
} as const

export default function StatsButton() {
  const [open, setOpen] = useState(false)
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const handleOpen = () => {
    setStats(readStats())
    setConfirmingReset(false)
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setConfirmingReset(false)
  }

  const handleResetConfirm = () => {
    resetStats()
    setStats(readStats())
    setConfirmingReset(false)
  }

  return (
    <>
      <Tooltip title="My stats" arrow>
        <IconButton
          onClick={handleOpen}
          aria-label="My stats"
          sx={{
            position: 'fixed',
            top: 12,
            right: 156,
            zIndex: 10,
            color: 'rgba(248, 250, 252, 0.78)',
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            '&:hover': {
              color: '#f8fafc',
              background: 'rgba(15, 23, 42, 0.8)',
            },
          }}
        >
          <BarChartIcon />
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
        PaperProps={{
          sx: {
            background: COLORS.bg,
            color: COLORS.text,
            border: `1px solid ${COLORS.cardBorderStrong}`,
            borderRadius: 3,
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 1.75,
            borderBottom: `1px solid ${COLORS.cardBorder}`,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${COLORS.accent}1f`,
                border: `1px solid ${COLORS.accent}66`,
                color: COLORS.accent,
              }}
            >
              <TrendingUpIcon />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.7rem', letterSpacing: '0.18em', color: COLORS.textMuted, fontWeight: 600 }}>
                DASHBOARD
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                My Stats
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent
          dividers
          sx={{
            background: 'transparent',
            borderColor: COLORS.cardBorder,
            py: 2.5,
            px: 2.5,
          }}
        >
          {stats && <StatsBody stats={stats} />}
        </DialogContent>

        <DialogActions
          sx={{
            justifyContent: 'space-between',
            px: 2.5,
            py: 1.5,
            borderTop: `1px solid ${COLORS.cardBorder}`,
          }}
        >
          {confirmingReset ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ color: COLORS.loss, fontWeight: 600 }}>
                Erase all stats?
              </Typography>
              <Button size="small" color="error" variant="contained" onClick={handleResetConfirm}>
                Yes, reset
              </Button>
              <Button
                size="small"
                onClick={() => setConfirmingReset(false)}
                sx={{ color: COLORS.text }}
              >
                Cancel
              </Button>
            </Stack>
          ) : (
            <Button
              startIcon={<RestartAltIcon />}
              onClick={() => setConfirmingReset(true)}
              sx={{ color: COLORS.loss, fontWeight: 600 }}
            >
              Reset
            </Button>
          )}
          <Button onClick={handleClose} sx={{ color: COLORS.accent, fontWeight: 600 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function StatsBody({ stats }: { stats: PlayerStats }) {
  const overall = grandTotal(stats)
  const overallPct = winPercent(overall)
  const vsCompTotal = totalAcross(stats.matches.vsComputer)
  const vsFriendTotal = totalAcross(stats.matches.vsFriend)
  return (
    <Stack spacing={2.25}>
      <OverallCard overall={overall} pct={overallPct} />

      <Stack direction="row" spacing={1.5}>
        <SideCard
          title="Vs DigitCricket"
          subtitle="Singleplayer"
          icon={<SmartToyIcon />}
          total={vsCompTotal}
          buckets={stats.matches.vsComputer}
          ringColor={COLORS.accent}
        />
        <SideCard
          title="Vs Friend"
          subtitle="Multiplayer"
          icon={<GroupsIcon />}
          total={vsFriendTotal}
          buckets={stats.matches.vsFriend}
          ringColor="#a78bfa"
        />
      </Stack>

      <QuizCard quiz={stats.quiz} />
    </Stack>
  )
}

// --- Overall hero card ----------------------------------------------------

function OverallCard({
  overall,
  pct,
}: {
  overall: MatchBucket
  pct: number | null
}) {
  return (
    <Card>
      <Stack direction="row" alignItems="center" spacing={2}>
        <ProgressRing
          value={pct ?? 0}
          size={88}
          thickness={10}
          color={pctColor(pct)}
          label="WIN"
          subValue={fmtPct(pct)}
        />
        <Box sx={{ flex: 1 }}>
          <SectionLabel
            icon={<EmojiEventsIcon fontSize="small" />}
            title="Overall"
            subtitle="Across every match"
            accent={COLORS.highScore}
          />
          <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
            <StatLine label="Matches" value={overall.played} accent={COLORS.text} />
            <StatLine label="Wins" value={overall.won} accent={COLORS.win} />
            <StatLine label="Ties" value={overall.tied} accent={COLORS.tie} />
            <StatLine
              label="Win %"
              value={fmtPct(pct)}
              accent={pctColor(pct)}
            />
            <StatLine label="4s" value={overall.fours} accent="#38bdf8" />
            <StatLine label="6s" value={overall.sixes} accent="#a855f7" />
            <StatLine
              label="High score"
              value={overall.played === 0 ? '—' : overall.highScore}
              accent={COLORS.highScore}
            />
          </Stack>
        </Box>
      </Stack>
    </Card>
  )
}

// --- Per-side card --------------------------------------------------------

function SideCard({
  title,
  subtitle,
  icon,
  total,
  buckets,
  ringColor,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  total: MatchBucket
  buckets: MatchesByFormat
  ringColor: string
}) {
  const pct = winPercent(total)
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Card padded>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.25 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${ringColor}1f`,
              color: ringColor,
              border: `1px solid ${ringColor}55`,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.1 }}>
              {title}
            </Typography>
            <Typography sx={{ color: COLORS.textFaint, fontSize: '0.7rem', letterSpacing: '0.06em' }}>
              {subtitle.toUpperCase()}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.5}>
          <ProgressRing
            value={pct ?? 0}
            size={64}
            thickness={7}
            color={pctColor(pct)}
            label="WIN"
            subValue={fmtPct(pct)}
            small
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <MiniRow label="Matches" value={total.played} />
            <MiniRow label="Won" value={total.won} accent={COLORS.win} />
            <MiniRow label="Tied" value={total.tied} accent={COLORS.tie} />
          </Box>
        </Stack>

        <Box sx={{ mt: 1.25, borderTop: `1px dashed ${COLORS.cardBorder}`, pt: 1 }}>
          <FormatHeader />
          <FormatRow label="6 Ball" bucket={buckets.sixBall} />
          <FormatRow label="12 Ball" bucket={buckets.twelveBall} />
          <FormatRow label="Test" bucket={buckets.test} />
        </Box>
      </Card>
    </Box>
  )
}

// Header row for the per-format table inside a side card. Sits above the
// data rows so the columns read like a mini scorecard.
function FormatHeader() {
  return (
    <Stack
      direction="row"
      sx={{
        py: 0.5,
        borderBottom: `1px solid ${COLORS.cardBorder}`,
        mb: 0.25,
      }}
    >
      <FormatCell flex={1.3} head>
        Format
      </FormatCell>
      <FormatCell head>P</FormatCell>
      <FormatCell head>Win%</FormatCell>
      <FormatCell head>HS</FormatCell>
      <FormatCell head>4s</FormatCell>
      <FormatCell head>6s</FormatCell>
      <FormatCell head>Avg</FormatCell>
      <FormatCell head>SR</FormatCell>
    </Stack>
  )
}

// One compact row inside a side card for a single format. Shows the
// full per-format line: played, win%, HS, 4s, 6s, Avg, SR.
function FormatRow({ label, bucket }: { label: string; bucket: MatchBucket }) {
  const pct = winPercent(bucket)
  const avg = average(bucket)
  const sr = strikeRate(bucket)
  const isEmpty = bucket.played === 0
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{
        py: 0.4,
        opacity: isEmpty ? 0.5 : 1,
      }}
    >
      <FormatCell flex={1.3} color={COLORS.textMuted} bold>
        {label}
      </FormatCell>
      <FormatCell>{bucket.played}</FormatCell>
      <FormatCell color={pctColor(pct)}>{fmtPct(pct)}</FormatCell>
      <FormatCell
        color={!isEmpty && bucket.highScore > 0 ? COLORS.highScore : COLORS.text}
      >
        {isEmpty ? '—' : bucket.highScore}
      </FormatCell>
      <FormatCell color={bucket.fours > 0 ? '#38bdf8' : COLORS.text}>
        {bucket.fours}
      </FormatCell>
      <FormatCell color={bucket.sixes > 0 ? '#a855f7' : COLORS.text}>
        {bucket.sixes}
      </FormatCell>
      <FormatCell>{fmtNum(avg)}</FormatCell>
      <FormatCell>{fmtNum(sr)}</FormatCell>
    </Stack>
  )
}

// One cell of the FormatRow / FormatHeader table.
function FormatCell({
  children,
  flex = 1,
  head = false,
  bold = false,
  color,
}: {
  children: React.ReactNode
  flex?: number
  head?: boolean
  bold?: boolean
  color?: string
}) {
  return (
    <Box sx={{ flex, minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: head ? '0.65rem' : '0.78rem',
          fontWeight: head ? 700 : bold ? 700 : 600,
          letterSpacing: head ? '0.08em' : 0,
          color: head ? COLORS.textFaint : (color ?? COLORS.text),
          textTransform: head ? 'uppercase' : 'none',
        }}
      >
        {children}
      </Typography>
    </Box>
  )
}

// --- Quiz card -----------------------------------------------------------

function QuizCard({ quiz }: { quiz: PlayerStats['quiz'] }) {
  const pct = correctPercent(quiz)
  return (
    <Card>
      <Stack direction="row" alignItems="center" spacing={2}>
        <ProgressRing
          value={pct ?? 0}
          size={80}
          thickness={9}
          color={pctColor(pct)}
          label="QUIZ"
          subValue={fmtPct(pct)}
        />
        <Box sx={{ flex: 1 }}>
          <SectionLabel
            icon={<QuizIcon fontSize="small" />}
            title="Cricket Quiz"
            subtitle="All-time totals"
            accent={COLORS.accent}
          />
          <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
            <StatLine label="Seen" value={quiz.seen} accent={COLORS.textMuted} />
            <StatLine label="Attempted" value={quiz.attempted} accent={COLORS.text} />
            <StatLine label="Correct" value={quiz.correct} accent={COLORS.win} />
          </Stack>
        </Box>
      </Stack>
    </Card>
  )
}

// --- Reusable bits --------------------------------------------------------

function Card({ children, padded = false }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <Box
      sx={{
        background: COLORS.card,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 2.5,
        p: padded ? 1.5 : 1.75,
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </Box>
  )
}

function SectionLabel({
  icon,
  title,
  subtitle,
  accent,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  accent: string
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box sx={{ color: accent, display: 'flex' }}>{icon}</Box>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ color: COLORS.textFaint, fontSize: '0.7rem', letterSpacing: '0.06em', mt: 0.25 }}>
          {subtitle.toUpperCase()}
        </Typography>
      </Box>
    </Stack>
  )
}

function StatLine({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent: string
}) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: '0.65rem',
          letterSpacing: '0.12em',
          color: COLORS.textFaint,
          fontWeight: 600,
        }}
      >
        {label.toUpperCase()}
      </Typography>
      <CountUp value={value} sx={{ fontWeight: 800, fontSize: '1.25rem', color: accent, lineHeight: 1.1 }} />
    </Box>
  )
}

function MiniRow({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: string
}) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ py: 0.15 }}>
      <Typography sx={{ fontSize: '0.72rem', color: COLORS.textMuted, fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: accent ?? COLORS.text }}>
        {value}
      </Typography>
    </Stack>
  )
}

// --- Circular progress ring ----------------------------------------------

function ProgressRing({
  value,
  size,
  thickness,
  color,
  label,
  subValue,
  small = false,
}: {
  value: number
  size: number
  thickness: number
  color: string
  label: string
  subValue: string
  small?: boolean
}) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.ring}
          strokeWidth={thickness}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: small ? '0.95rem' : '1.25rem',
            color,
          }}
        >
          {subValue}
        </Typography>
        <Typography
          sx={{
            fontSize: small ? '0.55rem' : '0.62rem',
            letterSpacing: '0.18em',
            color: COLORS.textFaint,
            fontWeight: 700,
            mt: 0.25,
          }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  )
}

// --- Animated number counter ---------------------------------------------

// Plain text wrapper around a value that ticks from 0 to the target on
// mount. Non-numeric values (em-dash, percentages) render unchanged so
// the helper degrades cleanly.
function CountUp({
  value,
  sx,
}: {
  value: number | string | null | undefined
  sx?: React.ComponentProps<typeof Typography>['sx']
}) {
  // Sanitise upfront so null / undefined / NaN never make it into the
  // animation or the rendered text. They all collapse to the em-dash.
  const safe = sanitise(value)
  const target = typeof safe === 'number' ? safe : null
  const [display, setDisplay] = useState<number | string>(target === null ? safe : 0)

  useEffect(() => {
    if (target === null) {
      setDisplay(safe)
      return
    }
    const duration = 700
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(target * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [safe, target])

  return (
    <Typography sx={sx} component="div">
      {display}
    </Typography>
  )
}

// Normalises any displayable value so the UI never renders `null`,
// `undefined`, or `NaN` as text. Anything non-finite becomes an em-dash.
function sanitise(value: number | string | null | undefined): number | string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : '—'
  }
  // Strings: catch the literal "null" / "NaN" / "undefined" that can
  // sneak in through `${value}` interpolations.
  if (value === 'null' || value === 'NaN' || value === 'undefined' || value === 'null%' || value === 'NaN%') {
    return '—'
  }
  return value
}

// Formats a percentage value. Returns "—" for null / undefined / NaN /
// Infinity so the UI never renders junk text.
function fmtPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—'
  return `${pct}%`
}

// Formats a plain numeric stat (Average, Strike Rate, etc). Same rules
// as fmtPct minus the trailing percent sign.
function fmtNum(value: number | null | undefined): string | number {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value
}

// Picks a colour for a win % or correct % value: green for strong, amber
// for middling, red for weak, accent-cyan for "no data yet".
function pctColor(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return COLORS.textFaint
  if (pct >= 60) return COLORS.win
  if (pct >= 40) return COLORS.tie
  return COLORS.loss
}
