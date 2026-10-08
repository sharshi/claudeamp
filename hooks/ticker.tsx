import type { ClientModule } from 'claude-code'

/** What the hooks module hands the LCD: live numbers, refreshed on every poll. */
export type TickerProps = {
  phase: 'idle' | 'thinking' | 'writing' | 'tool' | 'finale'
  /** The marquee's words. */
  text: string
  /** Estimated tokens per second over the last couple of seconds. */
  tps: number
  /** The last 16 tok/s readings, 0..1, oldest first: the mini VU meter. */
  vu: number[]
  /** When the turn started (ms since epoch), or 0 between turns. */
  startedAt: number
  /** The finished turn's length, shown frozen once it ends. */
  durationMs: number | null
}

type State = { offset: number; now: number; polls: number }

const PHASE_COLOR: Record<TickerProps['phase'], string> = {
  idle: '#64748b',
  thinking: '#c4b5fd',
  writing: '#22d3ee',
  tool: '#fbbf24',
  finale: '#fde68a',
}
const RAMP = '▁▂▃▄▅▆▇█'
const STEP_MS = 125

const clock = (ms: number) => {
  const sec = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

/**
 * A Winamp-style LCD strip that lives in the pane on its own: it scrolls and
 * ticks locally, and polls the hooks module for fresh numbers a few times a
 * second (each answer replaces its props), so it updates without the pane redrawing.
 */
const Ticker: ClientModule<TickerProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    surface.every(STEP_MS, () => {
      const s = surface.state ?? { offset: 0, now: Date.now(), polls: 0 }
      // Ask for new numbers every third step (about 3 times a second).
      if (s.polls % 3 === 0) surface.post({ want: 'stats' })
      surface.setState({ offset: s.offset + 1, now: Date.now(), polls: s.polls + 1 })
    })
  }
  const s = surface.state ?? { offset: 0, now: Date.now(), polls: 0 }

  const isLive = props.phase !== 'idle' && props.phase !== 'finale'
  const time = props.durationMs !== null ? clock(props.durationMs) : props.startedAt ? clock(s.now - props.startedAt) : '--:--'
  const tps = `${String(Math.round(props.tps)).padStart(3, '0')} TOK/S`
  const vu = props.vu.map(v => RAMP[Math.max(0, Math.min(7, Math.round(v * 7)))]).join('')

  // The marquee window: whatever room is left on the row, scrolling one character per step.
  const fixed = 2 + time.length + 2 + tps.length + 2 + vu.length + 2
  const room = Math.max(8, (surface.columns || 60) - fixed)
  const loop = `${props.text}   ★   `
  const start = s.offset % loop.length
  const marquee = (loop + loop + loop).slice(start, start + room).padEnd(room, ' ')

  return (
    <Box flexDirection="row" backgroundColor="#05050a" paddingX={1} gap={2}>
      <Text color={PHASE_COLOR[props.phase]} bold>
        {isLive ? '▶' : props.phase === 'finale' ? '■' : '❚❚'}
      </Text>
      <Text color="#4ade80" wrap="truncate">
        {marquee}
      </Text>
      <Text color={isLive ? '#f87171' : '#4ade80'} bold>
        {time}
      </Text>
      <Text color="#4ade80">{tps}</Text>
      <Text color={PHASE_COLOR[props.phase]}>{vu}</Text>
    </Box>
  )
}

export default Ticker
