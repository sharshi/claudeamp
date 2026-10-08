import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { deckSvg } from '../hooks/scenes'
import { contentWords, Tally } from '../hooks/words'
import type { Deck } from '../types'

async function drawn($: Engine): Promise<string> {
  const tree = await $.ui.render({
    component: 'Pane',
    surface: 'desktop',
    requestId: 'claudamp',
    props: { title: 'Claudamp', isFocused: false, bodyColumns: 48, placement: 'dock' } as never,
  })
  return JSON.stringify(tree)
}

test('a turn goes thinking, then ends in a fresh finale with the answer summed up', async ($, on) => {
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  // The summary model declines, so the fallback lines show.
  const clock = mock.clock(on)
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'empty-reply' } }) as never)

  await $.turn.start({ text: 'fix the auth bug', turnId: 't1' })
  expect(await drawn($)).toContain('THINKING')

  await $.turn.complete({
    turnId: 't1',
    reason: 'answer',
    answer: 'I fixed the token refresh in auth.ts. The tests pass now.',
    durationMs: 72_000,
    isAborted: false,
  })
  // Nothing redraws until the notes answer or 4 s pass: one blink, not two.
  expect(await drawn($)).not.toContain('TRACK COMPLETE')
  await clock.advance(4100)
  const svg = await drawn($)
  expect(svg).toContain('TRACK COMPLETE')
  expect(svg).toContain('animation:flash')
  expect(svg).toContain('I fixed the token refresh in auth.ts.')
})

const base: Deck = {
  phase: 'writing',
  scene: 0,
  pick: null,
  energy: 0.7,
  tokensPerSec: 80,
  bands: [0.2, 1, 0.4, 0, 0.7],
  tool: null,
  lyric: ['refactor', 'the', 'session', 'store', '<now>'],
  words: [['useEffect', 6], ['auth', 4], ['token', 3], ['refresh', 2], ['session', 2]],
  beat: 4,
  turnStartedAt: 0,
  glitch: 0,
  finale: null,
}

test('every scene draws a well-formed, escaped svg', () => {
  for (const scene of [0, 1, 2]) {
    const svg = deckSvg({ ...base, scene }, 65_000)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.includes('<now>')).toBe(false)
    expect(svg.length < 131_072).toBe(true)
  }
  const fin = deckSvg(
    {
      ...base,
      phase: 'finale',
      finale: {
        title: 'Ballad of the Refresh Token',
        lines: ['Fixed token refresh in auth.ts'],
        durationMs: 72_000,
        outputTokens: 4200,
        tools: 7,
        topWords: ['auth', 'token'],
        outcome: 'answer',
        isFresh: true,
      },
    },
    0,
  )
  expect(fin.includes('TRACK COMPLETE')).toBe(true)
  expect(fin.includes('animation:flash')).toBe(true)
})

type Node = { type?: string; props?: { key?: string; variant?: string }; children?: Node[] }

function primaryKey(node: Node | undefined): string | undefined {
  if (!node) return undefined
  if (node.type === 'Button' && node.props?.variant === 'primary') return node.props.key
  for (const child of node.children ?? []) {
    const found = primaryKey(child)
    if (found) return found
  }
  return undefined
}

async function picked($: Engine): Promise<string | undefined> {
  const tree = await $.ui.render({
    component: 'Pane',
    surface: 'desktop',
    requestId: 'claudamp',
    props: { title: 'Claudamp', isFocused: false, bodyColumns: 48, placement: 'dock' } as never,
  })
  return primaryKey(tree as Node)
}

test('clicking a scene pins it, and auto un-pins it', async ($, on) => {
  mock.store(on)
  expect(await picked($)).toBe('auto')

  await $.ui.press({ plugin: 'claudamp', key: 'lyrics' })
  expect(await picked($)).toBe('lyrics')

  await $.ui.press({ plugin: 'claudamp', key: 'auto' })
  expect(await picked($)).toBe('auto')
})

test('the pinned scene comes back in a new session', async ($, on) => {
  mock.store(on, { pick: 1 })
  mock.clock(on)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: {} }) as never)
  on('session.start', ($, e) => e as never)

  await $.session.start({ cwd: '/tmp', source: 'startup' } as never)
  expect(await picked($)).toBe('cloud')
})

