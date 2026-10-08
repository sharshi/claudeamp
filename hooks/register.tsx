import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Deck, Finale, Phase } from '../types'
import { deckSvg, frameFor, SCENES } from './scenes'
import type { TickerProps } from './ticker'
import { contentWords, lyricWords, stringsIn, Tally } from './words'
import type { WordSource } from './words'

const PANE = 'claudamp'
const SCENE_MS = 12_000
/**
 * Every state write redraws the pane, and the desktop reloads an Svg whole
 * (a visible blink), so redraws are rare: the CSS inside the SVG carries the
 * motion between them.
 */
/**
 * How the drawing is shown: `frame` (a sandboxed frame; CSS animation is
 * certain, but each update reloads it) or `image` (may swap without a blink).
 * Chosen with `/claudamp mode`, kept in the store.
 */
let mode: 'frame' | 'image' = 'frame'
const STORE_MODE = 'mode'
let MIN_GAP = 3_000
/** Wordclaude draws every word it has room for; this only bounds the redraw's size. */
const WORD_LIMIT = 160
let LYRIC_GAP = 3_500

function setMode(next: 'frame' | 'image'): void {
  mode = next
  MIN_GAP = next === 'image' ? 1_000 : 3_000
  LYRIC_GAP = next === 'image' ? 3_000 : 3_500
}

/** The picker's choices: null rotates the scenes, a number pins one. */
const CHOICES = [
  { key: 'auto', label: '⟳ Auto', hotkey: 'a', pick: null },
  { key: 'spectrum', label: '▮▮ Spectrum', hotkey: 's', pick: 0 },
  { key: 'cloud', label: '☁ Wordclaude', hotkey: 'c', pick: 1 },
  { key: 'lyrics', label: '♪ Lyrics', hotkey: 'l', pick: 2 },
  { key: 'tetris', label: '▦ Tetris', hotkey: 't', pick: 3 },
] as const
const STORE_PICK = 'pick'
/** The tally's top words, kept so a new session starts with words to show. */
const STORE_WORDS = 'words'

const INITIAL: Deck = {
  phase: 'idle',
  scene: 0,
  pick: null,
  energy: 0,
  tokensPerSec: 0,
  bands: [],
  tool: null,
  lyric: [],
  words: [],
  beat: 0,
  turnStartedAt: 0,
  glitch: 0,
  finale: null,
}
const deck = atom({ plugin: 'claudamp', key: 'deck' } as const, INITIAL)

// The live stream's running tallies. A reload starts them over, which only
// empties the cloud; what the pane draws is in $.state.
const tally = new Tally()
let live: { phase: Phase; tool: string | null } = { phase: 'idle', tool: null }
let chars = 0
/** When stream text (and tool activity) arrived, and how much: the spectrum's raw data. */
let arrivals: { t: number; n: number }[] = []
const BANDS = 48
let lyricBuf: string[] = []
let lyricFresh = false
let phaseChanged = false
let glitchPending = false
let lastFlush = 0
let scene = 0
let pick: number | null = null
let sceneSince = 0
let turnId = ''
let turn = { tools: 0, outputTokens: 0 }

/** Between turns the engine still makes requests of its own (prompt suggestions and the like); they are not the show. */
const inTurn = () => live.phase !== 'idle' && live.phase !== 'finale'

function setPhase(phase: Phase, tool: string | null = live.tool): void {
  if (live.phase === phase && live.tool === tool) return
  live = { phase, tool }
  phaseChanged = true
}

/** What the stream has delivered this session: is thinking reaching the mod? */
const heard: Record<WordSource, number> = { think: 0, reply: 0, prompt: 0, tool: 0 }

/** Words for the cloud from any source; prompts count a little more, tool traffic less. */
function hear(text: string, source: WordSource, weight = 1): void {
  heard[source] += text.length
  tally.add(contentWords(text), source, weight)
}

/** The last few seconds of stream, for the live tok/s on the LCD. */
let recent: { t: number; n: number }[] = []
let vuHistory: number[] = []
/** The latest tool call in a few words: `Edit scenes.ts`, `Bash npm test`. */
let lastAction = ''

function liveTps(now: number): number {
  recent = recent.filter(r => now - r.t < 2_000)
  // About four characters to a token.
  return recent.reduce((n, r) => n + r.n, 0) / 2 / 4
}

