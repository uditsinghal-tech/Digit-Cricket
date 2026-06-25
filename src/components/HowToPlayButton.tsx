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
import Divider from '@mui/material/Divider'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

// Fixed icon button (left of the DayNightToggle) that opens a How-to-play
// dialog summarising the game's rules, scoring, and match formats.
export default function HowToPlayButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip title="How to play" arrow>
        <IconButton
          onClick={() => setOpen(true)}
          aria-label="How to play"
          sx={{
            position: 'fixed',
            top: 12,
            right: 108,
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
          <InfoOutlinedIcon />
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>How to play Digit Cricket</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Section title="The basics">
              Each ball, both you and your opponent secretly pick a number from{' '}
              <b>1 to 6</b>. The picks are revealed together and the cricket rules
              below decide what happens.
            </Section>

            <Section title="Scoring runs">
              If the batter and bowler pick <b>different</b> numbers, the batter
              scores their own pick as runs. So picking a 6 while the bowler picks
              a 3 = 6 runs to the batter.
            </Section>

            <Section title="Taking a wicket">
              If both players pick the <b>same</b> number, the batter is{' '}
              <b>out</b> — that innings ends immediately. There is one wicket per
              innings.
            </Section>

            <Section title="Innings &amp; chasing">
              The batter of the first innings sets a total (or gets out). Roles
              then swap and the new batter chases that total + 1 to win. Match
              ties on equal totals.
            </Section>

            <Section title="Per-ball timer (10 seconds)">
              You have <b>10 seconds</b> to pick each ball. The clock turns red in
              the last 4 seconds. Miss the deadline and the system auto-picks{' '}
              <b>0</b> for you — you score nothing that ball, but you can&apos;t be
              given out unless your opponent also times out.
            </Section>

            <Divider flexItem />

            <Section title="Match formats">
              <Box component="ul" sx={{ pl: 2.5, my: 0.5 }}>
                <li>
                  <b>6-ball match</b> — sharp and snappy. 6 balls per innings,
                  one wicket each. Best for a quick round.
                </li>
                <li>
                  <b>12-ball match</b> — more room to build a chase. 12 balls per
                  innings, one wicket each. Still ends fast but rewards pacing.
                </li>
              </Box>
            </Section>

            <Section title="Singleplayer vs Multiplayer">
              <Box component="ul" sx={{ pl: 2.5, my: 0.5 }}>
                <li>
                  <b>Vs Computer</b> — the AI picks instantly. Match length is
                  picked from the singleplayer screen.
                </li>
                <li>
                  <b>Vs Friend</b> — host creates a room with a chosen length
                  (6 or 12 balls). Share the room code; it&apos;s valid for{' '}
                  <b>5 minutes</b>. Both peers see the same toss, picks, and
                  result in real-time.
                </li>
              </Box>
            </Section>

            <Section title="Winning">
              Highest total at the end of both innings wins. Equal totals = match
              tie. The second innings ends early if the chaser passes the target
              or loses their wicket.
            </Section>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Got it</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" component="div" sx={{ opacity: 0.85, lineHeight: 1.55 }}>
        {children}
      </Typography>
    </Box>
  )
}
