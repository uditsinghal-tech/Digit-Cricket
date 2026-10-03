import { useState } from 'react'
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
import AutoStoriesIcon from '@mui/icons-material/AutoStories'

// Fixed icon button at the top right (left of the My-stats button).
// Opens a "Story of Cricket" dialog with a chronological walk through
// the game's history, illustrated with hand-drawn inline SVG banners
// so the images are guaranteed to render — no upstream URLs to break.

type Illustration = {
  node: React.ReactNode
  caption: string
}

type Era = {
  year: string
  title: string
  body: string
  image?: Illustration
}

// Reusable banner frame for each era illustration. Wraps a 640x220
// viewBox SVG so every banner shares the same aspect ratio and rounded
// frame regardless of what's drawn inside.
function Banner({
  bg,
  children,
}: {
  bg: { from: string; to: string }
  children: React.ReactNode
}) {
  return (
    <svg
      viewBox="0 0 640 220"
      preserveAspectRatio="xMidYMid slice"
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        borderRadius: 12,
        border: '1px solid rgba(148, 163, 184, 0.25)',
      }}
    >
      <defs>
        <linearGradient id={`bg-${bg.from}-${bg.to}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.from} />
          <stop offset="100%" stopColor={bg.to} />
        </linearGradient>
      </defs>
      <rect width="640" height="220" fill={`url(#bg-${bg.from}-${bg.to})`} />
      {children}
    </svg>
  )
}

// --- Per-era illustrations -------------------------------------------

function PastoralBanner() {
  return (
    <Banner bg={{ from: '#bbf7d0', to: '#166534' }}>
      <circle cx="540" cy="50" r="28" fill="#fef3c7" />
      <path d="M0 170 Q160 130 320 165 T640 155 L640 220 L0 220 Z" fill="#15803d" opacity="0.7" />
      <path d="M0 195 Q200 175 400 195 T640 195 L640 220 L0 220 Z" fill="#14532d" />
      <rect x="120" y="100" width="8" height="80" fill="#78350f" />
      <circle cx="124" cy="98" r="38" fill="#16a34a" />
      <circle cx="105" cy="88" r="20" fill="#22c55e" />
      <circle cx="142" cy="92" r="22" fill="#22c55e" />
      <path
        d="M 470 180 L 470 95 Q 470 70 495 70 Q 520 70 520 95"
        stroke="#a16207"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="500" cy="165" r="9" fill="#dc2626" stroke="#fef9c3" strokeWidth="1.5" />
      <path d="M 492 162 Q 500 158 508 162" stroke="#fef9c3" strokeWidth="0.8" fill="none" />
    </Banner>
  )
}

function VillageGreenBanner() {
  return (
    <Banner bg={{ from: '#fde68a', to: '#92400e' }}>
      <circle cx="540" cy="60" r="26" fill="#fef3c7" opacity="0.85" />
      <path d="M0 180 Q120 150 240 175 T480 165 T640 175 L640 220 L0 220 Z" fill="#a16207" />
      <rect x="60" y="120" width="80" height="50" fill="#7c2d12" />
      <polygon points="55,120 100,90 145,120" fill="#451a03" />
      <rect x="92" y="140" width="14" height="30" fill="#fde68a" />
      <rect x="490" y="140" width="3" height="40" fill="#f5f5f4" />
      <rect x="500" y="140" width="3" height="40" fill="#f5f5f4" />
      <rect x="510" y="140" width="3" height="40" fill="#f5f5f4" />
      <rect x="490" y="137" width="23" height="3" fill="#f5f5f4" />
      <rect
        x="380"
        y="160"
        width="60"
        height="8"
        rx="2"
        fill="#a16207"
        stroke="#451a03"
        strokeWidth="1"
        transform="rotate(-18 410 164)"
      />
      <circle cx="430" cy="175" r="7" fill="#dc2626" stroke="#fef9c3" strokeWidth="1.2" />
    </Banner>
  )
}