async function tickerProps($: EngineInterface): Promise<TickerProps> {
  const d = await read($, deck)
  const now = Date.now()
  const tps = inTurn() ? liveTps(now) : 0
  vuHistory = [...vuHistory, Math.min(1, tps / 60)].slice(-16)
  const sceneName = SCENES[d.scene] ?? ''
  const text =
    d.phase === 'idle'
      ? 'CLAUDAMP ★ WAITING FOR A PROMPT ★ PRESS PLAY'
      : d.phase === 'finale'
        ? `FIN ★ ${(d.finale?.title ?? '').toUpperCase()} ★ THANKS FOR LISTENING`
        : live.phase === 'tool'
          ? `▶ ${lastAction || live.tool || 'TOOL'} ★ ${sceneName}`
          : `CLAUDE · ${live.phase.toUpperCase()} ★ ${sceneName}${lastAction ? ` ★ last: ${lastAction}` : ''}`
  return {
    phase: inTurn() ? live.phase : d.phase,
    text,
    tps,
    vu: Array.from({ length: 16 }, (_, i) => vuHistory[i - 16 + vuHistory.length] ?? 0),
    startedAt: inTurn() ? d.turnStartedAt : 0,
    durationMs: d.phase === 'finale' ? (d.finale?.durationMs ?? null) : null,
  }
}

/** A tool call in a few words, for the ticker. */
function describeCall(e: Record<string, unknown>): string {
  for (const key of ['command', 'file_path', 'pattern', 'url', 'path', 'description', 'query']) {
    const v = e[key]
    if (typeof v === 'string' && v.trim()) {
      const short = key === 'file_path' || key === 'path' ? (v.split('/').pop() ?? v) : v
      return `${String(e.tool)} ${short.replace(/\s+/g, ' ').slice(0, 48)}`
    }
  }
  return String(e.tool)
}

function feed(text: string, isThinking: boolean): void {
  recent.push({ t: Date.now(), n: text.length })
  chars += text.length
  arrivals.push({ t: Date.now(), n: text.length })
  hear(text, isThinking ? 'think' : 'reply')
  const words = lyricWords(text)
  if (words.length) {
    lyricBuf = [...lyricBuf, ...words].slice(-24)
    lyricFresh = true
  }
}

/** The one place the live pane is written, so the one place it redraws. */
/** A click on the picker: pin a scene (or go back to rotating), and keep it. */
async function choose($: EngineInterface, next: number | null): Promise<void> {
  pick = next
  if (next !== null) scene = next
  sceneSince = Date.now()
  // A pick during the finale or between turns shows that scene right away.
  if (live.phase === 'finale') live = { phase: 'idle', tool: null }
  await update($, deck, (d): Deck => ({
    ...d,
    pick: next,
    scene,
    phase: d.phase === 'finale' ? 'idle' : d.phase,
    beat: d.beat + 1,
  }))
  if (next === null) await $.store.delete(STORE_PICK)
  else await $.store.set(STORE_PICK, next)
}

async function flush($: EngineInterface, start?: { turnStartedAt: number }): Promise<void> {
  const now = Date.now()
  if (!start) {
    if (live.phase === 'idle' || live.phase === 'finale') return
    if (now - lastFlush < MIN_GAP) return
    const rotate = pick === null && now - sceneSince >= SCENE_MS
    const freshLyrics = scene === 2 && lyricFresh && now - lastFlush >= LYRIC_GAP
    if (!rotate && !phaseChanged && !glitchPending && !freshLyrics) return
    if (rotate) {
      scene = (scene + 1) % SCENES.length
      sceneSince = now
    }
  }

  const seconds = Math.max(0.25, (now - (lastFlush || now)) / 1000)
  const cps = chars / seconds
  let target = Math.min(1, cps / 320)
  if (live.phase === 'tool') target = Math.max(target, 0.45)
  const glitch = glitchPending ? 1 : 0
  const bands = slice(arrivals, (lastFlush || now - MIN_GAP), now)
  arrivals = []
  chars = 0
  lastFlush = now
  phaseChanged = false
  glitchPending = false
  const lyric = lyricFresh ? lyricBuf.slice(-8) : undefined
  lyricFresh = false

  await update($, deck, (d): Deck => ({
    ...d,
    ...(start ? { ...start, finale: null } : {}),
    phase: live.phase,
    tool: live.tool,
    scene,
    energy: Math.round((d.energy * 0.4 + target * 0.6) * 100) / 100,
    tokensPerSec: Math.round(cps / 4),
    bands,
    words: tally.top(WORD_LIMIT),
    lyric: lyric ?? (start ? [] : d.lyric),
    glitch,
    beat: d.beat + 1,
  }))
}

