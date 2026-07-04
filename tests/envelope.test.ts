import { describe, expect, it } from 'vitest'
import { createEnvelope, msgId, verifyEnvelope } from '../src/core/envelope'
import { generateIdentity } from '../src/core/identity'
import type { Envelope, PostContent } from '../src/core/types'

describe('envelope', () => {
  const alice = generateIdentity()

  it('creates a valid first envelope (seq 1, prev null) that verifies', () => {
    const env = createEnvelope(alice, null, 'post', { text: 'hello' }, 123)
    expect(env.seq).toBe(1)
    expect(env.prev).toBeNull()
    expect(env.author).toBe(alice.pub)
    expect(verifyEnvelope(env)).toBe(true)
  })

  it('chains: second envelope links to the first by msgId', () => {
    const e1 = createEnvelope(alice, null, 'post', { text: 'one' }, 1)
    const e2 = createEnvelope(alice, { seq: 1, id: msgId(e1) }, 'post', { text: 'two' }, 2)
    expect(e2.seq).toBe(2)
    expect(e2.prev).toBe(msgId(e1))
    expect(verifyEnvelope(e2)).toBe(true)
  })

  it('msgId is deterministic and distinct per message', () => {
    const e1 = createEnvelope(alice, null, 'post', { text: 'one' }, 1)
    const e2 = createEnvelope(alice, null, 'post', { text: 'two' }, 1)
    expect(msgId(e1)).toBe(msgId(e1))
    expect(msgId(e1)).not.toBe(msgId(e2))
    expect(msgId(e1)).toHaveLength(43)
  })

  it('rejects tampering with any field', () => {
    const bob = generateIdentity()
    const env = createEnvelope(alice, null, 'post', { text: 'original' }, 123)
    const tampered: Envelope[] = [
      { ...env, author: bob.pub },
      { ...env, seq: 2 },
      { ...env, prev: msgId(env) },
      { ...env, ts: 124 },
      { ...env, type: 'profile' },
      { ...env, content: { text: 'changed' } },
      { ...env, sig: env.sig.slice(0, -2) + (env.sig.endsWith('AA') ? 'BB' : 'AA') },
    ]
    for (const t of tampered) {
      expect(verifyEnvelope(t), JSON.stringify(t).slice(0, 80)).toBe(false)
    }
  })

  it('verification is insensitive to content key order', () => {
    const env = createEnvelope(alice, null, 'reply', {
      text: 'hi',
      root: 'r'.padEnd(43, 'A').slice(0, 43),
      parent: 'p'.padEnd(43, 'A').slice(0, 43),
    })
    const reordered = {
      ...env,
      content: { parent: (env.content as { parent: string }).parent, root: (env.content as { root: string }).root, text: 'hi' as string } as PostContent,
    } as Envelope
    expect(verifyEnvelope(reordered)).toBe(true)
    expect(msgId(reordered)).toBe(msgId(env))
  })
})