function PavilionBanner() {
  return (
    <Banner bg={{ from: '#fef3c7', to: '#a16207' }}>
      <rect x="180" y="100" width="280" height="60" fill="#fafaf9" stroke="#451a03" strokeWidth="2" />
      <polygon points="170,100 320,40 470,100" fill="#7c2d12" stroke="#451a03" strokeWidth="2" />
      <rect x="210" y="120" width="30" height="40" fill="#451a03" />
      <rect x="260" y="120" width="30" height="40" fill="#451a03" />
      <rect x="310" y="120" width="30" height="40" fill="#451a03" />
      <rect x="360" y="120" width="30" height="40" fill="#451a03" />
      <rect x="410" y="120" width="30" height="40" fill="#451a03" />
      <text
        x="320"
        y="195"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="22"
        fontWeight="800"
        fill="#451a03"
        letterSpacing="0.1em"
      >
        EST 1787
      </text>
      <circle cx="540" cy="60" r="22" fill="#fde68a" />
    </Banner>
  )
}

function GlobalSpreadBanner() {
  return (
    <Banner bg={{ from: '#bfdbfe', to: '#1e3a8a' }}>
      <circle cx="320" cy="110" r="80" fill="#1d4ed8" stroke="#fef3c7" strokeWidth="3" />
      <path d="M 250 90 Q 280 80 310 95 T 380 100" stroke="#fef3c7" strokeWidth="2" fill="none" />
      <path d="M 240 130 Q 290 145 340 130 T 400 140" stroke="#fef3c7" strokeWidth="2" fill="none" />
      <path d="M 280 110 Q 320 100 360 115" stroke="#fef3c7" strokeWidth="2" fill="none" />
      <ellipse cx="320" cy="110" rx="80" ry="22" fill="none" stroke="#fef3c7" strokeWidth="2" />
      <rect
        x="80"
        y="95"
        width="70"
        height="10"
        rx="2"
        fill="#fde68a"
        stroke="#92400e"
        strokeWidth="1.4"
        transform="rotate(-30 115 100)"
      />
      <circle cx="105" cy="130" r="9" fill="#dc2626" stroke="#fef9c3" strokeWidth="1.5" />
      <rect
        x="490"
        y="95"
        width="70"
        height="10"
        rx="2"
        fill="#fde68a"
        stroke="#92400e"
        strokeWidth="1.4"
        transform="rotate(30 525 100)"
      />
      <circle cx="535" cy="130" r="9" fill="#dc2626" stroke="#fef9c3" strokeWidth="1.5" />
    </Banner>
  )
}

function BradmanBanner() {
  return (
    <Banner bg={{ from: '#fef9c3', to: '#854d0e' }}>
      <ellipse cx="320" cy="220" rx="320" ry="40" fill="#365314" opacity="0.6" />
      <rect x="290" y="190" width="3" height="30" fill="#f8fafc" />
      <rect x="299" y="190" width="3" height="30" fill="#f8fafc" />
      <rect x="308" y="190" width="3" height="30" fill="#f8fafc" />
      <circle cx="180" cy="100" r="20" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
      <rect x="170" y="120" width="20" height="50" fill="#f8fafc" />
      <rect x="155" y="170" width="15" height="30" fill="#0f172a" />
      <rect x="190" y="170" width="15" height="30" fill="#0f172a" />
      <rect
        x="190"
        y="140"
        width="60"
        height="10"
        rx="2"
        fill="#a16207"
        stroke="#451a03"
        strokeWidth="1.4"
        transform="rotate(-15 220 145)"
      />
      <text
        x="450"
        y="100"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="56"
        fontWeight="900"
        fill="#92400e"
      >
        99.94
      </text>
      <text
        x="450"
        y="130"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="14"
        fontWeight="700"
        fill="#451a03"
        letterSpacing="0.15em"
      >
        TEST AVERAGE
      </text>
    </Banner>
  )
}

