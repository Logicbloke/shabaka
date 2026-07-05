import { randomBytes } from '@noble/hashes/utils.js'
import { toB64url } from './b64'
import {
  getAllHeads,
  getByAuthorRange,
  getFollows,
  getHead,
  type ShabakaDb,
} from './db'
import { receiveEnvelope } from './validate'
import type { Envelope, StoredMessage } from './types'

export type SyncAction = 'hello' | 'have' | 'want' | 'msgs'

/** What sync.ts sees of a transport — trivially mockable in tests. */
export interface PeerChannel {
  peerKey: string
  send(action: SyncAction, payload: unknown): void
}

export const BATCH_SIZE = 50
const MAX_RANGE = 1000
const MAX_INTEREST = 1000
const MAX_BAD_MESSAGES = 10

export function toWireEnvelope(m: Envelope): Envelope {
  const { v, author, seq, prev, ts, type, content, sig } = m
  return { v, author, seq, prev, ts, type, content, sig }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

interface PeerState {
  ch: PeerChannel
  /** remote session nonce — the same human on two transports shares one */
  session: string | null
  interest: Set<string>
  badCount: number
}

export interface SyncCallbacks {
  onIngested(msgs: StoredMessage[]): void
  /** peer exceeded the bad-message budget */
  onBadPeer?(peerKey: string): void
}

/**
 * SSB-style gossip: hello (interest) → have (heads) → want (ranges) → msgs.
 * Offer set = own log + followed logs, which IS store-and-forward: Bob
 * follows Alice, so Bob offers Alice's log to Carol while Alice is offline.
 */
export class SyncManager {
  readonly session: string
  private peers = new Map<string, PeerState>()

  constructor(
    private db: ShabakaDb,
    private selfPub: string,
    private cb: SyncCallbacks,
    session?: string,
  ) {
    this.session = session ?? toB64url(randomBytes(16))
  }

  /** v1: interest and offer are the same set — self + everyone followed. */
  private async followedSet(): Promise<Set<string>> {
    const follows = await getFollows(this.db, this.selfPub)
    const set = new Set(follows.filter((f) => f.following).map((f) => f.target))
    set.add(this.selfPub)
    return set
  }

  async onPeerJoin(ch: PeerChannel): Promise<void> {
    this.peers.set(ch.peerKey, { ch, session: null, interest: new Set(), badCount: 0 })
    await this.sendHello(ch)
  }

  onPeerLeave(peerKey: string): void {
    this.peers.delete(peerKey)
  }

  private async sendHello(ch: PeerChannel): Promise<void> {
    ch.send('hello', {
      proto: 1,
      session: this.session,
      interest: [...(await this.followedSet())],
    })
  }

  /** Call after a local follow/unfollow so peers learn the new interest set. */
  async refreshInterest(): Promise<void> {
    for (const peer of this.peers.values()) await this.sendHello(peer.ch)
  }

  /** Periodic anti-entropy: re-offer heads to everyone. */
  async resyncAll(): Promise<void> {
    for (const peer of this.peers.values()) await this.sendHave(peer)
  }

  async onMessage(ch: PeerChannel, action: SyncAction, payload: unknown): Promise<void> {
    const peer = this.peers.get(ch.peerKey)
    if (!peer) return
    switch (action) {
      case 'hello':
        return this.handleHello(peer, payload)
      case 'have':
        return this.handleHave(peer, payload)
      case 'want':
        return this.handleWant(peer, payload)
      case 'msgs':
        return this.handleMsgs(peer, payload)
    }
  }

  private async handleHello(peer: PeerState, p: unknown): Promise<void> {
    if (!isObj(p) || typeof p.session !== 'string' || !Array.isArray(p.interest)) return
    peer.session = p.session.slice(0, 64)
    peer.interest = new Set(
      p.interest
        .filter((x): x is string => typeof x === 'string' && x.length === 43)
        .slice(0, MAX_INTEREST),
    )
    await this.sendHave(peer)
  }

  private async sendHave(peer: PeerState): Promise<void> {
    const offer = await this.followedSet()
    const heads = await getAllHeads(this.db)
    const have: Record<string, number> = {}
    for (const h of heads) {
      if (offer.has(h.author) && peer.interest.has(h.author)) have[h.author] = h.seq
    }
    if (Object.keys(have).length > 0) peer.ch.send('have', have)
  }

  private async handleHave(peer: PeerState, p: unknown): Promise<void> {
    if (!isObj(p)) return
    const mine = await this.followedSet()
    const want: Record<string, { from: number; to: number }> = {}
    for (const [author, seq] of Object.entries(p).slice(0, MAX_INTEREST)) {
      if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 1) continue
      if (!mine.has(author)) continue
      const head = await getHead(this.db, author)
      const from = (head?.seq ?? 0) + 1
      if (seq >= from) want[author] = { from, to: seq }
    }
    if (Object.keys(want).length > 0) peer.ch.send('want', want)
  }

  private async handleWant(peer: PeerState, p: unknown): Promise<void> {
    if (!isObj(p)) return
    const offer = await this.followedSet()
    for (const [author, range] of Object.entries(p).slice(0, MAX_INTEREST)) {
      if (!offer.has(author) || !isObj(range)) continue
      const { from, to } = range as { from: unknown; to: unknown }
      if (
        typeof from !== 'number' ||
        typeof to !== 'number' ||
        !Number.isSafeInteger(from) ||
        !Number.isSafeInteger(to) ||
        from < 1 ||
        to < from
      )
        continue
      const clampedTo = Math.min(to, from + MAX_RANGE - 1)
      const msgs = await getByAuthorRange(this.db, author, from, clampedTo)
      for (let i = 0; i < msgs.length; i += BATCH_SIZE) {
        peer.ch.send('msgs', {
          batch: msgs.slice(i, i + BATCH_SIZE).map(toWireEnvelope),
        })
      }
    }
  }

  private async handleMsgs(peer: PeerState, p: unknown): Promise<void> {
    if (!isObj(p) || !Array.isArray(p.batch) || p.batch.length > BATCH_SIZE * 2) return
    const accepted: StoredMessage[] = []
    const gaps = new Map<string, { from: number; to: number }>()

    for (const env of p.batch) {
      const result = await receiveEnvelope(this.db, env as Envelope)
      if (result.status === 'invalid') {
        peer.badCount++
        if (peer.badCount >= MAX_BAD_MESSAGES) {
          this.peers.delete(peer.ch.peerKey)
          this.cb.onBadPeer?.(peer.ch.peerKey)
          return
        }
        continue
      }
      accepted.push(...result.accepted)
      if (result.gap) {
        const existing = gaps.get(result.gap.author)
        gaps.set(result.gap.author, {
          from: Math.min(existing?.from ?? result.gap.from, result.gap.from),
          to: Math.max(existing?.to ?? result.gap.to, result.gap.to),
        })
      }
    }

    if (gaps.size > 0) peer.ch.send('want', Object.fromEntries(gaps))
    if (accepted.length > 0) {
      this.cb.onIngested(accepted)
      this.push(accepted, peer.ch.peerKey, peer.session)
    }
  }

  /**
   * Eager gossip: forward to every interested peer except the source (and
   * any channel sharing the source's session, i.e. the same client on
   * another transport). Duplicate deliveries elsewhere are harmless — the
   * receive pipeline dedupes by msgId.
   */
  push(
    msgs: Array<StoredMessage | Envelope>,
    excludePeerKey: string | null = null,
    excludeSession: string | null = null,
  ): void {
    const pushedSessions = new Set<string>()
    for (const [key, peer] of this.peers) {
      if (key === excludePeerKey) continue
      if (peer.session !== null) {
        if (peer.session === excludeSession) continue
        if (pushedSessions.has(peer.session)) continue
      }
      const batch = msgs.filter((m) => peer.interest.has(m.author)).map(toWireEnvelope)
      if (batch.length === 0) continue
      if (peer.session !== null) pushedSessions.add(peer.session)
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        peer.ch.send('msgs', { batch: batch.slice(i, i + BATCH_SIZE) })
      }
    }
  }

  peerCount(): number {
    return this.peers.size
  }
}
