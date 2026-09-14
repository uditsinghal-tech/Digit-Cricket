import { useEffect, useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import { fetchLeaderboard, type LeaderboardEntry } from '../api/client'

// Floating button that opens the global quiz leaderboard (GET /quiz/stats,
// no payload). Players are ranked by score high→low, ties broken by time
// low→high. Fetches each time the dialog opens.
export default function LeaderboardButton() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setRows(null)
    fetchLeaderboard()
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load leaderboard'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <>
      <Tooltip title="Quiz Leaderboard">
        <IconButton
          onClick={() => setOpen(true)}
          sx={{ position: 'fixed', top: 8, right: 252, zIndex: 20, color: 'rgba(248,250,252,0.85)' }}
        >
          <LeaderboardIcon />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Quiz Leaderboard</DialogTitle>
        <DialogContent>
          {loading && (
            <Stack alignItems="center" py={3}>
              <CircularProgress />
            </Stack>
          )}
          {error && <Alert severity="info">{error}</Alert>}
          {rows && rows.length === 0 && <Alert severity="info">No quiz scores yet.</Alert>}
          {rows && rows.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Rank</TableCell>
                  <TableCell>Player</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell align="right">Time (s)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.email}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell align="right">{r.score}</TableCell>
                    <TableCell align="right">{r.timeSeconds}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