function WorldCupBanner() {
  return (
    <Banner bg={{ from: '#fde68a', to: '#b45309' }}>
      <ellipse cx="320" cy="200" rx="180" ry="14" fill="#451a03" opacity="0.4" />
      <path
        d="M 280 60 L 360 60 L 360 100 Q 360 140 320 160 Q 280 140 280 100 Z"
        fill="#fbbf24"
        stroke="#78350f"
        strokeWidth="3"
      />
      <rect x="306" y="160" width="28" height="20" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
      <rect x="284" y="180" width="72" height="14" rx="2" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
      <path d="M 280 70 Q 260 80 260 100 Q 260 120 280 130" stroke="#fbbf24" strokeWidth="6" fill="none" />
      <path d="M 360 70 Q 380 80 380 100 Q 380 120 360 130" stroke="#fbbf24" strokeWidth="6" fill="none" />
      <text
        x="320"
        y="110"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="22"
        fontWeight="900"
        fill="#451a03"
      >
        ICC
      </text>
      <circle cx="120" cy="80" r="4" fill="#fef9c3" />
      <circle cx="540" cy="60" r="4" fill="#fef9c3" />
      <circle cx="80" cy="160" r="4" fill="#fef9c3" />
      <circle cx="560" cy="170" r="4" fill="#fef9c3" />
    </Banner>
  )
}

function ModernStadiumBanner() {
  return (
    <Banner bg={{ from: '#1e293b', to: '#0f172a' }}>
      <circle cx="80" cy="40" r="12" fill="#fbbf24" opacity="0.85" />
      <path d="M 80 52 L 70 92" stroke="#fbbf24" strokeWidth="2" opacity="0.55" />
      <circle cx="560" cy="40" r="12" fill="#fbbf24" opacity="0.85" />
      <path d="M 560 52 L 570 92" stroke="#fbbf24" strokeWidth="2" opacity="0.55" />
      <circle cx="200" cy="30" r="10" fill="#fbbf24" opacity="0.85" />
      <circle cx="440" cy="30" r="10" fill="#fbbf24" opacity="0.85" />
      <ellipse cx="320" cy="170" rx="240" ry="50" fill="#14532d" stroke="#fef3c7" strokeWidth="2" />
      <ellipse cx="320" cy="170" rx="180" ry="34" fill="#16a34a" />
      <ellipse cx="320" cy="170" rx="120" ry="20" fill="#0f5132" opacity="0.55" />
      <rect x="316" y="160" width="2.5" height="22" fill="#f8fafc" />
      <rect x="320.5" y="160" width="2.5" height="22" fill="#f8fafc" />
      <rect x="325" y="160" width="2.5" height="22" fill="#f8fafc" />
      <ellipse cx="320" cy="220" rx="320" ry="40" fill="#1e293b" />
      <text
        x="320"
        y="105"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="36"
        fontWeight="900"
        fill="#f8fafc"
        letterSpacing="0.18em"
      >
        T20
      </text>
    </Banner>
  )
}

function HorizonBanner() {
  return (
    <Banner bg={{ from: '#fed7aa', to: '#7c2d12' }}>
      <circle cx="320" cy="120" r="60" fill="none" stroke="#fef3c7" strokeWidth="3" />
      <ellipse cx="320" cy="120" rx="60" ry="20" fill="none" stroke="#fef3c7" strokeWidth="2" />
      <path d="M 260 120 Q 300 100 360 120 T 380 120" fill="none" stroke="#fef3c7" strokeWidth="2" />
      <path d="M 260 120 Q 300 140 360 120 T 380 120" fill="none" stroke="#fef3c7" strokeWidth="2" />
      <rect
        x="290"
        y="118"
        width="65"
        height="6"
        rx="2"
        fill="#a16207"
        stroke="#451a03"
        strokeWidth="1.4"
      />
      <circle cx="240" cy="120" r="10" fill="#dc2626" stroke="#fef9c3" strokeWidth="1.6" />
      <text
        x="320"
        y="195"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="14"
        fontWeight="800"
        letterSpacing="0.18em"
        fill="#451a03"
      >
        ONE GAME, ONE WORLD
      </text>
    </Banner>
  )
}

