// Audio design:
//  - The crowd ambience is a looping <audio> element pointed at
//    /sounds/crowd.mp3 (an actual recorded stadium loop the user supplied).
//    It's routed into the Web Audio graph via createMediaElementSource so we
//    can ramp its gain on exciting moments and silence it on mute.
//  - Events (4 / 6 / wicket / win / lose) trigger (a) a temporary cheer-volume
//    boost on the crowd, and (b) a commentary line spoken by the browser's
//    built-in SpeechSynthesis ("That's a boundary!", "Clean bowled!", etc).
//  - One master GainNode sits between everything and the destination so a
//    single ramp can silence the page on mute.

export type SoundName = 'four' | 'six' | 'wicket' | 'win' | 'lose'

const CROWD_SRC = '/sounds/crowd.mp3'
const CROWD_BASELINE = 0.4

let cachedContext: AudioContext | null = null
let masterGain: GainNode | null = null
let crowdAudio: HTMLAudioElement | null = null
let crowdGain: GainNode | null = null

// Lazily creates the shared AudioContext and master gain. Also resumes the
// context if it had been suspended (most often after an autoplay block).
function getContext(): AudioContext {
  if (!cachedContext) {
    cachedContext = new AudioContext()
    masterGain = cachedContext.createGain()
    masterGain.gain.value = 1.0
    masterGain.connect(cachedContext.destination)
  }
  if (cachedContext.state === 'suspended') {
    void cachedContext.resume()
  }
  return cachedContext
}

// Returns the master gain, ensuring the context has been initialised.
function getMaster(): GainNode {
  getContext()
  return masterGain!
}

// Ramps the master gain between 0 and 1 over 80ms, and cancels any in-flight
// speech so a mid-sentence mute actually silences the page.
export function setMasterMuted(muted: boolean): void {
  if (cachedContext && masterGain) {
    const now = cachedContext.currentTime
    masterGain.gain.cancelScheduledValues(now)
    masterGain.gain.setValueAtTime(masterGain.gain.value, now)
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.08)
  }
  if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

// Starts the crowd loop. Idempotent: on the first call it builds the audio
// element and wires it into Web Audio; on subsequent calls it just re-attempts
// .play() so the loop survives autoplay-block + first-gesture retries.
export function startCrowd(): void {
  const ctx = getContext()
  if (crowdAudio) {
    void crowdAudio.play().catch(() => {})
    return
  }

  const audio = new Audio(CROWD_SRC)
  audio.loop = true
  audio.preload = 'auto'

  try {
    const source = ctx.createMediaElementSource(audio)
    const gain = ctx.createGain()
    gain.gain.value = CROWD_BASELINE
    source.connect(gain).connect(getMaster())
    crowdAudio = audio
    crowdGain = gain
  } catch {
    // Most likely cause: the element was already connected to another context.
    // Bail and let the next call retry.
    return
  }

  void audio.play().catch(() => {
    // play() rejected (no user gesture yet); retried on the next startCrowd().
  })
}

// Briefly raises the crowd gain so a moment feels exciting, then lets it
// settle back to baseline.
function boostCheer(peak: number, duration: number): void {
  if (!crowdGain || !cachedContext) return
  const now = cachedContext.currentTime
  crowdGain.gain.cancelScheduledValues(now)
  crowdGain.gain.setValueAtTime(Math.max(crowdGain.gain.value, CROWD_BASELINE), now)
  crowdGain.gain.linearRampToValueAtTime(peak, now + 0.15)
  crowdGain.gain.exponentialRampToValueAtTime(CROWD_BASELINE, now + duration)
}

// Phrase pools for the SpeechSynthesis commentary. First entry of each list
// is what the user explicitly asked for; the rest add variety.
const PHRASES: Record<SoundName, readonly string[]> = {
  four: ["That's a boundary!", 'Beautiful shot!', 'Four runs!'],
  six: ["Wow, that's a six!", 'Maximum!', 'Out of the park!'],
  wicket: ['Clean bowled!', "He's out!", 'Got him!'],
  win: ['What a victory!', 'Match winner!'],
  lose: ['Tough loss.', 'Better luck next time.'],
}

let cachedVoices: SpeechSynthesisVoice[] = []

// Loads (and refreshes) the list of available voices. The browser emits
// `voiceschanged` asynchronously the first time, so we listen for it.
function refreshVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  cachedVoices = window.speechSynthesis.getVoices()
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices()
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
}

// Picks a deeper-sounding English voice if one is available, otherwise falls
// back to whatever the default is.
function pickCommentaryVoice(): SpeechSynthesisVoice | null {
  if (cachedVoices.length === 0) refreshVoices()
  const englishMale = cachedVoices.find(
    (v) =>
      /male|david|alex|james|daniel|fred|mark|tom|guy|aaron/i.test(v.name) &&
      v.lang.startsWith('en'),
  )
  if (englishMale) return englishMale
  const anyEnglish = cachedVoices.find((v) => v.lang.startsWith('en'))
  return anyEnglish ?? cachedVoices[0] ?? null
}

// Speaks one of the named event phrases through the browser's TTS engine.
// Slightly lowered pitch + slower rate to sound less robotic.
function speak(name: SoundName): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const pool = PHRASES[name]
  const text = pool[Math.floor(Math.random() * pool.length)]
  const utter = new SpeechSynthesisUtterance(text)
  const voice = pickCommentaryVoice()
  if (voice) utter.voice = voice
  utter.rate = 0.95
  utter.pitch = 0.92
  utter.volume = 1.0
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
}

// Dispatcher: each event boosts the crowd gain and speaks a commentary line.
export function playSound(name: SoundName): void {
  switch (name) {
    case 'four':
      boostCheer(0.65, 1.8)
      speak('four')
      return
    case 'six':
      boostCheer(0.9, 2.4)
      speak('six')
      return
    case 'wicket':
      boostCheer(0.75, 1.8)
      speak('wicket')
      return
    case 'win':
      boostCheer(1.0, 2.8)
      speak('win')
      return
    case 'lose':
      boostCheer(0.5, 1.4)
      speak('lose')
      return
  }
}
