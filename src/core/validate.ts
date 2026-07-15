import { B64_32, B64_64, B64URL_RE, isCanonicalB64url } from './b64'
import { canonicalize } from './canonical'
import { msgId, verifyEnvelope } from './envelope'
import {
  deletePending,
  getHead,
  getMessage,
  getPendingByAuthorSeq,
  putPending,
  type ShabakaDb,
} from './db'
import { ingestValidated } from './logstore'
import type { Envelope, StoredMessage } from './types'

export const MAX_ENVELOPE_BYTES = 16384
export const MAX_TEXT = 8192
export const MAX_NAME = 64
export const MAX_BIO = 1024
export const MAX_EMOJI = 16
/** voice clip length ceiling (ms) */
export const MAX_AUDIO_MS = 30000
/** max audio-chunk messages one clip may reference */
export const MAX_AUDIO_CHUNKS = 64
/** max b64url length of one chunk's `data` (stays well under the 16 KB envelope cap) */
export const MAX_CHUNK_DATA = 12000
/** MediaRecorder containers we accept for playback */
export const AUDIO_MIMES = new Set(['audio/webm', 'audio/mp4', 'audio/ogg'])
const B64_24 = 32 // b64url length of a 24-byte nonce

const ENVELOPE_KEYS = ['v', 'author', 'seq', 'prev', 'ts', 'type', 'content', 'sig']
const TYPES = new Set([
  'post',
  'reply',
  'reaction',
  'profile',
  'follow',
  'unfollow',
  'dm',
  'audio',
  'audio-chunk',
  'dm-audio',
])

function isB64(s: unknown, len: number): s is string {
  return typeof s === 'string' && s.length === len && isCanonicalB64url(s)
}

function isStr(s: unknown, max: number): s is string {
  return typeof s === 'string' && s.length <= max
}

function hasExactKeys(obj: object, keys: string[]): boolean {
  const own = Object.keys(obj)
  return own.length === keys.length && keys.every((k) => own.includes(k))
}

function contentError(type: string, c: Record<string, unknown>): string | null {
  switch (type) {
    case 'post':
      if (!hasExactKeys(c, ['text']) || !isStr(c.text, MAX_TEXT)) return 'bad post content'
      return null
    case 'reply':
      if (
        !hasExactKeys(c, ['text', 'root', 'parent']) ||
        !isStr(c.text, MAX_TEXT) ||
        !isB64(c.root, B64_32) ||
        !isB64(c.parent, B64_32)
      )
        return 'bad reply content'
      return null
    case 'reaction':
      if (
        !hasExactKeys(c, ['target', 'emoji']) ||
        !isB64(c.target, B64_32) ||
        !isStr(c.emoji, MAX_EMOJI) ||
        (c.emoji as string).length === 0
      )
        return 'bad reaction content'
      return null
    case 'profile':
      if (!hasExactKeys(c, ['name', 'bio']) || !isStr(c.name, MAX_NAME) || !isStr(c.bio, MAX_BIO))
        return 'bad profile content'
      return null
    case 'follow':
    case 'unfollow':
      if (!hasExactKeys(c, ['target']) || !isB64(c.target, B64_32)) return 'bad follow content'
      return null
    case 'dm':
      if (
        !hasExactKeys(c, ['to', 'n', 'box']) ||
        !isB64(c.to, B64_32) ||
        !isB64(c.n, B64_24) ||
        !isStr(c.box, MAX_TEXT * 2) ||
        !B64URL_RE.test(c.box as string)
      )
        return 'bad dm content'
      return null
    case 'audio':
      if (
        !hasExactKeys(c, ['dur', 'mime', 'chunks']) ||
        typeof c.dur !== 'number' ||
        !Number.isSafeInteger(c.dur) ||
        c.dur <= 0 ||
        c.dur > MAX_AUDIO_MS ||
        typeof c.mime !== 'string' ||
        !AUDIO_MIMES.has(c.mime) ||
        !Array.isArray(c.chunks) ||
        c.chunks.length < 1 ||
        c.chunks.length > MAX_AUDIO_CHUNKS ||
        !c.chunks.every((id) => isB64(id, B64_32))
      )
        return 'bad audio content'
      return null
    case 'audio-chunk':
      if (
        !hasExactKeys(c, ['data']) ||
        !isStr(c.data, MAX_CHUNK_DATA) ||
        (c.data as string).length === 0 ||
        !B64URL_RE.test(c.data as string)
      )
        return 'bad audio-chunk content'
      return null
    case 'dm-audio':
      if (
        !hasExactKeys(c, ['to', 'n', 'mime', 'dur', 'chunks']) ||
        !isB64(c.to, B64_32) ||
        !isB64(c.n, B64_24) ||
        typeof c.mime !== 'string' ||
        !AUDIO_MIMES.has(c.mime) ||
        typeof c.dur !== 'number' ||
        !Number.isSafeInteger(c.dur) ||
        c.dur <= 0 ||
        c.dur > MAX_AUDIO_MS ||
        !Array.isArray(c.chunks) ||
        c.chunks.length < 1 ||
        c.chunks.length > MAX_AUDIO_CHUNKS ||
        !c.chunks.every((id) => isB64(id, B64_32))
      )
        return 'bad dm-audio content'
      return null
    default:
      return 'unknown type'
  }
}