// Eras of the game in chronological order.
const ERAS: Era[] = [
  {
    year: '16th Century',
    title: 'The Pastoral Roots',
    body:
      "The earliest written mention of cricket sits in a 1597 court case in Guildford, Surrey, where a coroner named John Derrick recalled playing creckett as a schoolboy in 1550. Most historians believe the game ran far older still, played by shepherds and farm boys in the Weald of southeast England. They used their crooks as bats and a wicket gate or tree stump as the target. The name itself may have travelled across the Channel from the Middle Dutch word krick, meaning a stick.",
    image: {
      node: <PastoralBanner />,
      caption: 'Shepherds in the Weald: a stick, a ball and a wicket gate',
    },
  },
  {
    year: '17th Century',
    title: 'From Village Green to Royal Interest',
    body:
      "By the 1610s cricket was being played across Sussex and Kent, often informally on village greens after Sunday church. It grew popular enough that in 1611 two men were prosecuted for skipping church to play it. Soldiers in the English Civil War were known to relax with bat and ball between campaigns. In 1697 a London newspaper reported the first great match with a stake of fifty guineas, a serious sum at the time.",
    image: {
      node: <VillageGreenBanner />,
      caption: 'A Sunday afternoon on the village green',
    },
  },
  {
    year: '18th Century',
    title: 'The Birth of the Modern Game',
    body:
      "The 1700s gave cricket its first written rules. In 1744 the Star and Garter pub in London hosted a meeting that produced the earliest known Laws of Cricket. The pitch was set at twenty two yards, where it still stands today. The mighty Hambledon Club in Hampshire became the heart of the sport in the 1770s, with bowlers like David Harris and batters like Silver Billy Beldham drawing huge crowds. In 1787 the Marylebone Cricket Club was founded in London, and within a year it moved to a new ground laid by Thomas Lord. The MCC stayed the global rule keeper of the sport for the next two hundred years.",
    image: {
      node: <PavilionBanner />,
      caption: "The MCC pavilion. Lord's was laid in 1787 and remains the spiritual home of the game",
    },
  },
  {
    year: '19th Century',
    title: 'A Sport Goes Global',
    body:
      "The 1800s saw cricket travel with the British Empire. The first overseas tour, by an English team to North America, took place in 1859. Australia hosted the very first official Test match in March 1877, beating England by 45 runs at Melbourne. Just five years later in 1882, England's loss to Australia at The Oval prompted a mock obituary in The Sporting Times that gave birth to the Ashes. William Gilbert Grace, known to everyone as W. G., was the era's giant. By the time he retired he had scored more than fifty four thousand first class runs and turned cricket into a national obsession in England.",
    image: {
      node: <GlobalSpreadBanner />,
      caption: 'A game that sailed with the Empire reached every populated continent',
    },
  },
  {
    year: 'Early 20th Century',
    title: 'Bradman and the Bodyline Era',
    body:
      "South Africa joined Test cricket in 1889 and the West Indies in 1928. The towering figure of the early 1900s was Sir Donald Bradman of Australia. Across twenty years he averaged 99.94 in Tests, a number no one else has come close to. The 1932 to 1933 Ashes tour, remembered as the Bodyline series, saw England bowl at the body of Bradman and his teammates to slow him down. The tactic worked on the scoreboard but nearly broke diplomatic relations between Britain and Australia.",
    image: {
      node: <BradmanBanner />,
      caption: '99.94. The Test average that has stood for more than seventy years',
    },
  },
  {
    year: 'Mid 20th Century',
    title: 'Independence and the Caribbean Calypso',
    body:
      "India played its first Test in 1932, Pakistan in 1952, and New Zealand had joined back in 1930. The years after the Second World War were a time of fresh stars and new flair. The West Indies of the 1950s, led by the great Sir Garfield Sobers, brought a fast attacking style to the world stage. In 1971 the first One Day International was played at the Melbourne Cricket Ground after a Test was washed out, a happy accident that changed the game forever.",
  },
  {
    year: 'Late 20th Century',
    title: 'World Cups and the Rise of Asia',
    body:
      "The first Cricket World Cup was held in England in 1975 and won by Clive Lloyd's West Indies. India's surprise win in 1983 under Kapil Dev set off a love affair between the subcontinent and the sport that has never cooled. The 1990s saw Pakistan win their own World Cup in 1992 with Imran Khan, Sri Lanka claim a famous title in 1996, and Sachin Tendulkar emerge as the boy genius who would later become the highest run scorer of all time.",
    image: {
      node: <WorldCupBanner />,
      caption: 'The trophy that turned cricket into a four yearly festival',
    },
  },
  {
    year: '21st Century',
    title: 'T20, the Global Boom, and a New Tempo',
    body:
      "Twenty over cricket took shape in England in 2003 and the format went international by 2005. In 2007 India won the very first T20 World Cup in South Africa, and the next year the Indian Premier League turned cricket into the third most watched sport on earth. England finally lifted an ODI World Cup in 2019 in one of the most dramatic finals ever played. By 2023 the men's Cricket World Cup final filled the Narendra Modi Stadium in Ahmedabad with more than 130,000 fans, the largest cricket crowd in history.",
    image: {
      node: <ModernStadiumBanner />,
      caption: 'Floodlit T20 cricket. Twenty overs of chaos and the new face of the sport',
    },
  },
  {
    year: 'Today and Tomorrow',
    title: 'A Game That Refuses to Stand Still',
    body:
      "From a stick swung by a Sussex shepherd to a Sunday afternoon watched by hundreds of millions, the journey is the longest in any modern sport. Day night Tests with a pink ball, the T10 league in the United Arab Emirates, and women's cricket smashing attendance records at the MCG all show the same restless spirit. Whatever shape the next century takes, the bat and ball will probably still be at the heart of it.",
    image: {
      node: <HorizonBanner />,
      caption: 'One game, one world. The next chapter is already being written',
    },
  },
]

