import { ed25519 } from '@noble/curves/ed25519.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { canonicalBytes } from './canonical'
import { fromB64url, toB64url } from './b64'
import type { Content, Envelope, Identity, MessageType } from './types'

export function signingBytes(env: Omit<Envelope, 'sig'>): Uint8Array {
  const { v, author, seq, prev, ts, type, content } = env
  return canonicalBytes({ v, author, seq, prev, ts, type, content })
}

/** Message ID commits to the signature too: sha256 over the full envelope. */
export function msgId(env: Envelope): string {
  const { v, author, seq, prev, ts, type, content, sig } = env
  return toB64url(sha256(canonicalBytes({ v, author, seq, prev, ts, type, content, sig })))
}

export function createEnvelope(
  identity: Identity,
  head: { seq: number; id: string } | null,
  type: MessageType,
  content: Content,
  ts: number = Date.now(),
): Envelope {
  const unsigned = {
    v: 1 as const,
    author: identity.pub,
    seq: head ? head.seq + 1 : 1,
    prev: head ? head.id : null,
    ts,
    type,
    content,
  }
  const sig = toB64url(ed25519.sign(signingBytes(unsigned), identity.seed))
  return { ...unsigned, sig }
}

/** Signature check only — schema and chain position are validate.ts's job. */
export function verifyEnvelope(env: Envelope): boolean {
  try {
    return ed25519.verify(fromB64url(env.sig), signingBytes(env), fromB64url(env.author))
  } catch {
    return false
  }
}
