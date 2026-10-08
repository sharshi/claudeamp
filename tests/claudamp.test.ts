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
