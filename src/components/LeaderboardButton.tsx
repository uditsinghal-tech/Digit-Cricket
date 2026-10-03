import { useEffect, useRef, useState } from 'react'
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
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import DownloadIcon from '@mui/icons-material/Download'
import { fetchAdminResults, fetchLeaderboard, type ContestBoard } from '../api/client'

// Other screens open the dialog with
//   window.dispatchEvent(new CustomEvent(OPEN_LEADERBOARD_EVENT, { detail: { title } }))
// `title` (optional) picks that contest's tab.
export const OPEN_LEADERBOARD_EVENT = 'digit-cricket:open-leaderboard'

type Props = {
  // Signed-in player's display name (unique per account): their row is
  // highlighted and scrolled into view. Null for guests.
  highlightName: string | null
  // Admins get an "Export CSV" button with every player's email.
  isAdmin: boolean
}

// Floating button that opens the contest leaderboards (GET /quiz/stats, no
// payload). One tab per contest, in contest order; the server only returns
// contests someone has played, so unplayed contests get no tab. Opens on
// the latest contest (or the one asked for). Rows arrive already ranked;
// rank is the row position. Fetches each time the dialog opens.
export default function LeaderboardButton({ highlightName, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const [boards, setBoards] = useState<ContestBoard[] | null>(null)
  const [boardIndex, setBoardIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const wantedTitle = useRef<string | null>(null)
  const myRow = useRef<HTMLTableRowElement | null>(null)
  const rows = boards?.[boardIndex]?.entries ?? null

  const openDialog = (title: string | null = null) => {
    wantedTitle.current = title
    setBoards(null)
    setError(null)
    setLoading(true)
    setOpen(true)
  }

  useEffect(() => {
    const onOpen = (e: Event) =>
      openDialog((e as CustomEvent<{ title?: string }>).detail?.title ?? null)
    window.addEventListener(OPEN_LEADERBOARD_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_LEADERBOARD_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchLeaderboard()
      .then((b) => {
        if (cancelled) return
        const wanted = b.findIndex((board) => board.title === wantedTitle.current)
        setBoards(b)
        setBoardIndex(wanted >= 0 ? wanted : Math.max(b.length - 1, 0))
      })
      .catch(
        (e) =>
          !cancelled && setError(e instanceof Error ? e.message : 'Failed to load leaderboard'),
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open])

  // Bring the player's own row into view on open and on tab change.
  useEffect(() => {
    myRow.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [rows])

  // Admin: download the current tab's results (with emails) as CSV.
  const exportCsv = async () => {
    const board = boards?.[boardIndex]
    if (!board) return
    setExporting(true)
    try {
      const all = await fetchAdminResults()
      const entries = all.find((b) => b.id === board.id)?.entries ?? []
      const header = [
        'Rank',
        'Name',
        'Email',
        'Finished',
        'Score',
        'Correct',
        'Time (s)',
        'Started',
        'Submitted',
      ]
      const lines = entries.map((e) => [
        e.rank,
        e.name,
        e.email,
        e.finished ? 'yes' : 'no',
        e.score,
        e.correct ?? '',
        e.timeSeconds ?? '',
        e.startedAt,
        e.submittedAt ?? '',
      ])
      downloadCsv(`${board.id}-results.csv`, [header, ...lines])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Tooltip title="Quiz Leaderboard">
        <IconButton
          onClick={() => openDialog()}
          sx={{
            // Same dark glass as the other floating icons, so it reads on the day sky too.
            position: 'fixed',
            top: 12,
            right: 252,
            zIndex: 20,
            color: 'rgba(248, 250, 252, 0.78)',
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            '&:hover': { color: '#f8fafc', background: 'rgba(15, 23, 42, 0.8)' },
          }}
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
          {boards && boards.length === 0 && <Alert severity="info">No contest scores yet.</Alert>}
          {boards && boards.length > 0 && (
            <Tabs
              value={boardIndex}
              onChange={(_, i: number) => setBoardIndex(i)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              {boards.map((b) => (
                <Tab key={b.id} label={b.title} sx={{ textTransform: 'none' }} />
              ))}
            </Tabs>
          )}
          {rows && rows.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Rank</TableCell>
                  <TableCell>Player</TableCell>
                  <TableCell align="right">Score / 100</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* The list is static once loaded, so keying by rank is safe. */}
                {rows.map((r, i) => {
                  const mine = highlightName !== null && r.name === highlightName
                  return (
                    <TableRow
                      key={i}
                      ref={mine ? myRow : undefined}
                      sx={
                        mine
                          ? {
                              background: 'rgba(56, 189, 248, 0.18)',
                              '& td': { fontWeight: 700, color: '#7dd3fc' },
                            }
                          : undefined
                      }
                    >
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{mine ? `${r.name} (you)` : r.name}</TableCell>
                      <TableCell align="right">{r.score.toFixed(2)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          {isAdmin && boards && boards.length > 0 && (
            <Button
              startIcon={<DownloadIcon />}
              onClick={() => void exportCsv()}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export CSV (with emails)'}
            </Button>
          )}
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// Builds a CSV (Excel-friendly) and triggers a download. Cells starting with = + - @
// are prefixed with ' so a crafted name or email can't run as a spreadsheet formula.
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    let s = String(v)
    if (/^[=+\-@]/.test(s)) s = `'${s}`
    return `"${s.replace(/"/g, '""')}"`
  }
  const csv = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
