import { describe, expect, it } from 'vitest'
import { generateIdentity, makeChain, makePosts, testDb } from './helpers'
import { receiveEnvelope, schemaError } from '../src/core/validate'
import { createEnvelope, msgId } from '../src/core/envelope'
import { getHead } from '../src/core/db'

describe('schemaError', () => {
  const alice = generateIdentity()
  const valid = createEnvelope(alice, null, 'post', { text: 'hi' }, 1)

  it('accepts a valid envelope', () => {
    expect(schemaError(valid)).toBeNull()
  })

  it('rejects non-objects and wrong key sets', () => {
    expect(schemaError(null)).toBeTruthy()
    expect(schemaError('x')).toBeTruthy()
    expect(schemaError({ ...valid, extra: 1 })).toBeTruthy()
    const { sig: _sig, ...missing } = valid
    expect(schemaError(missing)).toBeTruthy()
  })

  it('rejects bad field values', () => {
    expect(schemaError({ ...valid, v: 2 })).toBe('unknown version')
    expect(schemaError({ ...valid, author: 'short' })).toBe('bad author')
    expect(schemaError({ ...valid, seq: 0 })).toBe('bad seq')
    expect(schemaError({ ...valid, seq: 1.5 })).toBe('bad seq')
    expect(schemaError({ ...valid, prev: 'AAAA' })).toBe('bad prev')
    expect(schemaError({ ...valid, seq: 2 })).toBe('bad prev') // seq 2 requires prev
    expect(schemaError({ ...valid, ts: -1 })).toBe('bad ts')
    expect(schemaError({ ...valid, type: 'exotic' })).toBe('unknown type')
  })

  it('rejects bad content per type', () => {
    expect(schemaError({ ...valid, content: { text: 'x', extra: 1 } })).toBeTruthy()
    expect(schemaError({ ...valid, content: { text: 'x'.repeat(9000) } })).toBeTruthy()
    expect(schemaError({ ...valid, type: 'reaction', content: { target: valid.author } })).toBeTruthy()
    expect(
      schemaError({ ...valid, type: 'reaction', content: { target: valid.author, emoji: '' } }),
    ).toBeTruthy()
  })

  it('rejects oversized envelopes', () => {
    const okReply = {
      ...valid,
      type: 'reply',
      content: { text: 'x'.repeat(8192), root: valid.author, parent: valid.author },
    }
    expect(schemaError(okReply)).toBeNull() // max text alone is fine
    // a near-max dm box passes its field cap but blows the total envelope cap
    const bigDm = {
      ...valid,
      type: 'dm',
      content: { to: valid.author, n: 'A'.repeat(32), box: 'A'.repeat(16350) },
    }
    expect(schemaError(bigDm)).toBe('envelope too large')
  })
})

