export type Phase = 'idle' | 'thinking' | 'writing' | 'tool' | 'finale'

export type Finale = {
  title: string
  lines: string[]
  durationMs: number
  outputTokens: number
  tools: number
  topWords: string[]
  outcome: 'answer' | 'aborted' | 'refusal' | 'error'
  /** True on the first draw after the turn ended: plays the flash once. */
  isFresh: boolean
}

export type Deck = {
  phase: Phase
  /** Scene on screen: 0 spectrum, 1 word cloud, 2 lyric video. */
  scene: number
  /** The scene the person pinned, or null to rotate. Kept in $.store too. */
  pick: number | null
  /** 0..1, how hard the stream is pushing right now. */
  energy: number
  tokensPerSec: number
  /**
   * The stream since the last redraw, sliced in time (oldest first): each
   * value 0..1 is that slice's share of the busiest slice. The spectrum's bars.
   */
  bands: number[]
  tool: string | null
  /** Most recent words, for the lyric scene. */
  lyric: string[]
  /** [word, weight, where it mostly came from], heaviest first, for the cloud. */
  words: [word: string, n: number, source?: 'think' | 'reply' | 'prompt' | 'tool'][]
  /** Bumps on every flush; seeds the pseudo-random layout. */
  beat: number
  turnStartedAt: number
  /** Bumps on a failed tool call: the glitch flash. */
  glitch: number
  finale: Finale | null
}

declare module 'claude-code' {
  interface PluginState {
    claudamp: { deck: Deck }
  }
}