test('every tetris game fits the desktop svg limit, at any pane shape', () => {
  const words = 'useEffect refreshToken auth session middleware expires retry cookie'.split(' ').map((w, i): [string, number] => [w, 9 - i])
  for (const frame of [{ width: 360, height: 480 }, { width: 360, height: 1080 }, { width: 1200, height: 480 }])
    for (const turnStartedAt of [1000, 2000, 3000, 4000, 5000]) {
      const svg = deckSvg({ ...base, scene: 3, words, turnStartedAt }, turnStartedAt, frame)
      expect(svg.length < 131_072).toBe(true)
      expect(svg.includes('GAME OVER')).toBe(true)
    }
})

test('words from thinking, replies, prompts and tools all count, and remember their source', () => {
  const tally = new Tally()
  tally.add(contentWords('Maybe the api retry loop needs a mutex; the api is flaky.'), 'think')
  tally.add(contentWords('Added a mutex around the retry.'), 'reply')
  tally.add(contentWords('please fix the flaky retry'), 'prompt', 1.5)
  tally.add(contentWords('npm test --grep retry'), 'tool')
  const top = Object.fromEntries(tally.top(20).map(([w, n, source]) => [w.toLowerCase(), { n, source }]))
  expect(top['api']).toEqual({ n: 2, source: 'think' })
  expect(top['flaky']).toEqual({ n: 2.5, source: 'prompt' })
  expect(top['npm']).toEqual({ n: 1, source: 'tool' })
  expect(top['retry']?.n).toBe(4.5)
  expect(top['the']).toBe(undefined)
})

test('side requests between turns do not replay old content over the finale', { timeoutMs: 15_000 }, async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'empty-reply' } }) as never)
  on('turn.step', async function* () {
    yield { kind: 'text', index: 0, text: 'recycled words from the previous answer' } as never
    return { turnId: 'side', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as never
  })
  // A real session, so the redraw ticker runs.
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: {} }) as never)
  on('session.start', ($, e) => e as never)
  await $.session.start({ cwd: '/tmp', source: 'startup' } as never)

  await $.turn.start({ text: 'fix the auth bug', turnId: 't1' })
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'Fixed the auth bug.', durationMs: 5000, isAborted: false })
  await clock.advance(4100)
  expect(await drawn($)).toContain('TRACK COMPLETE')

  // A prompt suggestion (its own turn id) streams after the turn ended.
  const side = $.turn.step({ turnId: 'side', index: 0, model: 'haiku', messageCount: 3 } as never)
  for await (const _ of side) {
    // drain
  }
  // Redraw gaps are timed on the wall clock; let one pass, then let the ticker fire.
  await new Promise(resolve => setTimeout(resolve, 3200))
  await clock.advance(1000)
  const after = await drawn($)
  expect(after).toContain('TRACK COMPLETE')
  expect(after).not.toContain('RECYCLED')
})

test('the live LCD polls for fresh numbers mid-turn: live tok/s and the current tool', async ($, on) => {
  mock.store(on)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* () {
    yield { kind: 'text', index: 0, text: 'x'.repeat(800) } as never
    return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as never
  })
  // The tool runs until the test lets it finish, so the LCD can be read mid-call.
  let finish = () => {}
  on('tool.call', () => new Promise(resolve => (finish = () => resolve({ result: { stdout: 'ok' } } as never))))

  await $.turn.start({ text: 'run the tests', turnId: 't1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'opus', messageCount: 1 } as never)) {
    // drain
  }
  const ui = await $.ui.mount({
    plugin: 'claudamp',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'claudamp',
    props: { title: 'Claudamp', isFocused: false, bodyColumns: 80, placement: 'dock' } as never,
  })
  // What the LCD (the Client module itself) draws after it polls.
  const lcd = async () => {
    await ui.post({ want: 'stats' }, { in: 'lcd' })
    return JSON.stringify(await ui.drawn({ in: 'lcd' }))
  }

  const writing = await lcd()
  expect(writing).toContain('WRITING')
  expect(/"(\d{3}) TOK\/S"/.exec(writing)?.[1]).not.toBe('000')

  const running = $.tool.call({ tool: 'Bash', command: 'npm test -- --watch=false' } as never)
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(await lcd()).toContain('▶ Bash npm test')
  finish()
  await running
})
