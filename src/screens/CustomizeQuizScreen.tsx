import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import FormControl from '@mui/material/FormControl'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { motion, type Variants } from 'framer-motion'
import { generateCustomQuiz, type CustomQuizOptions } from '../quiz/geminiClient'
import type { QuizQuestion } from '../quiz/questions'
import type { SelectChangeEvent } from '@mui/material/Select'

// Form-driven screen that lets the player tell Gemini exactly what they
// want from the next quiz: how many questions, men's or women's
// cricket (or both), and which topic slices to focus on. The "Generate
// Quiz" button calls Gemini, validates the response, and hands the
// finished questions back to App.tsx via `onGenerated`.

// Hard-coded list of topic categories the player can multi-select. The
// labels are exactly what gets injected into the prompt to Gemini, so
// any change here changes the model's instructions verbatim. 20 topics
// gives plenty of choice without overwhelming the dropdown.
const TOPIC_OPTIONS: string[] = [
  'Test cricket',
  'ODI cricket',
  'T20I cricket',
  'ICC T20 World Cup',
  '50-over Cricket World Cup',
  'ICC World Test Championship',
  'ICC Champions Trophy',
  'Asia Cup',
  'The Ashes',
  'Border-Gavaskar Trophy',
  'Day-night Tests with the pink ball',
  'Indian Premier League (IPL)',
  'Big Bash League (BBL)',
  'Pakistan Super League (PSL)',
  'Caribbean Premier League (CPL)',
  'The Hundred',
  'Famous batters and bowlers',
  'Famous cricket stadiums',
  'Cricket records',
  'History and laws of cricket',
]

type Props = {
  playerName: string
  onGenerated: (questions: QuizQuestion[]) => void
  onBack: () => void
}

const containerVariants = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, y: -24, transition: { duration: 0.3, ease: 'easeIn' } },
} satisfies Variants

export default function CustomizeQuizScreen({ playerName, onGenerated, onBack }: Props) {
  // Form state. Defaults: 10 questions, both genders, no topics picked.
  // Empty topics is allowed — the prompt falls back to general cricket.
  const [count, setCount] = useState<number>(10)
  const [scopes, setScopes] = useState<CustomQuizOptions['scopes']>(['mens', 'womens'])
  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validation rules surfaced to the user before they can press Generate.
  const countInvalid = !Number.isInteger(count) || count < 1 || count > 20
  const scopesInvalid = scopes.length === 0
  const isValid = !countInvalid && !scopesInvalid

  // Coerces the input string back to an integer. Caps at 20 so the
  // textfield can't push past the limit even if the user types it.
  const handleCountChange = (raw: string) => {
    const parsed = parseInt(raw, 10)
    if (Number.isNaN(parsed)) {
      setCount(0)
      return
    }
    setCount(Math.max(0, Math.min(20, parsed)))
  }

  const handleScopesChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value
    setScopes((typeof value === 'string' ? value.split(',') : value) as CustomQuizOptions['scopes'])
  }

  const handleTopicsChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value
    setTopics(typeof value === 'string' ? value.split(',') : value)
  }

  // Sends the form to Gemini. On success, hands the questions to the
  // parent which routes to the existing QuizScreen with these as the
  // pre-loaded set.
  const handleGenerate = async () => {
    if (!isValid) return
    setLoading(true)
    setError(null)
    try {
      const questions = await generateCustomQuiz({ count, scopes, topics })
      onGenerated(questions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong generating the quiz.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      key="customize-quiz-screen"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <Box sx={{ width: '100%', maxWidth: 520, px: 3, py: 4, textAlign: 'center' }}>
        <Stack spacing={3} alignItems="stretch">
          <Stack spacing={1} alignItems="center">
            <Typography variant="h4" component="h1" className="title">
              Customize Quiz
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              Hi {playerName}, tell us what you want and we'll build the quiz for you.
            </Typography>
          </Stack>

          <TextField
            label="Number of questions"
            type="number"
            value={count === 0 ? '' : count}
            onChange={(e) => handleCountChange(e.target.value)}
            slotProps={{ htmlInput: { min: 1, max: 20, step: 1 } }}
            error={countInvalid}
            helperText={countInvalid ? 'Pick a whole number between 1 and 20.' : 'Maximum 20.'}
            fullWidth
          />

          <FormControl fullWidth error={scopesInvalid}>
            <InputLabel id="customize-scopes-label">Category</InputLabel>
            <Select
              labelId="customize-scopes-label"
              multiple
              value={scopes}
              label="Category"
              onChange={handleScopesChange}
              renderValue={(selected) =>
                selected.length === 0
                  ? 'None'
                  : selected.map((s) => (s === 'mens' ? "Men's cricket" : "Women's cricket")).join(', ')
              }
            >
              <MenuItem value="mens">
                <Checkbox checked={scopes.includes('mens')} />
                <ListItemText primary="Men's cricket" />
              </MenuItem>
              <MenuItem value="womens">
                <Checkbox checked={scopes.includes('womens')} />
                <ListItemText primary="Women's cricket" />
              </MenuItem>
            </Select>
            {scopesInvalid && (
              <Typography variant="caption" sx={{ color: 'error.main', mt: 0.5 }}>
                Pick at least one category.
              </Typography>
            )}
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="customize-topics-label">Topics</InputLabel>
            <Select
              labelId="customize-topics-label"
              multiple
              value={topics}
              label="Topics"
              onChange={handleTopicsChange}
              renderValue={(selected) => (selected.length === 0 ? 'All cricket' : selected.join(', '))}
              MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
            >
              {TOPIC_OPTIONS.map((topic) => (
                <MenuItem key={topic} value={topic}>
                  <Checkbox checked={topics.includes(topic)} />
                  <ListItemText primary={topic} />
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5 }}>
              Leave empty for a mix of all cricket.
            </Typography>
          </FormControl>

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            variant="contained"
            color="secondary"
            size="large"
            onClick={handleGenerate}
            disabled={!isValid || loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
            sx={{ py: 1.25, fontSize: '1rem' }}
          >
            {loading ? 'Generating with Gemini…' : 'Generate Quiz'}
          </Button>

          <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'text.secondary' }}>
            Back to difficulty
          </Button>
        </Stack>
      </Box>
    </motion.div>
  )
}
