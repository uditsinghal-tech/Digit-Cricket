import { motion } from 'framer-motion'

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

const CROWD = Array.from({ length: 64 }).map((_, i) => ({
  x: 60 + ((i * 29) % 1820),
  y: 660 + (i % 5) * 8,
  r: 1.8 + (i % 3) * 0.4,
  shade: i % 4,
}))

// Animated SVG of a night-time cricket stadium. Fixed behind every screen.
// Stars twinkle, two cloud layers drift, four floodlights pulse, with a
// vignette layered on top to keep the foreground UI legible.
export default function StadiumBackground() {
  return (
    <div
      aria-hidden
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
            <stop offset="0%" stopColor="#080524" />
            <stop offset="55%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#312e81" />
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
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#052e16" />
          </linearGradient>
          <linearGradient id="tierGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0b1220" />
          </linearGradient>
        </defs>

        <rect width="1920" height="1080" fill="url(#skyGrad)" />

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

        <motion.g
          animate={{ x: [-280, 2200] }}
          transition={{ duration: 95, repeat: Infinity, ease: 'linear' }}
        >
          <ellipse cx="0" cy="170" rx="130" ry="22" fill="#cbd5e1" opacity="0.14" />
          <ellipse cx="-90" cy="195" rx="80" ry="18" fill="#cbd5e1" opacity="0.1" />
        </motion.g>
        <motion.g
          animate={{ x: [-220, 2280] }}
          transition={{ duration: 130, repeat: Infinity, ease: 'linear', delay: 30 }}
        >
          <ellipse cx="0" cy="300" rx="110" ry="18" fill="#cbd5e1" opacity="0.1" />
        </motion.g>

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

        <path
          d="M 0 820 L 0 720 Q 240 600 540 580 L 1380 580 Q 1680 600 1920 720 L 1920 820 Z"
          fill="url(#tierGrad)"
        />
        <path
          d="M 0 820 L 0 770 Q 240 670 540 650 L 1380 650 Q 1680 670 1920 770 L 1920 820 Z"
          fill="#0b1220"
          opacity="0.7"
        />

        {CROWD.map((c, i) => {
          const colors = ['#475569', '#64748b', '#334155', '#94a3b8']
          return (
            <circle
              key={`crowd-${i}`}
              cx={c.x}
              cy={c.y}
              r={c.r}
              fill={colors[c.shade]}
              opacity="0.55"
            />
          )
        })}

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
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(5,8,16,0.55) 60%, rgba(5,8,16,0.85) 100%)',
        }}
      />
    </div>
  )
}
