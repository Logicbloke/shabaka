import { describe, expect, it } from 'vitest'
import { receiveEnvelope } from '../src/core/validate'
import { getNotifications, notificationForMessage } from '../src/core/notifications'
import { getMessage } from '../src/core/db'
import { msgId } from '../src/core/envelope'
import { generateIdentity, makeChain, testDb } from './helpers'
import type { Envelope } from '../src/core/types'

async function ingest(db: Awaited<ReturnType<typeof testDb>>, envs: Envelope[]): Promise<void> {
  for (const e of envs) await receiveEnvelope(db, e)
}

describe('getNotifications', () => {
  it('surfaces likes and replies to my posts, newest first, ignoring others', async () => {
    const db = await testDb()
    const me = generateIdentity()
    const alice = generateIdentity()
    const bob = generateIdentity()

    const mine = makeChain(me, [{ type: 'post', content: { text: 'my post' } }])
    await ingest(db, mine)
    const myPostId = msgId(mine[0])

    const aliceChain = makeChain(alice, [
      { type: 'post', content: { text: 'unrelated' } },
      { type: 'reaction', content: { target: myPostId, emoji: '👍' } },
      { type: 'reply', content: { text: 'nice one', root: myPostId, parent: myPostId } },
    ])
    await ingest(db, aliceChain)
    const alicePostId = msgId(aliceChain[0])

    // Bob reacts to alice's post, not mine — must not show up for me.
    const bobChain = makeChain(bob, [
      { type: 'reaction', content: { target: alicePostId, emoji: '🔥' } },
    ])
    await ingest(db, bobChain)

    const notifs = await getNotifications(db, me.pub, 50)
    expect(notifs).toHaveLength(2)
    // Newest first: the reply was appended after the like.
    expect(notifs[0].kind).toBe('reply')
    expect(notifs[0].actor).toBe(alice.pub)
    expect(notifs[0].replyText).toBe('nice one')
    expect(notifs[0].targetText).toBe('my post')
    expect(notifs[0].rootId).toBe(myPostId)

    expect(notifs[1].kind).toBe('like')
    expect(notifs[1].emoji).toBe('👍')
    expect(notifs[1].targetText).toBe('my post')
  })

  it('does not notify me about my own likes or replies', async () => {
    const db = await testDb()
    const me = generateIdentity()

    // The post envelope is identical whether or not later items follow, so its
    // id is stable — use it to point my own reaction at my own post.
    const myPostId = msgId(makeChain(me, [{ type: 'post', content: { text: 'a' } }])[0])
    const mine = makeChain(me, [
      { type: 'post', content: { text: 'a' } },
      { type: 'reaction', content: { target: myPostId, emoji: '👍' } },
    ])
    await ingest(db, mine)

    expect(await getNotifications(db, me.pub, 50)).toHaveLength(0)
  })
})

describe('notificationForMessage', () => {
  it('classifies a live like on my post and ignores unrelated messages', async () => {
    const db = await testDb()
    const me = generateIdentity()
    const alice = generateIdentity()

    const mine = makeChain(me, [{ type: 'post', content: { text: 'hi there' } }])
    await ingest(db, mine)
    const myPostId = msgId(mine[0])

    const aliceChain = makeChain(alice, [
      { type: 'post', content: { text: 'alice post' } },
      { type: 'reaction', content: { target: myPostId, emoji: '👍' } },
    ])
    await ingest(db, aliceChain)

    const likeMsg = (await getMessage(db, msgId(aliceChain[1])))!
    const n = await notificationForMessage(db, me.pub, likeMsg)
    expect(n?.kind).toBe('like')
    expect(n?.actor).toBe(alice.pub)
    expect(n?.targetText).toBe('hi there')

    // A reaction to alice's own post is not a notification for me.
    const alicePost = (await getMessage(db, msgId(aliceChain[0])))!
    expect(await notificationForMessage(db, me.pub, alicePost)).toBeNull()
  })
})
