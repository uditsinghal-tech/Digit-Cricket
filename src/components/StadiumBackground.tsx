import { motion } from 'framer-motion'
import { useStadiumReaction } from '../stadium/useStadiumReaction'
import { useStadiumMode } from '../stadium/useStadiumMode'
import './StadiumBackground.css'

const STARS = Array.from({ length: 24 }).map((_, i) => ({
  cx: ((i * 137) % 1880) + 20,
  cy: ((i * 89) % 360) + 20,
  r: 0.6 + (i % 3) * 0.4,
  delay: (i * 0.13) % 3,
  duration: 2 + (i % 5) * 0.4,
}))

const FLOODLIGHTS = [
  { x: 200, pulseDuration: 4.2, beamDuration: 5.0, delay: 0 },
  { x: 620, pulseDuration: 3.6, beamDuration: 4.4, delay: 0.6 },
  { x: 1300, pulseDuration: 4.0, beamDuration: 5.2, delay: 1.1 },
  { x: 1720, pulseDuration: 3.8, beamDuration: 4.7, delay: 1.6 },
]

// Pseudo-random generator so the crowd layout is identical between renders
// in the same session but doesn't require us to hand-place 750 dots.
function rand(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Builds 10 rows × 75 dots ≈ 750 people across the seating bowl. The dots are
// nudged off the strict grid with deterministic jitter so the rows don't read
// as parade lines. Front rows get a slightly larger radius for a hint of
// perspective.
type CrowdDot = { x: number; y: number; r: number; shade: number; staggerDelay: number }

const CROWD: CrowdDot[] = (() => {
  const out: CrowdDot[] = []
  const ROWS = 10
  const DOTS_PER_ROW = 75
  for (let row = 0; row < ROWS; row++) {
    const yBase = 590 + row * 15
    const rowR = 2.2 - row * 0.08
    for (let col = 0; col < DOTS_PER_ROW; col++) {
      const seed = row * 131 + col * 17 + 1
      const xBase = 30 + (col * 1860) / DOTS_PER_ROW
      const x = xBase + (rand(seed) - 0.5) * 12
      const y = yBase + (rand(seed + 1) - 0.5) * 5
      const r = rowR + (rand(seed + 2) - 0.5) * 0.4
      const shade = (row * 13 + col) % 4
      // Stagger by horizontal position so the colour wave reads as a left-to-right ripple.
      const staggerDelay = (x / 1920) * 0.35
      out.push({ x, y, r, shade, staggerDelay })
    }
  }
  return out
})()

// Animated SVG of a night-time cricket stadium. Fixed behind every screen.
// Stars twinkle, two cloud layers drift, four floodlights pulse, with a
// vignette layered on top to keep the foreground UI legible. The crowd dots
// at the bottom react to game events via StadiumReactionContext.
export default function StadiumBackground() {
  const { reaction } = useStadiumReaction()
  const { mode } = useStadiumMode()
  return (
    <div
      aria-hidden
      className={`stadium${mode === 'day' ? ' stadium--day' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--sky-top)' }} />
            <stop offset="55%" style={{ stopColor: 'var(--sky-mid)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--sky-bot)' }} />
          </linearGradient>
          <radialGradient id="floodGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="lightBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fieldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--field-top)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--field-bot)' }} />
          </linearGradient>
          <linearGradient id="tierGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--tier-top)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--tier-bot)' }} />
          </linearGradient>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="1920" height="1080" fill="url(#skyGrad)" />

        <g className="night-only">
          {STARS.map((s, i) => (
            <motion.circle
              key={`star-${i}`}
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              fill="#f8fafc"
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: s.duration, repeat: Infinity, delay: s.delay }}
            />
          ))}
        </g>

        <g className="day-only">
          <circle cx="1500" cy="200" r="220" fill="url(#sunGlow)" />
          <circle cx="1500" cy="200" r="68" fill="#fef9c3" />
          <circle cx="1500" cy="200" r="50" fill="#fde047" />
        </g>

        <motion.g
          animate={{ x: [-280, 2200] }}
          transition={{ duration: 95, repeat: Infinity, ease: 'linear' }}
        >
          <ellipse className="cloud-blob" cx="0" cy="170" rx="130" ry="22" />
          <ellipse className="cloud-blob" cx="-90" cy="195" rx="80" ry="18" />
        </motion.g>
        <motion.g
          animate={{ x: [-220, 2280] }}
          transition={{ duration: 130, repeat: Infinity, ease: 'linear', delay: 30 }}
        >
          <ellipse className="cloud-blob" cx="0" cy="300" rx="110" ry="18" />
        </motion.g>

        <g className="floodlight-set">
          {FLOODLIGHTS.map((f, i) => (
            <g key={`flood-${i}`}>
              <motion.path
                d={`M ${f.x - 70} 60 L ${f.x + 70} 60 L ${f.x + 220} 720 L ${f.x - 220} 720 Z`}
                fill="url(#lightBeam)"
                initial={{ opacity: 0.4 }}
                animate={{ opacity: [0.35, 0.7, 0.35] }}
                transition={{
                  duration: f.beamDuration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: f.delay,
                }}
              />
              <rect x={f.x - 3} y="40" width="6" height="640" fill="#1e293b" opacity="0.55" />
              <motion.circle
                cx={f.x}
                cy="50"
                r="22"
                fill="url(#floodGlow)"
                animate={{ opacity: [0.65, 1, 0.65] }}
                transition={{ duration: f.pulseDuration, repeat: Infinity, delay: f.delay }}
              />
              <circle cx={f.x} cy="50" r="6" fill="#fde68a" />
            </g>
          ))}
        </g>

        <path
          d="M 0 820 L 0 720 Q 240 600 540 580 L 1380 580 Q 1680 600 1920 720 L 1920 820 Z"
          fill="url(#tierGrad)"
        />
        <path
          d="M 0 820 L 0 770 Q 240 670 540 650 L 1380 650 Q 1680 670 1920 770 L 1920 820 Z"
          fill="#0b1220"
          opacity="0.7"
        />

        <g className={`crowd${reaction ? ` crowd--${reaction}` : ''}`}>
          {CROWD.map((c, i) => (
            <circle
              key={`crowd-${i}`}
              cx={c.x}
              cy={c.y}
              r={c.r}
              className={`crowd-dot crowd-dot--${c.shade}`}
              style={{ ['--stagger-delay' as string]: `${c.staggerDelay}s` }}
            />
          ))}
        </g>

        <ellipse cx="960" cy="1120" rx="1320" ry="370" fill="url(#fieldGrad)" />
        <ellipse
          cx="960"
          cy="1120"
          rx="1280"
          ry="345"
          fill="none"
          stroke="#f8fafc"
          strokeWidth="2"
          opacity="0.22"
        />
        <rect
          x="880"
          y="820"
          width="160"
          height="220"
          fill="#d4a574"
          opacity="0.55"
          transform="rotate(-2 960 930)"
        />
        <line x1="900" y1="870" x2="1020" y2="870" stroke="#f8fafc" strokeWidth="2" opacity="0.4" />
        <line x1="900" y1="990" x2="1020" y2="990" stroke="#f8fafc" strokeWidth="2" opacity="0.4" />
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          transition: 'background 1s ease',
          background:
            'radial-gradient(ellipse at center, transparent 0%, var(--vignette-mid) 60%, var(--vignette-outer) 100%)',
        }}
      />
    </div>
  )
}
