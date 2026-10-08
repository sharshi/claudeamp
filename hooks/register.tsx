import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Deck, Finale, Phase } from '../types'
import { deckSvg, frameFor, SCENES } from './scenes'
import { contentWords, lyricWords, stringsIn, Tally } from './words'
import type { WordSource } from './words'

const PANE = 'claudamp'
const SCENE_MS = 12_000
/**
 * Every state write redraws the pane, and the desktop reloads an Svg whole
 * (a visible blink), so redraws are rare: the CSS inside the SVG carries the
 * motion between them.
 */
const MIN_GAP = 5_000
/** Wordclaude draws every word it has room for; this only bounds the redraw's size. */
const WORD_LIMIT = 160
const LYRIC_GAP = 6_000

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

function feed(text: string, isThinking: boolean): void {
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
  const lyric = lyricFresh ? lyricBuf.slice(-12) : undefined
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
  const room = rows === undefined ? width * 1.4 : rows * CELL.height - pickerRows * 44 - 16
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
      description: 'Open the Claudamp visualizer (args: next = next scene, stats = words heard, size = pane size)',
    })
    const stored = await $.store.get(STORE_PICK)
    pick = typeof stored === 'number' && stored >= 0 && stored < SCENES.length ? stored : null
    scene = pick ?? 0
    const kept = await $.store.get(STORE_WORDS)
    if (Array.isArray(kept)) tally.seed(kept)
    await update($, deck, (d): Deck => ({ ...d, pick, scene, words: tally.top(WORD_LIMIT) }))
    void $.ui.open({ id: PANE, title: 'Claudamp' })
    $.clock.every(450, () => void flush($))

    return next(e)
  })

  on('command.run', { command: 'claudamp' }, async ($, e) => {
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
    tally.decay(0.5)
    hear(e.text, 'prompt', 1.5)
    lyricBuf = []
    turn = { tools: 0, outputTokens: 0 }
    turnId = e.turnId
    live = { phase: 'thinking', tool: null }
    scene = pick ?? 0
    sceneSince = Date.now()
    await flush($, { turnStartedAt: Date.now() })

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
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
    turn.tools += 1
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
    if (e.agentId !== undefined) return next(e)

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

    if (e.surface !== 'terminal' && e.surface !== 'mobile') {
      const { Svg } = $.ui.resolve(e)
      const size = paneSize(e.props.bodyColumns, e.props.scroll?.bodyRows)
      lastSize = { columns: e.props.bodyColumns, rows: e.props.scroll?.bodyRows ?? null, ...size }
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
