import { motion } from 'framer-motion'

export type Mood = 'neutral' | 'happy' | 'sad'

type Props = {
  variant: 'player' | 'computer'
  mood?: Mood
  size?: number
}

// Small SVG portrait of a player. Different colour scheme per `variant`
// (warm for player, cool for computer), with blinking eyes, a breathing bob,
// and a mouth shape that swaps between smile / frown / neutral by `mood`.
export default function AnimatedFace({ variant, mood = 'neutral', size = 56 }: Props) {
  const isPlayer = variant === 'player'
  const skin = isPlayer ? '#fcd34d' : '#cbd5e1'
  const skinShade = isPlayer ? '#f59e0b' : '#94a3b8'
  const capMain = isPlayer ? '#0c4a6e' : '#581c87'
  const capStripe = isPlayer ? '#38bdf8' : '#a855f7'
  const ringGlow = isPlayer ? 'rgba(56,189,248,0.45)' : 'rgba(168,85,247,0.45)'
  const blinkDelay = isPlayer ? 0 : 0.7

  return (
    <motion.div
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display: 'inline-flex',
        filter: `drop-shadow(0 0 10px ${ringGlow})`,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64">
        <circle cx="32" cy="38" r="20" fill={skin} />
        <ellipse cx="32" cy="56" rx="20" ry="4" fill={skinShade} opacity="0.35" />

        <path d="M 12 32 Q 32 10 52 32 L 52 28 Q 32 16 12 28 Z" fill={capMain} />
        <rect x="12" y="30" width="40" height="3" fill={capStripe} />
        <ellipse cx="32" cy="33" rx="22" ry="3.5" fill={capMain} />
        <ellipse cx="32" cy="33" rx="22" ry="3.5" fill={capStripe} opacity="0.25" />

        <motion.ellipse
          cx="25"
          cy="40"
          rx="2.1"
          ry="3"
          fill="#0f172a"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{
            duration: 0.2,
            repeat: Infinity,
            repeatDelay: 3.2,
            delay: blinkDelay,
          }}
          style={{ transformOrigin: '25px 40px' }}
        />
        <motion.ellipse
          cx="39"
          cy="40"
          rx="2.1"
          ry="3"
          fill="#0f172a"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{
            duration: 0.2,
            repeat: Infinity,
            repeatDelay: 3.2,
            delay: blinkDelay,
          }}
          style={{ transformOrigin: '39px 40px' }}
        />

        {mood === 'happy' && (
          <>
            <path
              d="M 23 47 Q 32 55 41 47"
              stroke="#0f172a"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="20" cy="44" r="2.2" fill="#fb7185" opacity="0.65" />
            <circle cx="44" cy="44" r="2.2" fill="#fb7185" opacity="0.65" />
          </>
        )}
        {mood === 'sad' && (
          <path
            d="M 23 51 Q 32 45 41 51"
            stroke="#0f172a"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        )}
        {mood === 'neutral' && (
          <line
            x1="26"
            y1="47"
            x2="38"
            y2="47"
            stroke="#0f172a"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </motion.div>
  )
}