/**
 * The pane's room in CSS pixels, from its cells. An Svg left unsized gets a
 * sandboxed frame's default 150px height, so the size is always given.
 */
const CELL = { width: 8.4, height: 18 }
let lastSize: { columns: number; rows: number | null; width: number; height: number } | null = null

function paneSize(columns: number, rows: number | undefined): { width: number; height: number } {
  const width = Math.max(240, Math.round(columns * CELL.width) - 8)
  // The picker's buttons wrap; leave them their rows.
  const labels = CHOICES.reduce((n, c) => n + c.label.length * 9 + 56, 0)
  const pickerRows = Math.max(1, Math.ceil(labels / width))
  // Less the LCD strip's row.
  const room = rows === undefined ? width * 1.4 : rows * CELL.height - pickerRows * 44 - 16 - 30
  return { width, height: Math.round(Math.min(width * 3, Math.max(240, room))) }
}

/**
 * Slices [from, to] into BANDS equal spans and measures what arrived in each,
 * scaled to the busiest span (square-rooted, as a VU meter reads loudness).
 */
function slice(samples: { t: number; n: number }[], from: number, to: number): number[] {
  const span = Math.max(1, to - from) / BANDS
  const sums = Array<number>(BANDS).fill(0)
  for (const { t, n } of samples) {
    const i = Math.floor((t - from) / span)
    if (i >= 0 && i < BANDS) sums[i]! += n
  }
  const max = Math.max(...sums)
  return max > 0 ? sums.map(v => Math.round(Math.sqrt(v / max) * 100) / 100) : []
}

function firstSentences(text: string): string[] {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 8)
    .slice(0, 3)
}

