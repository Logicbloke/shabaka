import { describe, expect, it } from 'vitest'
import { dedupeReactions } from '../src/core/reactions'
import type { StoredMessage } from '../src/core/types'

function reaction(author: string, emoji: string, id: string): StoredMessage {
  return { author, content: { target: 'post1', emoji }, id } as unknown as StoredMessage
}

describe('dedupeReactions', () => {
  it('keeps one reaction per author+emoji, first seen wins', () => {
    const out = dedupeReactions([
      reaction('alice', '👍', 'r1'),
      reaction('alice', '👍', 'r2'), // duplicate like from the same author
      reaction('bob', '👍', 'r3'),
    ])
    expect(out.map((r) => r.id)).toEqual(['r1', 'r3'])
  })

  it('treats different emoji from the same author as distinct', () => {
    const out = dedupeReactions([reaction('alice', '👍', 'r1'), reaction('alice', '🔥', 'r2')])
    expect(out).toHaveLength(2)
  })

  it('leaves a clean list untouched', () => {
    const input = [reaction('alice', '👍', 'r1'), reaction('bob', '🔥', 'r2')]
    expect(dedupeReactions(input)).toHaveLength(2)
  })
})
