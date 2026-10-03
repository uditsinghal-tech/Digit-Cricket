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
import { motion } from 'framer-motion'

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
        <DialogTitle sx={{ fontWeight: 700 }}>About Digit Cricket &amp; Rules</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Section title="Summary">
              Digit Cricket is a browser-based pick-a-number cricket game inspired by
              the classic finger-cricket schoolyard format. Two sides pick a number
              each ball, and the picks decide runs and wickets. The app comes with
              two activities: a cricket match (against the in-app opponent or against
              a friend in another window) and a separate cricket quiz to test and enhance
              your cricket knowledge.
            </Section>

            <Divider flexItem />

            <Section title="Play Cricket: Features">
              <Box component="ul" sx={{ pl: 2.5, my: 0.5 }}>
                <li><b>Three match formats.</b> 6-ball, 12-ball, and a 4-innings Test match.</li>
                <li><b>Play vs DigitCricket.</b> Quick singleplayer match against the in-app opponent.</li>
                <li><b>Play vs Friend.</b> Host or join a room with a 5-minute room code. Both sides see the same toss, picks, and result live.</li>
                <li><b>In-match voice call.</b> Optional voice chat between the two friends. Starts on tap and ends automatically when the match finishes.</li>
                <li><b>Per-ball 10-second timer.</b> A circular clock with a dot countdown. Miss the deadline and the system auto-picks 0.</li>
                <li><b>Animated stadium background.</b> Day and night theme toggle, crowd reactions for fours, sixes, and wickets.</li>
                <li><b>Sound effects.</b> Crowd ambience, boundary cheers, wicket roars. Mute toggle is in the top right.</li>
                <li><b>Ball-by-ball result screen.</b> Full innings summary at the end. Test matches show both of each side&apos;s innings folded together.</li>
              </Box>
            </Section>

            <Section title="Play Cricket: How to play">
              <Box component="ul" sx={{ pl: 2.5, my: 0.5 }}>
                <li>
                  <b>The basics.</b> Each ball, both you and your opponent
                  secretly pick a number from <b>1 to 6</b>. The picks are
                  revealed together.
                </li>
                <li>
                  <b>Scoring runs.</b> If the two picks are <b>different</b>, the
                  batter scores their own pick as runs. So picking 6 while the
                  bowler picks 3 = 6 runs to the batter.
                </li>
                <li>
                  <b>Taking a wicket.</b> If both pick the <b>same</b> number,
                  the batter is <b>out</b> and the innings ends. One wicket per
                  innings.
                </li>
                <li>
                  <b>Innings and chasing.</b> The first batter sets a total (or
                  gets out). Roles swap and the new batter chases target + 1 to
                  win. Equal totals = tie.
                </li>
                <li>
                  <b>Per-ball timer.</b> 10 seconds to pick each ball. Clock
                  turns red in the last 4 seconds. Time out and the system
                  auto-picks 0 (no runs, no wicket unless both sides time out).
                </li>
                <li>
                  <b>Formats.</b> 6-ball and 12-ball matches are 2 innings (one
                  each side). Test match is 4 innings of 6 balls each (each
                  side bats twice). The chase target is set at the start of innings 4.
                </li>
                <li>
                  <b>Winning.</b> Highest total at the end wins. The chasing
                  innings ends early if the chaser passes the target or loses
                  their wicket.
                </li>
              </Box>
            </Section>

            <Divider flexItem />

            <Section title="Cricket Quiz: features">
              <Box component="ul" sx={{ pl: 2.5, my: 0.5 }}>
                <li><b>Question bank.</b> Covers rules, famous players, World Cups, IPL, records, venues, and cricket history.</li>
                <li><b>10 questions per round.</b> Sampled fresh at random each time you play.</li>
                <li><b>Four difficulty levels.</b> Easy, Medium, Hard, and Challenging (a mix of all bands including extreme trivia).</li>
                <li><b>Shuffled answer options.</b> The correct option moves around each session, so memorising a position won&apos;t help.</li>
                <li><b>Free navigation.</b> Jump between questions with Previous and Next. Change your answer any time before finishing.</li>
                <li><b>Result screen.</b> Green tick or red cross next to every question, plus the answer you picked. The correct answer is not revealed, so a wrong question stays a learning prompt.</li>
                <li><b>Try Again or Home.</b> Instantly resample a fresh 10 questions, or return to the main menu.</li>
              </Box>
            </Section>

            <Section title="Cricket Quiz: How to play">
              <Box component="ul" sx={{ pl: 2.5, my: 0.5 }}>
                <li>Pick a difficulty. Easy, Medium, Hard, or Challenging.</li>
                <li>You will be shown 10 multiple-choice questions, one at a time.</li>
                <li>Each question has 4 options. Tap the one you think is right.</li>
                <li>Use <b>Previous</b> and <b>Next</b> to walk between questions. Your answers are saved as you go, and you can change them.</li>
                <li>Tap <b>Finish Quiz</b> on the last question to lock in your answers.</li>
                <li>Each correct answer counts as 1 point. Unanswered questions count as wrong.</li>
                <li>Maximum score is 10. Tap <b>Try Again</b> for a fresh 10 questions in the same difficulty.</li>
              </Box>
            </Section>

            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  rotate: [-3, 3, -3],
                }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                style={{ display: 'inline-block' }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: '#ef4444',
                    textShadow: '0 0 12px rgba(239, 68, 68, 0.55)',
                  }}
                >
                  ENJOYY!!!
                </Typography>
              </motion.div>
            </Box>
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
