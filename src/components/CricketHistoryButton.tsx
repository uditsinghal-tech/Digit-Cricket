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
// the game's history, illustrated with public-domain photos hosted on
// Wikimedia Commons.

type Era = {
  year: string
  title: string
  body: string
  image?: { src: string; alt: string; caption: string }
}

// Eras of the game in chronological order. Images point at
// Wikimedia Commons thumbnails, which are stable URLs and freely
// hot-linkable under their CC and public-domain licences.
const ERAS: Era[] = [
  {
    year: '16th Century',
    title: 'The Pastoral Roots',
    body:
      "The earliest written mention of cricket sits in a 1597 court case in Guildford, Surrey, where a coroner named John Derrick recalled playing creckett as a schoolboy in 1550. Most historians believe the game ran far older still, played by shepherds and farm boys in the Weald of southeast England. They used their crooks as bats and a wicket gate or tree stump as the target. The name itself may have travelled across the Channel from the Middle Dutch word krick, meaning a stick.",
    image: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/An_Early_Cricket_Match.jpg/640px-An_Early_Cricket_Match.jpg',
      alt: 'A pastoral cricket scene from a very early painting',
      caption: 'An early painting of a cricket match on an English village green',
    },
  },
  {
    year: '17th Century',
    title: 'From Village Green to Royal Interest',
    body:
      "By the 1610s cricket was being played across Sussex and Kent, often informally on village greens after Sunday church. It grew popular enough that in 1611 two men were prosecuted for skipping church to play it. Soldiers in the English Civil War were known to relax with bat and ball between campaigns. In 1697 a London newspaper reported the first great match with a stake of fifty guineas, a serious sum at the time.",
    image: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Cricket_Match_played_by_the_Countess_of_Derby.jpg/640px-Cricket_Match_played_by_the_Countess_of_Derby.jpg',
      alt: 'An 18th century painting of a cricket match',
      caption: 'A period painting of an early cricket match in southern England',
    },
  },
  {
    year: '18th Century',
    title: 'The Birth of the Modern Game',
    body:
      "The 1700s gave cricket its first written rules. In 1744 the Star and Garter pub in London hosted a meeting that produced the earliest known Laws of Cricket. The pitch was set at twenty two yards, where it still stands today. The mighty Hambledon Club in Hampshire became the heart of the sport in the 1770s, with bowlers like David Harris and batters like Silver Billy Beldham drawing huge crowds. In 1787 the Marylebone Cricket Club was founded in London, and within a year it moved to a new ground laid by Thomas Lord. The MCC stayed the global rule keeper of the sport for the next two hundred years.",
    image: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Cricket_match_at_Lord%27s_1822.jpg/640px-Cricket_match_at_Lord%27s_1822.jpg',
      alt: 'A painting of a cricket match at Lord\'s in the early 1800s',
      caption: "A match at Lord's Cricket Ground in the early 19th century",
    },
  },
  {
    year: '19th Century',
    title: 'A Sport Goes Global',
    body:
      "The 1800s saw cricket travel with the British Empire. The first overseas tour, by an English team to North America, took place in 1859. Australia hosted the very first official Test match in March 1877, beating England by 45 runs at Melbourne. Just five years later in 1882, England's loss to Australia at The Oval prompted a mock obituary in The Sporting Times that gave birth to the Ashes. William Gilbert Grace, known to everyone as W. G., was the era's giant. By the time he retired he had scored more than fifty four thousand first class runs and turned cricket into a national obsession in England.",
    image: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/W.G._Grace_c1902.jpg/440px-W.G._Grace_c1902.jpg',
      alt: 'A photograph of W. G. Grace around 1902',
      caption: 'W. G. Grace around 1902, the godfather of the modern game',
    },
  },
  {
    year: 'Early 20th Century',
    title: 'Bradman and the Bodyline Era',
    body:
      "South Africa joined Test cricket in 1889 and the West Indies in 1928. The towering figure of the early 1900s was Sir Donald Bradman of Australia. Across twenty years he averaged 99.94 in Tests, a number no one else has come close to. The 1932 to 1933 Ashes tour, remembered as the Bodyline series, saw England bowl at the body of Bradman and his teammates to slow him down. The tactic worked on the scoreboard but nearly broke diplomatic relations between Britain and Australia.",
    image: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Donald_Bradman_1937.jpg/440px-Donald_Bradman_1937.jpg',
      alt: 'A photograph of Sir Donald Bradman in 1937',
      caption: 'Sir Donald Bradman in 1937, mid prime',
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
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Sachin_Tendulkar_at_MRF_Promotion_Event.jpg/440px-Sachin_Tendulkar_at_MRF_Promotion_Event.jpg',
      alt: 'A photograph of Sachin Tendulkar at a promotion event',
      caption: 'Sachin Tendulkar, the boy from Mumbai who became cricket\'s most prolific run scorer',
    },
  },
  {
    year: '21st Century',
    title: 'T20, the Global Boom, and a New Tempo',
    body:
      "Twenty over cricket took shape in England in 2003 and the format went international by 2005. In 2007 India won the very first T20 World Cup in South Africa, and the next year the Indian Premier League turned cricket into the third most watched sport on earth. England finally lifted an ODI World Cup in 2019 in one of the most dramatic finals ever played. By 2023 the men's Cricket World Cup final filled the Narendra Modi Stadium in Ahmedabad with more than 130,000 fans, the largest cricket crowd in history.",
    image: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Narendra_Modi_Stadium_during_a_cricket_match.jpg/640px-Narendra_Modi_Stadium_during_a_cricket_match.jpg',
      alt: 'A photograph of the Narendra Modi Stadium during a cricket match',
      caption: "Narendra Modi Stadium in Ahmedabad, the largest cricket ground on the planet",
    },
  },
  {
    year: 'Today and Tomorrow',
    title: 'A Game That Refuses to Stand Still',
    body:
      "From a stick swung by a Sussex shepherd to a Sunday afternoon watched by hundreds of millions, the journey is the longest in any modern sport. Day night Tests with a pink ball, the T10 league in the United Arab Emirates, and women's cricket smashing attendance records at the MCG all show the same restless spirit. Whatever shape the next century takes, the bat and ball will probably still be at the heart of it.",
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
          <Box
            component="img"
            src={era.image.src}
            alt={era.image.alt}
            loading="lazy"
            onError={(e) => {
              // If the upstream image fails to load (offline, ad blocker,
              // upstream URL changed), hide the slot rather than show a
              // broken icon.
              const target = e.currentTarget as HTMLImageElement
              target.style.display = 'none'
            }}
            sx={{
              display: 'block',
              maxWidth: '100%',
              width: '100%',
              borderRadius: 1.5,
              border: '1px solid rgba(148, 163, 184, 0.25)',
            }}
          />
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