/** Full structural validation of an untrusted envelope. Null = OK. */
export function schemaError(env: unknown): string | null {
  if (typeof env !== 'object' || env === null || Array.isArray(env)) return 'not an object'
  const e = env as Record<string, unknown>
  if (!hasExactKeys(e, ENVELOPE_KEYS)) return 'wrong envelope keys'
  if (e.v !== 1) return 'unknown version'
  if (!isB64(e.author, B64_32)) return 'bad author'
  if (typeof e.seq !== 'number' || !Number.isSafeInteger(e.seq) || e.seq < 1) return 'bad seq'
  if (e.seq === 1 ? e.prev !== null : !isB64(e.prev, B64_32)) return 'bad prev'
  if (typeof e.ts !== 'number' || !Number.isSafeInteger(e.ts) || e.ts < 0) return 'bad ts'
  if (typeof e.type !== 'string' || !TYPES.has(e.type)) return 'unknown type'
  if (!isB64(e.sig, B64_64)) return 'bad sig encoding'
  if (typeof e.content !== 'object' || e.content === null || Array.isArray(e.content))
    return 'bad content'
  const cErr = contentError(e.type, e.content as Record<string, unknown>)
  if (cErr) return cErr
  try {
    if (canonicalize(env).length > MAX_ENVELOPE_BYTES) return 'envelope too large'
  } catch {
    return 'non-canonical values'
  }
  return null
}

export type ReceiveStatus = 'accepted' | 'duplicate' | 'pending' | 'invalid' | 'forked'

export interface ReceiveOutcome {
  status: ReceiveStatus
  reason?: string
  /** newly ingested messages, including any drained from the pending buffer */
  accepted: StoredMessage[]
  /** chain gap to request from the sending peer */
  gap?: { author: string; from: number; to: number }
}

async function markForked(db: ShabakaDb, author: string): Promise<void> {
  const head = await getHead(db, author)
  if (head && !head.forked) await db.put('heads', { ...head, forked: true })
}

/**
 * The security boundary for everything that arrives from the network:
 * schema → dedupe → signature → chain position. Accepting a message drains
 * any directly-connectable successors from the pending buffer.
 */
export async function receiveEnvelope(
  db: ShabakaDb,
  env: Envelope,
  receivedAt: number = Date.now(),
): Promise<ReceiveOutcome> {
  const err = schemaError(env)
  if (err) return { status: 'invalid', reason: err, accepted: [] }

  const id = msgId(env)
  if (await getMessage(db, id)) return { status: 'duplicate', accepted: [] }

  if (!verifyEnvelope(env)) return { status: 'invalid', reason: 'bad signature', accepted: [] }

  const head = await getHead(db, env.author)
  const nextSeq = head ? head.seq + 1 : 1

  if (env.seq === nextSeq) {
    if (head && env.prev !== head.id) {
      // right position, wrong history — author built on a different chain
      await markForked(db, env.author)
      return { status: 'forked', accepted: [] }
    }
    const accepted = [await ingestValidated(db, env, id, receivedAt)]
    await drainPending(db, env.author, accepted)
    return { status: 'accepted', accepted }
  }

  if (env.seq > nextSeq) {
    await putPending(db, { ...env, id, receivedAt })
    return {
      status: 'pending',
      accepted: [],
      gap: { author: env.author, from: nextSeq, to: env.seq - 1 },
    }
  }

  // seq <= head.seq and the id is unknown: the author signed two different
  // messages at one seq (equivocation). Keep-first, flag, stop.
  await markForked(db, env.author)
  return { status: 'forked', accepted: [] }
}

async function drainPending(
  db: ShabakaDb,
  author: string,
  accepted: StoredMessage[],
): Promise<void> {
  for (;;) {
    const last = accepted[accepted.length - 1]!
    const next = await getPendingByAuthorSeq(db, author, last.seq + 1)
    if (!next) return
    await deletePending(db, next.id)
    if (next.prev !== last.id) return // pending entry from a forked history
    const { id, receivedAt, ...envRest } = next
    accepted.push(await ingestValidated(db, envRest as Envelope, id, receivedAt))
  }
}
