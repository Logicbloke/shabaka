import { describe, expect, it } from 'vitest'
import { generateIdentity, testDb } from './helpers'
import { appendLocal, rebuildDerived } from '../src/core/logstore'
import {
  getFollows,
  getHead,
  getProfile,
  getThread,
  getTimeline,
  getReactions,
} from '../src/core/db'

describe('logstore', () => {
  it('appendLocal builds a dense signed chain', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const m1 = await appendLocal(db, alice, 'post', { text: 'one' }, 1000)
    const m2 = await appendLocal(db, alice, 'post', { text: 'two' }, 2000)
    expect(m1.seq).toBe(1)
    expect(m1.prev).toBeNull()
    expect(m2.seq).toBe(2)
    expect(m2.prev).toBe(m1.id)
    expect((await getHead(db, alice.pub))?.id).toBe(m2.id)
  })

  it('derives follow state, latest message wins', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const bob = generateIdentity()
    await appendLocal(db, alice, 'follow', { target: bob.pub }, 1)
    let follows = await getFollows(db, alice.pub)
    expect(follows).toHaveLength(1)
    expect(follows[0]!.following).toBe(true)

    await appendLocal(db, alice, 'unfollow', { target: bob.pub }, 2)
    follows = await getFollows(db, alice.pub)
    expect(follows[0]!.following).toBe(false)
  })

  it('derives profile state, latest message wins', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    await appendLocal(db, alice, 'profile', { name: 'Alice', bio: 'v1' }, 1)
    await appendLocal(db, alice, 'profile', { name: 'Alicia', bio: 'v2' }, 2)
    const p = await getProfile(db, alice.pub)
    expect(p?.name).toBe('Alicia')
    expect(p?.bio).toBe('v2')
  })

  it('timeline filters by author set, excludes dms/reactions, pages by displayTs', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const bob = generateIdentity()
    const carol = generateIdentity()
    await appendLocal(db, alice, 'post', { text: 'a1' }, 1000)
    await appendLocal(db, bob, 'post', { text: 'b1' }, 2000)
    await appendLocal(db, carol, 'post', { text: 'c1 hidden' }, 2500)
    await appendLocal(db, alice, 'reaction', { target: 'A'.repeat(43), emoji: '👍' }, 3000)
    await appendLocal(db, alice, 'post', { text: 'a2' }, 4000)

    const authors = new Set([alice.pub, bob.pub])
    const page1 = await getTimeline(db, authors, Infinity, 2)
    expect(page1.map((m) => (m.content as { text: string }).text)).toEqual(['a2', 'b1'])

    const page2 = await getTimeline(db, authors, page1[1]!.displayTs, 2)
    expect(page2.map((m) => (m.content as { text: string }).text)).toEqual(['a1'])
  })

  it('indexes threads by root and reactions by target', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const bob = generateIdentity()
    const root = await appendLocal(db, alice, 'post', { text: 'root' }, 1)
    const r1 = await appendLocal(db, bob, 'reply', { text: 're', root: root.id, parent: root.id }, 2)
    await appendLocal(db, alice, 'reply', { text: 're2', root: root.id, parent: r1.id }, 3)
    await appendLocal(db, bob, 'reaction', { target: root.id, emoji: '🔥' }, 4)

    expect(await getThread(db, root.id)).toHaveLength(2)
    const reactions = await getReactions(db, root.id)
    expect(reactions).toHaveLength(1)
    expect(reactions[0]!.type).toBe('reaction')
  })

  it('rebuildDerived reconstructs heads/follows/profiles from messages', async () => {
    const db = await testDb()
    const alice = generateIdentity()
    const bob = generateIdentity()
    await appendLocal(db, alice, 'profile', { name: 'Alice', bio: '' }, 1)
    await appendLocal(db, alice, 'follow', { target: bob.pub }, 2)
    await appendLocal(db, alice, 'post', { text: 'hi' }, 3)
    const headBefore = await getHead(db, alice.pub)

    await db.clear('heads')
    await db.clear('follows')
    await db.clear('profiles')
    await rebuildDerived(db)

    expect(await getHead(db, alice.pub)).toEqual(headBefore)
    expect((await getFollows(db, alice.pub))[0]!.following).toBe(true)
    expect((await getProfile(db, alice.pub))?.name).toBe('Alice')
  })
})