async function linerNotes($: EngineInterface, answer: string): Promise<{ title: string; lines: string[] } | null> {
  const r = await $.model.complete({
    model: 'haiku',
    maxTokens: 300,
    timeoutMs: 20_000,
    system: 'You write liner notes for a coding session as if it were a song. Reply with JSON only.',
    prompt:
      'Here is the final reply an AI coding assistant just gave. Return {"title": "...", "lines": ["...", "..."]}: ' +
      'title is an evocative 2-6 word song-style name for what happened; lines are up to 3 plain, factual one-sentence ' +
      'summaries of what was done or found (each under 80 characters).\n\n<reply>\n' +
      answer.slice(0, 6000) +
      '\n</reply>',
  })
  if (!r.isAnswered) return null
  try {
    const json = JSON.parse(r.text.slice(r.text.indexOf('{'), r.text.lastIndexOf('}') + 1)) as { title?: unknown; lines?: unknown }
    const title = typeof json.title === 'string' ? json.title.slice(0, 60) : null
    const lines = Array.isArray(json.lines) ? json.lines.filter((l): l is string => typeof l === 'string').slice(0, 3) : []
    return title ? { title, lines } : null
  } catch {
    return null
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'claudamp',
      description: 'Open the Claudamp visualizer (args: next, stats, size, mode image|frame)',
    })
    const stored = await $.store.get(STORE_PICK)
    pick = typeof stored === 'number' && stored >= 0 && stored < SCENES.length ? stored : null
    scene = pick ?? 0
    const storedMode = await $.store.get(STORE_MODE)
    setMode(storedMode === 'image' ? 'image' : 'frame')
    const kept = await $.store.get(STORE_WORDS)
    if (Array.isArray(kept)) tally.seed(kept)
    await update($, deck, (d): Deck => ({ ...d, pick, scene, words: tally.top(WORD_LIMIT) }))
    void $.ui.open({ id: PANE, title: 'Claudamp' })
    $.clock.every(450, () => void flush($))

    return next(e)
  })

  on('command.run', { command: 'claudamp' }, async ($, e) => {
    const [verb, arg] = e.args.trim().split(/\s+/)
    if (verb === 'mode') {
      if (arg === 'image' || arg === 'frame') {
        setMode(arg)
        await $.store.set(STORE_MODE, arg)
        await update($, deck, (d): Deck => ({ ...d, beat: d.beat + 1 }))
        return { text: `Claudamp draws in ${arg} mode now (redraws up to every ${MIN_GAP / 1000}s).` }
      }
      return { text: `Claudamp is in ${mode} mode. Use /claudamp mode image (may swap without a blink) or /claudamp mode frame.` }
    }
    if (e.args.trim() === 'stats') {
      const words = tally.top(WORD_LIMIT)
      const count = (s: WordSource) => words.filter(w => w[2] === s).length
      const n = (s: WordSource) => heard[s].toLocaleString()
      return {
        text:
          `Claudamp heard ${n('think')} characters of thinking, ${n('reply')} of replies, ${n('prompt')} of your prompts ` +
          `and ${n('tool')} of tool calls and results this session. The cloud holds ${words.length} words: ` +
          `${count('think')} mostly from thinking, ${count('reply')} from replies, ${count('prompt')} from you, ${count('tool')} from tools.`,
      }
    }
    if (e.args.trim() === 'size') {
      return {
        text: lastSize
          ? `Claudamp pane: ${lastSize.columns} columns × ${lastSize.rows ?? '?'} rows → drawn at ${lastSize.width}×${lastSize.height}px.`
          : 'Claudamp has not drawn yet.',
      }
    }
    if (e.args.trim() === 'next') {
      if (pick !== null) await choose($, (pick + 1) % SCENES.length)
      else {
        scene = (scene + 1) % SCENES.length
        sceneSince = Date.now()
        await update($, deck, (d): Deck => ({ ...d, scene, beat: d.beat + 1 }))
      }
      return { text: `Claudamp: ${SCENES[scene]?.toLowerCase()}.` }
    }
    await $.ui.open({ id: PANE, title: 'Claudamp' })
    return { text: 'Claudamp is playing.' }
  })

  on('turn.start', async ($, e, next) => {
    // Last turn's words fade fast, so this prompt's words take over the cloud quickly.
    tally.decay(0.3)
    hear(e.text, 'prompt', 1.5)
    // The turn opens on your own words.
    lyricBuf = lyricWords(e.text).slice(-24)
    lyricFresh = lyricBuf.length > 0
    turn = { tools: 0, outputTokens: 0 }
    turnId = e.turnId
    lastAction = ''
    live = { phase: 'thinking', tool: null }
    scene = pick ?? 0
    sceneSince = Date.now()
    await flush($, { turnStartedAt: Date.now() })

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    // Only the turn your prompt started (and subagents working on it) drives the pane;
    // side requests, such as a prompt suggestion written from the last answer, pass by unwatched.
    const isOurs = inTurn() && (e.turnId === turnId || e.agentId !== undefined)
    if (!isOurs) return yield* next(e)
    const stream = next(e)
    for await (const chunk of stream) {
      try {
        if (chunk.kind === 'thinking') {
          setPhase('thinking')
          feed(chunk.text, true)
        } else if (chunk.kind === 'text') {
          setPhase('writing')
          feed(chunk.text, false)
        } else if (chunk.kind === 'tool') {
          setPhase('tool', chunk.name)
        } else if (chunk.kind === 'stop') {
          turn.outputTokens += chunk.usage?.output_tokens ?? 0
        }
      } catch {
        // Watching must never break the stream.
      }
      yield chunk
    }

    return await stream.result
  })

  on('tool.call', async ($, e, next) => {
    if (!inTurn()) return next(e)
    turn.tools += 1
    lastAction = describeCall(e as unknown as Record<string, unknown>)
    setPhase('tool', e.tool)
    void flush($)
    hear(stringsIn(e, 3000), 'tool')
    // A tool call is a beat on the meter: one when it starts, one when it answers.
    arrivals.push({ t: Date.now(), n: 60 })
    const ran = await next(e)
    // A big file read or long output should flavour the cloud, not flood it.
    if (ran.deny === undefined) hear(`${stringsIn(ran.result, 4000)} ${ran.text ?? ''}`, 'tool', 0.4)
    arrivals.push({ t: Date.now(), n: 90 })
    if (ran.deny === undefined && ran.isError === true) glitchPending = true
    setPhase('thinking', null)

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined || e.turnId !== turnId || !inTurn()) return next(e)

    const finale: Finale = {
      title: e.reason === 'answer' ? 'Done' : e.reason === 'aborted' ? 'Interrupted' : 'No answer',
      lines: firstSentences(e.answer),
      durationMs: e.durationMs,
      outputTokens: e.usage?.output_tokens ?? turn.outputTokens,
      tools: turn.tools,
      topWords: tally.top(5).map(([w]) => w),
      outcome: e.reason,
      isFresh: true,
    }
    live = { phase: 'finale', tool: null }
    // Best effort: losing the carried-over words costs nothing that matters.
    $.store.set(STORE_WORDS, tally.top(120)).catch(() => {})

    // One redraw for the whole finale: wait (briefly) for the liner notes so
    // the flash plays once, with the summary already in it.
    const ended = e.turnId
    let isShown = false
    const show = (notes: { title: string; lines: string[] } | null) => {
      if (isShown || turnId !== ended) return
      isShown = true
      void update($, deck, (d): Deck => ({ ...d, phase: 'finale', finale: { ...finale, ...(notes ?? {}) }, beat: d.beat + 1 }))
    }
    if (e.reason === 'answer' && e.answer.trim()) {
      $.clock.after(4000, () => show(null))
      $.clock.after(0, () => {
        void linerNotes($, e.answer).then(show, () => show(null))
      })
    } else {
      show(null)
    }

    return next(e)
  })

  // The live LCD asks for fresh numbers a few times a second; the answer is its next props.
  on('ui.message', async ($, e, next) => (e.element === 'lcd' ? { props: await tickerProps($) } : next(e)))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const d = await read($, deck)
    const { Box, Button } = $.ui.resolve(e)
    const picker = (
      <Box key="picker" flexDirection="row" flexWrap="wrap" gap={1} marginBottom={1}>
        {CHOICES.map(c => (
          <Button
            key={c.key}
            label={c.label}
            hotkey={c.hotkey}
            variant={d.pick === c.pick ? 'primary' : 'secondary'}
            dimColor={d.pick !== c.pick}
            onPress={() => void choose($, c.pick)}
          />
        ))}
      </Box>
    )

    if (e.surface === 'desktop') {
      const { Svg, Client } = $.ui.resolve(e)
      const size = paneSize(e.props.bodyColumns, e.props.scroll?.bodyRows)
      lastSize = { columns: e.props.bodyColumns, rows: e.props.scroll?.bodyRows ?? null, ...size }
      const frame = frameFor(size.width, size.height)
      return (
        <Box flexDirection="column">
          {picker}
          <Client key="lcd" module="./ticker.tsx" props={await tickerProps($)} height={1} />
          <Svg
            source={deckSvg(d, Date.now(), frame, { lcd: false })}
            alt={`Claudamp: ${d.phase}`}
            width={size.width}
            height={size.height}
            isInteractive={mode === 'frame' ? true : undefined}
          />
        </Box>
      )
    }

    if (e.surface !== 'terminal' && e.surface !== 'mobile') {
      // The editor's webview: no Client there, so the SVG keeps its own LCD.
      const { Svg } = $.ui.resolve(e)
      const size = paneSize(e.props.bodyColumns, e.props.scroll?.bodyRows)
      const frame = frameFor(size.width, size.height)
      return (
        <Box flexDirection="column">
          {picker}
          <Svg source={deckSvg(d, Date.now(), frame)} alt={`Claudamp: ${d.phase}`} width={size.width} height={size.height} isInteractive />
        </Box>
      )
    }

    // A plain-text fallback for the terminal and mobile.
    const { Text } = $.ui.resolve(e)
    const ramp = '▁▂▃▄▅▆▇█'
    const bars = Array.from({ length: Math.max(8, Math.min(40, e.props.bodyColumns - 2)) }, (_, i) => {
      const v = Math.abs(Math.sin(i * 1.7 + d.beat)) * d.energy
      return ramp[Math.min(7, Math.floor(v * 8))]
    }).join('')
    if (d.phase === 'finale' && d.finale) {
      return (
        <Box flexDirection="column">
          {picker}
          <Text color="yellow">✦ {d.finale.title}</Text>
          {d.finale.lines.map(l => (
            <Text dimColor>♪ {l}</Text>
          ))}
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        {picker}
        {d.scene !== 2 && d.scene !== 1 && <Text color="green">{bars}</Text>}
        {d.scene === 2 && <Text bold>{(d.lyric.at(-1) ?? d.phase).toUpperCase()}</Text>}
        {d.scene === 1 && <Text>{d.words.slice(0, 10).map(([w]) => w).join(' · ')}</Text>}
        <Text dimColor>{SCENES[d.scene]?.toLowerCase()} · {d.phase}</Text>
      </Box>
    )
  })
}