describe('receiveEnvelope', () => {
  it('accepts an in-order chain and advances the head', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const [e1, e2] = makePosts(alice, ['one', 'two'])
    const r1 = await receiveEnvelope(db, e1!)
    const r2 = await receiveEnvelope(db, e2!)
    expect(r1.status).toBe('accepted')
    expect(r2.status).toBe('accepted')
    const head = await getHead(db, alice.pub)
    expect(head?.seq).toBe(2)
    expect(head?.id).toBe(msgId(e2!))
    expect(head?.forked).toBe(false)
  })

  it('reports duplicates', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const [e1] = makePosts(alice, ['one'])
    await receiveEnvelope(db, e1!)
    expect((await receiveEnvelope(db, e1!)).status).toBe('duplicate')
  })

  it('rejects tampered signatures', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const [e1] = makePosts(alice, ['one'])
    const bad = { ...e1!, content: { text: 'evil' } }
    const r = await receiveEnvelope(db, bad)
    expect(r.status).toBe('invalid')
    expect(r.reason).toBe('bad signature')
    expect(await getHead(db, alice.pub)).toBeUndefined()
  })

  it('buffers out-of-order messages and drains on gap fill', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const [e1, e2, e3] = makePosts(alice, ['one', 'two', 'three'])
    await receiveEnvelope(db, e1!)

    const r3 = await receiveEnvelope(db, e3!)
    expect(r3.status).toBe('pending')
    expect(r3.gap).toEqual({ author: alice.pub, from: 2, to: 2 })
    expect((await getHead(db, alice.pub))?.seq).toBe(1)

    const r2 = await receiveEnvelope(db, e2!)
    expect(r2.status).toBe('accepted')
    expect(r2.accepted.map((m) => m.seq)).toEqual([2, 3]) // e3 drained from pending
    expect((await getHead(db, alice.pub))?.seq).toBe(3)
  })

  it('requests the full prefix when the author is unknown', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const [, e2] = makePosts(alice, ['one', 'two'])
    const r = await receiveEnvelope(db, e2!)
    expect(r.status).toBe('pending')
    expect(r.gap).toEqual({ author: alice.pub, from: 1, to: 1 })
  })

  it('detects equivocation (two messages at one seq) and flags the author', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const [e1, e2] = makePosts(alice, ['one', 'two'])
    await receiveEnvelope(db, e1!)
    await receiveEnvelope(db, e2!)

    // alice re-signs a *different* seq-2 on the same head
    const fork = createEnvelope(alice, { seq: 1, id: msgId(e1!) }, 'post', { text: 'revised' }, 99)
    const r = await receiveEnvelope(db, fork)
    expect(r.status).toBe('forked')
    const head = await getHead(db, alice.pub)
    expect(head?.seq).toBe(2) // keep-first
    expect(head?.id).toBe(msgId(e2!))
    expect(head?.forked).toBe(true)
  })

  it('detects a next-seq message built on the wrong history', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const [e1] = makePosts(alice, ['one'])
    await receiveEnvelope(db, e1!)

    const wrongPrev = createEnvelope(
      alice,
      { seq: 1, id: msgId(createEnvelope(alice, null, 'post', { text: 'ghost' }, 5)) },
      'post',
      { text: 'two' },
      6,
    )
    const r = await receiveEnvelope(db, wrongPrev)
    expect(r.status).toBe('forked')
    expect((await getHead(db, alice.pub))?.forked).toBe(true)
  })

  it('drops pending entries from a forked history instead of ingesting them', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const [e1, e2] = makePosts(alice, ['one', 'two'])

    // a seq-2 built on a different seq-1 lands in pending first
    const [x1, x2] = makePosts(alice, ['other-one', 'other-two'])
    void x1
    const rPending = await receiveEnvelope(db, x2!)
    expect(rPending.status).toBe('pending')

    const r1 = await receiveEnvelope(db, e1!)
    // drain finds pending seq-2 but its prev doesn't match e1's id → dropped
    expect(r1.accepted.map((m) => m.seq)).toEqual([1])
    const r2 = await receiveEnvelope(db, e2!)
    expect(r2.status).toBe('accepted')
    expect((await getHead(db, alice.pub))?.seq).toBe(2)
  })

  it('validates different authors independently', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const bob = generateIdentity()
    const [a1] = makePosts(alice, ['from alice'])
    const [b1] = makePosts(bob, ['from bob'])
    expect((await receiveEnvelope(db, a1!)).status).toBe('accepted')
    expect((await receiveEnvelope(db, b1!)).status).toBe('accepted')
    expect((await getHead(db, alice.pub))?.seq).toBe(1)
    expect((await getHead(db, bob.pub))?.seq).toBe(1)
  })

  it('accepts follows and replies through the full pipeline', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const bob = generateIdentity()
    const chain = makeChain(alice, [
      { type: 'post', content: { text: 'root post' } },
      { type: 'follow', content: { target: bob.pub } },
    ])
    const rootId = msgId(chain[0]!)
    for (const env of chain) {
      expect((await receiveEnvelope(db, env)).status).toBe('accepted')
    }
    const reply = createEnvelope(
      bob,
      null,
      'reply',
      { text: 'nice', root: rootId, parent: rootId },
      50,
    )
    expect((await receiveEnvelope(db, reply)).status).toBe('accepted')
  })
})
