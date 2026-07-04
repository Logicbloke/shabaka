import { describe, expect, it } from 'vitest'
import { generateIdentity, makePosts, testDb } from './helpers'
import { SyncManager, type PeerChannel, type SyncAction } from '../src/core/sync'
import { appendLocal } from '../src/core/logstore'
import { receiveEnvelope } from '../src/core/validate'
import { getAuthorMessages, getHead, type ShabakaDb } from '../src/core/db'
import type { Identity, StoredMessage } from '../src/core/types'

/** Deterministic in-memory network: sends are queued and drained explicitly. */
class TestNet {
  private queue: Array<() => Promise<void>> = []

  async flush(): Promise<void> {
    while (this.queue.length > 0) await this.queue.shift()!()
  }

  connect(a: SyncManager, aName: string, b: SyncManager, bName: string): [string, string] {
    const keyOfBAtA = `${aName}->${bName}`
    const keyOfAAtB = `${bName}->${aName}`
    const chAtA: PeerChannel = {
      peerKey: keyOfBAtA,
      send: (action: SyncAction, payload: unknown) => {
        const copy = JSON.parse(JSON.stringify(payload)) as unknown
        this.queue.push(() => b.onMessage(chAtB, action, copy))
      },
    }
    const chAtB: PeerChannel = {
      peerKey: keyOfAAtB,
      send: (action: SyncAction, payload: unknown) => {
        const copy = JSON.parse(JSON.stringify(payload)) as unknown
        this.queue.push(() => a.onMessage(chAtA, action, copy))
      },
    }
    this.queue.push(() => a.onPeerJoin(chAtA))
    this.queue.push(() => b.onPeerJoin(chAtB))
    return [keyOfBAtA, keyOfAAtB]
  }
}

interface Node {
  db: ShabakaDb
  identity: Identity
  sync: SyncManager
  ingested: StoredMessage[]
  badPeers: string[]
}

async function makeNode(follows: Identity[] = [], session?: string): Promise<Node> {
  const db = await testDb()
  const identity = generateIdentity()
  const ingested: StoredMessage[] = []
  const badPeers: string[] = []
  const sync = new SyncManager(
    db,
    identity.pub,
    { onIngested: (m) => ingested.push(...m), onBadPeer: (k) => badPeers.push(k) },
    session,
  )
  for (const f of follows) {
    await appendLocal(db, identity, 'follow', { target: f.pub })
  }
  return { db, identity, sync, ingested, badPeers }
}

async function post(node: Node, text: string): Promise<StoredMessage> {
  const msg = await appendLocal(node.db, node.identity, 'post', { text })
  node.sync.push([msg]) // what the network glue does on local-append
  return msg
}

