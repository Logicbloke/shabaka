import { describe, expect, it } from 'vitest'
import { receiveEnvelope } from '../src/core/validate'
import { countUnread, ZERO_CURSORS } from '../src/core/unread'
import { msgId } from '../src/core/envelope'
import { sealDm } from '../src/core/dm'
import { generateIdentity, makeChain, testDb } from './helpers'
import type { Envelope } from '../src/core/types'

async function ingest(db: Awaited<ReturnType<typeof testDb>>, envs: Envelope[]): Promise<void> {
  for (const e of envs) await receiveEnvelope(db, e)
}

describe('countUnread', () => {
  it('counts unread DMs to me, replies to my posts, and feed posts from follows', async () => {
    const db = await testDb()
    const me = generateIdentity()
    const alice = generateIdentity() // followed
    const bob = generateIdentity() // not followed

    // Me: a post (so replies to it are "replies to me") + follow alice.
    const mine = makeChain(me, [
      { type: 'post', content: { text: 'hello' } },
      { type: 'follow', content: { target: alice.pub } },
    ])
    await ingest(db, mine)
    const myPostId = msgId(mine[0])

    // Alice (followed): a post (feed) + a reply to my post (reply-to-me).
    const aliceChain = makeChain(alice, [
      { type: 'post', content: { text: 'from alice' } },
      { type: 'reply', content: { text: 'nice', root: myPostId, parent: myPostId } },
      { type: 'dm', content: sealDm(alice, me.pub, 'secret') },
    ])
    await ingest(db, aliceChain)

    // Bob (not followed): a post (should NOT count — not followed) + a DM to me.
    const bobChain = makeChain(bob, [
      { type: 'post', content: { text: 'from bob' } },
      { type: 'dm', content: sealDm(bob, me.pub, 'hi') },
    ])
    await ingest(db, bobChain)

    const counts = await countUnread(db, me.pub, ZERO_CURSORS)
    expect(counts.feed).toBe(1) // alice's post; bob's post excluded (not followed)
    expect(counts.replies).toBe(1) // alice's reply to my post
    expect(counts.dms).toBe(2) // alice + bob DMs to me
    expect(counts.total).toBe(4)
  })

  it('ignores my own messages', async () => {
    const db = await testDb()
    const me = generateIdentity()
    const mine = makeChain(me, [
      { type: 'post', content: { text: 'a' } },
      { type: 'post', content: { text: 'b' } },
      { type: 'dm', content: sealDm(me, me.pub, 'note to self') },
    ])
    await ingest(db, mine)
    const counts = await countUnread(db, me.pub, ZERO_CURSORS)
    expect(counts.total).toBe(0)
  })

  it('excludes messages at or below a category cursor', async () => {
    const db = await testDb()
    const me = generateIdentity()
    const alice = generateIdentity()

    const mine = makeChain(me, [{ type: 'follow', content: { target: alice.pub } }])
    await ingest(db, mine)

    // makeChain stamps ts 1000, 1001, ...; displayTs = min(ts, receivedAt) = ts.
    const aliceChain = makeChain(alice, [
      { type: 'post', content: { text: 'old' } }, // ts 1000
      { type: 'post', content: { text: 'new' } }, // ts 1001
    ])
    await ingest(db, aliceChain)

    // Cursor at the first post's displayTs marks it read; only the newer counts.
    const counts = await countUnread(db, me.pub, { ...ZERO_CURSORS, feed: 1000 })
    expect(counts.feed).toBe(1)
    expect(counts.total).toBe(1)
  })
})