// Quick at a glance dates, surfaced at the top of the dialog so the
// reader can orient before diving into the prose.
const MILESTONES: { date: string; event: string }[] = [
  { date: '1550', event: 'Earliest record of cricket being played, in Guildford, Surrey' },
  { date: '1744', event: 'First written Laws of Cricket drafted in London' },
  { date: '1787', event: 'Marylebone Cricket Club (MCC) founded, soon moving to Lord\'s' },
  { date: '1844', event: 'First international cricket match, between Canada and the United States' },
  { date: '1877', event: 'First official Test match, Australia v England in Melbourne' },
  { date: '1882', event: 'The Ashes are born after England\'s defeat at The Oval' },
  { date: '1928', event: 'West Indies plays its first Test' },
  { date: '1932', event: 'India plays its first Test, at Lord\'s' },
  { date: '1948', event: "Don Bradman's final Test innings ends in a famous duck" },
  { date: '1971', event: 'First One Day International, Australia v England at the MCG' },
  { date: '1975', event: 'West Indies wins the inaugural Cricket World Cup' },
  { date: '1983', event: "India lifts the World Cup under Kapil Dev" },
  { date: '2005', event: 'First Twenty20 international, Australia v New Zealand' },
  { date: '2007', event: 'India wins the first T20 World Cup in South Africa' },
  { date: '2008', event: 'Indian Premier League launches' },
  { date: '2019', event: 'England wins its first ODI World Cup in a final tied off the last ball' },
  { date: '2023', event: 'Narendra Modi Stadium hosts the largest cricket crowd in history' },
]

