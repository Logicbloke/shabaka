import 'fake-indexeddb/auto'
import { openShabakaDb, type ShabakaDb } from '../src/core/db'
import { generateIdentity } from '../src/core/identity'
import { createEnvelope, msgId } from '../src/core/envelope'
import type { Content, Envelope, Identity, MessageType } from '../src/core/types'

let dbCounter = 0

export function testDb(): Promise<ShabakaDb> {
  return openShabakaDb(`test-${Date.now()}-${dbCounter++}`)
}

/** Build a signed chain of envelopes for one author without touching a DB. */
export function makeChain(
  identity: Identity,
  items: Array<{ type: MessageType; content: Content }>,
): Envelope[] {
  const out: Envelope[] = []
  let head: { seq: number; id: string } | null = null
  for (const item of items) {
    const env = createEnvelope(identity, head, item.type, item.content, 1000 + out.length)
    out.push(env)
    head = { seq: env.seq, id: msgId(env) }
  }
  return out
}

export function makePosts(identity: Identity, texts: string[]): Envelope[] {
  return makeChain(
    identity,
    texts.map((text) => ({ type: 'post' as const, content: { text } })),
  )
}

export { generateIdentity }
