const STOP = new Set(
  (
    `the and that this with from have will would could should there their them they then than what when where which while into onto over under about after before because been being both each just like make made more most much need needs only other some such sure take than that's thats them these those through very want were your yours also back does doing done dont don't here i'll i'm i've it's its let's lets look looks maybe might mine okay right same seem seems something still thing things think know going good well yeah user users file files line lines code first next now already actually again another any anything around because better can't cannot instead into itself many must never often once quite rather really should since there's though thus until upon using used uses whether without within able across along among else ever every few however less least lot often own per same several shall since soon than then thereby therefore these those though toward towards via whose why yet the and for but not you are was can has had got let all any our out its one two way yes did how who why too may own see say per get set put new old few use now his her him she they’re i'd i'll ok`
  ).split(/\s+/),
)

/** Words worth showing: identifiers and content words, not glue. */
export function contentWords(text: string): string[] {
  const out: string[] = []
  for (const raw of text.match(/[A-Za-z_][A-Za-z0-9_\-.]*[A-Za-z0-9]/g) ?? []) {
    const word = raw.replace(/^[-.]+|[-.]+$/g, '')
    if (word.length < 3 || word.length > 24) continue
    if (STOP.has(word.toLowerCase())) continue
    out.push(word)
  }
  return out
}

/** Every word in order, for lyric lines (short glue words included). */
export function lyricWords(text: string): string[] {
  return (text.match(/[A-Za-z0-9_'’.\-]+/g) ?? [])
    .map(w => w.replace(/^[-.']+|[-.']+$/g, ''))
    .filter(w => w.length > 0 && w.length <= 18)
}

/** A weighted tally that forgets slowly: older words fade from the cloud. */
/** Where a word was heard: Claude's thinking, its replies, your prompts, or tool calls and results. */
export type WordSource = 'think' | 'reply' | 'prompt' | 'tool'
const SOURCES: WordSource[] = ['think', 'reply', 'prompt', 'tool']

/** A word, how often it came up, and where it mostly came from. */
export type WordCount = [word: string, n: number, source?: WordSource]

type Entry = { word: string; n: number; by: Record<WordSource, number> }

export class Tally {
  private counts = new Map<string, Entry>()

  /** Counts each word once per mention; `weight` scales a noisy source down (or up). */
  add(words: string[], source: WordSource = 'reply', weight = 1): void {
    for (const word of words) {
      const key = word.toLowerCase()
      let entry = this.counts.get(key)
      if (!entry) {
        entry = { word, n: 0, by: { think: 0, reply: 0, prompt: 0, tool: 0 } }
        this.counts.set(key, entry)
      }
      entry.n += weight
      entry.by[source] += weight
    }
  }

  /** Starts from words kept from earlier sessions. */
  seed(words: unknown[]): void {
    for (const item of words) {
      if (!Array.isArray(item)) continue
      const [word, n, source] = item as [unknown, unknown, unknown]
      if (typeof word !== 'string' || typeof n !== 'number') continue
      const key = word.toLowerCase()
      if (this.counts.has(key)) continue
      // Older saves kept a thinking share (0..1) where the source now goes.
      const from: WordSource =
        typeof source === 'string' && (SOURCES as string[]).includes(source)
          ? (source as WordSource)
          : typeof source === 'number' && source >= 0.5
            ? 'think'
            : 'reply'
      const by = { think: 0, reply: 0, prompt: 0, tool: 0 }
      by[from] = n
      this.counts.set(key, { word, n, by })
    }
  }

  decay(factor: number): void {
    for (const [key, entry] of this.counts) {
      entry.n *= factor
      for (const source of SOURCES) entry.by[source] *= factor
      if (entry.n < 0.35) this.counts.delete(key)
    }
  }

  top(limit: number): WordCount[] {
    return [...this.counts.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, limit)
      .map(e => [e.word, Math.round(e.n * 10) / 10, SOURCES.reduce((best, s) => (e.by[s] > e.by[best] ? s : best), 'reply')])
  }
}

/** Every string inside a tool's input or result (ids and the tool's name left out), up to `max` characters. */
export function stringsIn(value: unknown, max: number): string {
  const out: string[] = []
  let size = 0
  const walk = (v: unknown, key: string, depth: number): void => {
    if (size >= max || depth > 6) return
    if (typeof v === 'string') {
      if (/(^|_)id$|^tool$|^agentId$/i.test(key)) return
      const piece = v.slice(0, max - size)
      out.push(piece)
      size += piece.length
    } else if (Array.isArray(v)) v.forEach(item => walk(item, key, depth + 1))
    else if (v && typeof v === 'object') for (const [k, item] of Object.entries(v)) walk(item, k, depth + 1)
  }
  walk(value, '', 0)
  return out.join(' ')
}