export default function CricketHistoryButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Tooltip title="The story of cricket" arrow>
        <IconButton
          onClick={() => setOpen(true)}
          aria-label="The story of cricket"
          sx={{
            position: 'fixed',
            top: 12,
            right: 204,
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
          <AutoStoriesIcon />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.2 }}>
          From Shepherds to Stadiums
          <Box
            component="span"
            sx={{ display: 'block', fontSize: '0.85rem', opacity: 0.7, fontWeight: 500, mt: 0.25 }}
          >
            The Story of Cricket
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <IntroSection />
            <StoryHeading />
            {ERAS.map((era) => (
              <EraSection key={era.year} era={era} />
            ))}
            <MilestonesStrip />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// Warm welcome paragraph that opens the dialog. Frames cricket as the
// shared love of a global community before we dive into the timeline.
function IntroSection() {
  return (
    <Box>
      <Typography variant="body1" sx={{ lineHeight: 1.7, opacity: 0.92 }}>
        Cricket is the beloved game of more than two and a half billion fans across every populated
        continent. Children play it in narrow Mumbai lanes with tennis balls and improvised stumps.
        Test crowds at Lord's and the MCG sit shoulder to shoulder for five quiet days. Village
        clubs in the Caribbean, in Europe, in Australia and in the Yorkshire dales all hold the
        same simple love of a bat, a ball and a contest between two ends of a wicket.
      </Typography>
      <Typography variant="body1" sx={{ lineHeight: 1.7, opacity: 0.92, mt: 1.25 }}>
        Behind that simple love sits a sport with more than four hundred years of recorded history.
        It has been played by shepherds and by knights, by colonial soldiers and by Bollywood
        superstars. It has been ruled from a single pub in London and from a glass tower in Dubai.
        It has been transformed by Don Bradman, by Kerry Packer, by the IPL and by the women who
        finally got the international stage they always deserved. The game you tap on this app
        owes its rhythm and its rules to centuries of people who loved it before you.
      </Typography>
    </Box>
  )
}

// Small heading that introduces the chronological story section so the
// reader knows the prose chapters are about to begin.
function StoryHeading() {
  return (
    <Box>
      <Typography
        variant="overline"
        sx={{
          fontWeight: 800,
          letterSpacing: '0.15em',
          color: '#fbbf24',
          opacity: 0.9,
        }}
      >
        Below is the story
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, mt: 0.25 }}>
        A walk through the centuries
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
        From a stick in a Sussex meadow to a roaring stadium of more than a hundred thousand fans,
        here is how cricket grew up.
      </Typography>
    </Box>
  )
}

// Glance friendly band of dates that closes the dialog so the reader
// can scan the entire arc on a single screen after reading the prose.
function MilestonesStrip() {
  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 700, mb: 1, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85 }}
      >
        The whole arc at a glance
      </Typography>
      <Box
        sx={{
          border: '1px solid rgba(148, 163, 184, 0.25)',
          borderRadius: 2,
          background: 'rgba(15, 23, 42, 0.45)',
          p: 1.25,
        }}
      >
        <Stack spacing={0.5}>
          {MILESTONES.map((m) => (
            <Stack direction="row" key={m.date} spacing={1.5} alignItems="baseline">
              <Typography
                sx={{
                  fontWeight: 800,
                  color: '#fbbf24',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  minWidth: 56,
                }}
              >
                {m.date}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {m.event}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}

// One chapter of the story. Year tag on the left, body on the right.
// Optional image floats above the body so it leads the reader in.
function EraSection({ era }: { era: Era }) {
  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="baseline" sx={{ mb: 1 }}>
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontWeight: 800,
            color: '#fbbf24',
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {era.year}
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{era.title}</Typography>
      </Stack>
      {era.image && (
        <Box sx={{ mb: 1.25 }}>
          {era.image.node}
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.5, opacity: 0.65, fontStyle: 'italic' }}
          >
            {era.image.caption}
          </Typography>
        </Box>
      )}
      <Typography variant="body2" sx={{ lineHeight: 1.65, opacity: 0.9 }}>
        {era.body}
      </Typography>
    </Box>
  )
}
