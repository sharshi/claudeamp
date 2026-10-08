import { writeFileSync, mkdirSync } from 'node:fs'
import { deckSvg } from '../../hooks/scenes.ts'
const out = process.argv[2]!
const frame = { width: Number(process.argv[3] ?? 360), height: Number(process.argv[4] ?? 480) }
const tag = process.argv[5] ?? ''
mkdirSync(out + '/frames', { recursive: true })
const words: any = [['useEffect',60.0,'reply'],['maybe',32.2,'think'],['refreshToken',22.3,'prompt'],['auth',17.2,'prompt'],['session',14.1,'prompt'],['hypothesis',12.0,'think'],['middleware',10.4,'reply'],['expires',9.2,'prompt'],['retry',8.3,'reply'],['race',7.6,'think'],['cookie',6.9,'prompt'],['handler',6.4,'reply'],['jwt',6.0,'reply'],['condition',5.6,'think'],['refactor',5.2,'reply'],['Promise',4.9,'reply'],['cache',4.7,'reply'],['perhaps',4.5,'think'],['headers',4.2,'reply'],['logout',4.0,'prompt'],['config',3.9,'reply'],['likely',3.7,'think'],['tests',3.6,'reply'],['vitest',3.4,'reply'],['router',3.3,'reply'],['suspect',3.2,'think'],['state',3.1,'reply'],['mutex',3.0,'reply'],['queue',2.9,'reply'],['probably',2.8,'think'],['backoff',2.7,'reply'],['lock',2.7,'reply'],['token',2.6,'reply'],['approach',2.5,'think'],['expiry',2.4,'reply'],['fetch',2.4,'reply'],['await',2.3,'reply'],['tradeoff',2.3,'think'],['spec',2.2,'reply'],['mock',2.2,'reply'],['request',2.1,'reply'],['consider',2.1,'think'],['response',2.0,'reply'],['status',2.0,'reply'],['error',2.0,'reply'],['assume',1.9,'think'],['timeout',1.9,'reply'],['interval',1.8,'reply'],['storage',1.8,'reply'],['edge',1.8,'think'],['redirect',1.7,'reply'],['callback',1.7,'reply'],['provider',1.7,'reply'],['instead',1.7,'think'],['context',1.6,'reply'],['reducer',1.6,'reply'],['dispatch',1.6,'reply'],['simpler',1.6,'think'],['selector',1.5,'reply'],['render',1.5,'reply'],['component',1.5,'reply'],['cleaner',1.5,'think'],['props',1.4,'reply'],['layout',1.4,'reply'],['schema',1.4,'reply'],['risk',1.4,'think'],['validate',1.4,'reply'],['parse',1.3,'reply'],['zod',1.3,'reply'],['wonder',1.3,'think'],['types',1.3,'reply'],['interface',1.3,'reply'],['generic',1.3,'reply'],['actually',1.2,'think'],['branch',1.2,'tool'],['commit',1.2,'tool'],['diff',1.2,'tool'],['root',1.2,'think'],['patch',1.2,'tool'],['deploy',1.2,'tool'],['build',1.1,'tool'],['cause',1.1,'think'],['bundle',1.1,'tool'],['vite',1.1,'tool'],['eslint',1.1,'tool'],['prettier',1.1,'tool'],['import',1.1,'reply'],['export',1.1,'reply'],['module',1.1,'reply'],['package',1.0,'tool'],['lockfile',1.0,'tool'],['install',1.0,'tool'],['script',1.0,'tool'],['terminal',1.0,'tool'],['grep',1.0,'tool'],['path',1.0,'tool'],['folder',1.0,'tool'],['yaml',1.0,'tool'],['json',1.0,'tool'],['env',1.0,'tool'],['secret',0.9,'reply'],['bearer',0.9,'reply'],['oauth',0.9,'reply'],['scope',0.9,'reply'],['claims',0.9,'reply'],['issuer',0.9,'reply'],['audience',0.9,'reply'],['signature',0.9,'reply'],['verify',0.9,'reply'],['decode',0.9,'reply'],['encode',0.9,'reply'],['hash',0.9,'reply'],['salt',0.9,'reply'],['nonce',0.8,'reply'],['csrf',0.8,'reply'],['cors',0.8,'reply'],['origin',0.8,'reply'],['domain',0.8,'reply'],['sameSite',0.8,'reply'],['secure',0.8,'reply'],['httpOnly',0.8,'reply'],['maxAge',0.8,'reply'],['userId',0.8,'reply'],['tenant',0.8,'reply'],['role',0.8,'reply'],['permission',0.8,'reply'],['policy',0.8,'reply'],['guard',0.8,'reply']]
const base: any = { phase: 'idle', scene: 0, pick: null, energy: 0, tokensPerSec: 0, bands: [], tool: null, lyric: [], words: [], beat: 1, turnStartedAt: 0, glitch: 0, finale: null }
const fin = { title: 'Ballad of the Expired Token', lines: ['Fixed the token refresh race in auth middleware so retries use the new JWT.', 'Added three vitest cases covering expiry and logout.', 'All 142 tests pass.'], durationMs: 192000, outputTokens: 4210, tools: 9, topWords: ['auth','refreshToken','retry','vitest'], outcome: 'answer', isFresh: true }
// Bursty bands shaped like a real stream (chunks in bursts with gaps), measured as the mod does.
function bandsFor(seed: number, bursty: number): number[] {
  let s = seed
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647
  const sums: number[] = Array(48).fill(0)
  for (let t = 0; t < 48; ) {
    const burst = r() < bursty
    for (let k = 0, len = 1 + Math.floor(r() * 5); k < len && t < 48; k++, t++) sums[t] = burst ? 20 + r() * 120 : r() * 10
  }
  const max = Math.max(...sums)
  return sums.map(v => Math.round(Math.sqrt(v / max) * 100) / 100)
}
const toolBands = Array.from({ length: 48 }, (_, i) => (i === 6 || i === 38 ? 1 : i === 7 || i === 39 ? 0.6 : 0.05))
// [name, seconds, deck]: each segment is one redraw, as the mod would make it.
const segs: [string, number, any][] = [
  ['idle', 1.4, { ...base }],
  ['think', 3, { ...base, phase: 'thinking', energy: 0.6, tokensPerSec: 64, beat: 2, words: words.slice(0,10), bands: bandsFor(99, 0.35) }],
  ['tool', 2.6, { ...base, phase: 'tool', tool: 'Bash', energy: 0.6, tokensPerSec: 9, beat: 4, glitch: 1, bands: toolBands }],
  ['write', 2.6, { ...base, phase: 'writing', energy: 0.9, tokensPerSec: 96, beat: 6, bands: bandsFor(7, 0.6) }],
  ['cloud', 3, { ...base, phase: 'thinking', scene: 1, energy: 0.7, tokensPerSec: 80, beat: 7, words }],
  ['lyrics', 5.6, { ...base, phase: 'writing', scene: 2, energy: 0.85, tokensPerSec: 91, beat: 8,
    lyric: ['so', 'the', 'refresh', 'token', 'expires', 'before', 'retry', 'now', 'every', 'request', 'waits', 'here'] }],
  ['tetris', 9, { ...base, phase: 'writing', scene: 3, energy: 0.8, tokensPerSec: 88, beat: 9, turnStartedAt: 2000, words }],
  ['finale', 4.6, { ...base, phase: 'finale', finale: fin, beat: 10 }],
]
const FPS = 15
const list: string[] = []
let n = 0, clock = 83_000
for (const [name, secs, deck] of segs) {
  const svg = deckSvg(deck, clock, frame)
  const page = out + '/' + tag + 'seg' + n + '.html'
  // Each frame seeks every animation to its exact time: deterministic, unlike virtual time.
  const seek = '<script>addEventListener("load",()=>{const t=Number(location.hash.slice(1));document.getAnimations().forEach(a=>{a.pause();a.currentTime=t})})</script>'
  writeFileSync(page, `<style>body{margin:0;background:#000;overflow:hidden}svg{width:100%;height:100%;display:block}</style><div style="width:${frame.width}px;height:${frame.height}px">` + svg + seek)
  const offset = name === 'tetris' ? 14_000 : 0
  for (let t = 0; t < secs * 1000 - 1; t += 1000 / FPS)
    list.push([tag + String(list.length).padStart(4, '0'), page, Math.round(t + offset) || 1, name, frame.width, frame.height].join(' '))
  clock += secs * 1000; n++
}
writeFileSync(out + '/' + tag + 'frames.txt', list.join('\n') + '\n')
console.log(list.length, 'frames')