describe('sync protocol', () => {
  it('initial have/want/msgs sync transfers a followed log', async () => {
    const net = new TestNet()
    const alice = await makeNode()
    await post(alice, 'one')
    await post(alice, 'two')
    await post(alice, 'three')

    const bob = await makeNode([alice.identity])
    net.connect(alice.sync, 'alice', bob.sync, 'bob')
    await net.flush()

    const got = await getAuthorMessages(bob.db, alice.identity.pub)
    expect(got.map((m) => (m.content as { text: string }).text)).toEqual([
      'one',
      'two',
      'three',
    ])
    expect(bob.ingested).toHaveLength(3)
    // alice does not follow bob, so nothing flowed the other way
    expect((await getHead(alice.db, bob.identity.pub))?.seq).toBeUndefined()
  })

  it('live push propagates new posts to connected followers', async () => {
    const net = new TestNet()
    const alice = await makeNode()
    const bob = await makeNode([alice.identity])
    net.connect(alice.sync, 'alice', bob.sync, 'bob')
    await net.flush()

    await post(alice, 'breaking news')
    await net.flush()

    const got = await getAuthorMessages(bob.db, alice.identity.pub)
    expect(got).toHaveLength(1)
    expect((got[0]!.content as { text: string }).text).toBe('breaking news')
  })

  it('store-and-forward: Bob relays offline Alice to Carol', async () => {
    const net = new TestNet()
    const alice = await makeNode()
    const bob = await makeNode([alice.identity])
    const carol = await makeNode([alice.identity])

    // Alice and Bob are online together
    const [bobAtAlice, aliceAtBob] = net.connect(alice.sync, 'alice', bob.sync, 'bob')
    await net.flush()
    await post(alice, 'p1')
    await post(alice, 'p2')
    await net.flush()

    // Alice goes offline
    alice.sync.onPeerLeave(bobAtAlice)
    bob.sync.onPeerLeave(aliceAtBob)

    // Carol connects to Bob only — Bob offers Alice's log because he follows her
    net.connect(bob.sync, 'bob', carol.sync, 'carol')
    await net.flush()

    const got = await getAuthorMessages(carol.db, alice.identity.pub)
    expect(got.map((m) => (m.content as { text: string }).text)).toEqual(['p1', 'p2'])
    expect((await getHead(carol.db, alice.identity.pub))?.seq).toBe(2)
  })

  it('does not relay logs of authors the peer is not interested in', async () => {
    const net = new TestNet()
    const alice = await makeNode()
    const bob = await makeNode([alice.identity])
    const dave = await makeNode() // follows nobody

    net.connect(alice.sync, 'alice', bob.sync, 'bob')
    await net.flush()
    await post(alice, 'p1')
    await net.flush()

    net.connect(bob.sync, 'bob', dave.sync, 'dave')
    await net.flush()

    expect(await getHead(dave.db, alice.identity.pub)).toBeUndefined()
  })

  it('requests and heals gaps created by push of a too-new message', async () => {
    const net = new TestNet()
    const alice = await makeNode()
    for (const t of ['1', '2', '3', '4', '5']) await post(alice, t)

    const bob = await makeNode([alice.identity])
    // bob already has 1-2 from a past session
    const all = await getAuthorMessages(alice.db, alice.identity.pub)
    await receiveEnvelope(bob.db, all[0]!)
    await receiveEnvelope(bob.db, all[1]!)

    net.connect(alice.sync, 'alice', bob.sync, 'bob')
    await net.flush()

    expect((await getHead(bob.db, alice.identity.pub))?.seq).toBe(5)
  })

  it('gap request goes out when a push skips ahead', async () => {
    const alice = generateIdentity()
    const envs = makePosts(alice, ['1', '2', '3', '4', '5'])
    const bob = await makeNode()
    await appendLocal(bob.db, bob.identity, 'follow', { target: alice.pub })
    await receiveEnvelope(bob.db, envs[0]!)
    await receiveEnvelope(bob.db, envs[1]!)

    const sent: Array<{ action: SyncAction; payload: unknown }> = []
    const mock: PeerChannel = {
      peerKey: 'mock',
      send: (action, payload) => sent.push({ action, payload }),
    }
    await bob.sync.onPeerJoin(mock)
    await bob.sync.onMessage(mock, 'msgs', { batch: [envs[4]] })

    const want = sent.find((s) => s.action === 'want')
    expect(want?.payload).toEqual({ [alice.pub]: { from: 3, to: 4 } })
    // seq 5 is parked in pending, head unchanged
    expect((await getHead(bob.db, alice.pub))?.seq).toBe(2)
  })

  it('disconnects peers that send repeated invalid messages', async () => {
    const bob = await makeNode()
    const sent: unknown[] = []
    const mock: PeerChannel = { peerKey: 'evil', send: (a, p) => sent.push([a, p]) }
    await bob.sync.onPeerJoin(mock)

    const alice = generateIdentity()
    const [good] = makePosts(alice, ['x'])
    for (let i = 0; i < 12; i++) {
      // valid schema, broken signature
      await bob.sync.onMessage(mock, 'msgs', {
        batch: [{ ...good!, ts: good!.ts + i + 1 }],
      })
    }
    expect(bob.badPeers).toEqual(['evil'])
    // manager dropped the peer: further messages are ignored
    expect(bob.sync.peerCount()).toBe(0)
  })

  it('suppresses duplicate pushes to one client seen on two transports', async () => {
    const alice = await makeNode()
    const sentA: unknown[] = []
    const sentB: unknown[] = []
    const chNostr: PeerChannel = { peerKey: 'nostr:bob', send: (a, p) => sentA.push([a, p]) }
    const chMqtt: PeerChannel = { peerKey: 'mqtt:bob', send: (a, p) => sentB.push([a, p]) }
    await alice.sync.onPeerJoin(chNostr)
    await alice.sync.onPeerJoin(chMqtt)
    // both channels carry the same remote session nonce
    const hello = { proto: 1, session: 'bob-session', interest: [alice.identity.pub] }
    await alice.sync.onMessage(chNostr, 'hello', hello)
    await alice.sync.onMessage(chMqtt, 'hello', hello)

    sentA.length = 0
    sentB.length = 0
    const msg = await appendLocal(alice.db, alice.identity, 'post', { text: 'once only' })
    alice.sync.push([msg])

    const msgsSends = [...sentA, ...sentB].filter(
      (s) => (s as [SyncAction, unknown])[0] === 'msgs',
    )
    expect(msgsSends).toHaveLength(1)
  })

  it('interest updates after follow propagate via refreshed hello', async () => {
    const net = new TestNet()
    const alice = await makeNode()
    await post(alice, 'old post')
    const bob = await makeNode() // not following alice yet

    net.connect(alice.sync, 'alice', bob.sync, 'bob')
    await net.flush()
    expect(await getHead(bob.db, alice.identity.pub)).toBeUndefined()

    // bob follows alice mid-session (what the UI glue does)
    await appendLocal(bob.db, bob.identity, 'follow', { target: alice.identity.pub })
    await bob.sync.refreshInterest()
    await net.flush()

    expect((await getHead(bob.db, alice.identity.pub))?.seq).toBe(1)
  })
})
