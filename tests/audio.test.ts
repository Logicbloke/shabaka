import { describe, expect, it } from 'vitest'
import { generateIdentity, testDb } from './helpers'
import {
  MAX_AUDIO_CHUNKS,
  MAX_AUDIO_MS,
  MAX_CHUNK_DATA,
  receiveEnvelope,
  schemaError,
} from '../src/core/validate'
import { createEnvelope, msgId } from '../src/core/envelope'
import { fromB64url, toB64url } from '../src/core/b64'
import { getMessage } from '../src/core/db'
import { openDmAudio, sealDmAudio } from '../src/core/dm'
import type { AudioChunkContent, Envelope } from '../src/core/types'

const alice = generateIdentity()
const bob = generateIdentity()
const carol = generateIdentity()
const chunkId = msgId(createEnvelope(alice, null, 'audio-chunk', { data: 'AAAA' }, 1))

function audio(content: unknown): Envelope {
  return { ...createEnvelope(alice, null, 'audio', { dur: 1, mime: 'audio/webm', chunks: [chunkId] }, 1), content } as Envelope
}
function chunk(content: unknown): Envelope {
  return { ...createEnvelope(alice, null, 'audio-chunk', { data: 'AAAA' }, 1), content } as Envelope
}

describe('audio schema', () => {
  it('accepts a valid manifest and chunk', () => {
    expect(schemaError(createEnvelope(alice, null, 'audio', { dur: 5000, mime: 'audio/webm', chunks: [chunkId] }, 1))).toBeNull()
    expect(schemaError(createEnvelope(alice, null, 'audio-chunk', { data: 'AbC-_9' }, 1))).toBeNull()
    expect(schemaError(createEnvelope(alice, null, 'audio', { dur: 5000, mime: 'audio/mp4', chunks: [chunkId] }, 1))).toBeNull()
  })

  it('rejects bad manifest content', () => {
    expect(schemaError(audio({ dur: 5000, mime: 'audio/webm', chunks: [chunkId], extra: 1 }))).toBe('bad audio content')
    expect(schemaError(audio({ dur: 0, mime: 'audio/webm', chunks: [chunkId] }))).toBe('bad audio content')
    expect(schemaError(audio({ dur: MAX_AUDIO_MS + 1, mime: 'audio/webm', chunks: [chunkId] }))).toBe('bad audio content')
    expect(schemaError(audio({ dur: 1.5, mime: 'audio/webm', chunks: [chunkId] }))).toBe('bad audio content')
    expect(schemaError(audio({ dur: 1, mime: 'audio/wav', chunks: [chunkId] }))).toBe('bad audio content')
    expect(schemaError(audio({ dur: 1, mime: 'audio/webm', chunks: [] }))).toBe('bad audio content')
    expect(schemaError(audio({ dur: 1, mime: 'audio/webm', chunks: ['not-a-msgid'] }))).toBe('bad audio content')
    expect(schemaError(audio({ dur: 1, mime: 'audio/webm', chunks: Array(MAX_AUDIO_CHUNKS + 1).fill(chunkId) }))).toBe('bad audio content')
  })

  it('rejects bad chunk content', () => {
    expect(schemaError(chunk({ data: 'AAAA', extra: 1 }))).toBe('bad audio-chunk content')
    expect(schemaError(chunk({ data: '' }))).toBe('bad audio-chunk content')
    expect(schemaError(chunk({ data: 'has spaces!' }))).toBe('bad audio-chunk content')
    // a chunk large enough to threaten the 16 KB envelope cap is rejected first
    expect(schemaError(chunk({ data: 'A'.repeat(MAX_CHUNK_DATA + 1) }))).toBe('bad audio-chunk content')
  })
})

describe('dm-audio schema', () => {
  const good = { to: bob.pub, n: toB64url(new Uint8Array(24)), mime: 'audio/webm', dur: 5000, chunks: [chunkId] }
  function dmAudio(content: unknown): Envelope {
    return { ...createEnvelope(alice, null, 'dm-audio', good, 1), content } as Envelope
  }

  it('accepts a valid dm-audio manifest', () => {
    expect(schemaError(createEnvelope(alice, null, 'dm-audio', good, 1))).toBeNull()
  })

  it('rejects bad dm-audio content', () => {
    expect(schemaError(dmAudio({ ...good, extra: 1 }))).toBe('bad dm-audio content')
    expect(schemaError(dmAudio({ ...good, to: 'short' }))).toBe('bad dm-audio content')
    expect(schemaError(dmAudio({ ...good, n: 'short' }))).toBe('bad dm-audio content')
    expect(schemaError(dmAudio({ ...good, mime: 'audio/wav' }))).toBe('bad dm-audio content')
    expect(schemaError(dmAudio({ ...good, dur: 0 }))).toBe('bad dm-audio content')
    expect(schemaError(dmAudio({ ...good, dur: MAX_AUDIO_MS + 1 }))).toBe('bad dm-audio content')
    expect(schemaError(dmAudio({ ...good, chunks: [] }))).toBe('bad dm-audio content')
    expect(schemaError(dmAudio({ ...good, chunks: ['not-a-msgid'] }))).toBe('bad dm-audio content')
  })
})

describe('voice DM round-trip', () => {
  it('seals, chunks, reassembles, and only the pair can decrypt', async () => {
    const bytes = new Uint8Array(20000)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 5) % 251

    const { to, n, cipher } = sealDmAudio(alice, bob.pub, bytes)
    const b64 = toB64url(cipher)
    const slices: string[] = []
    for (let i = 0; i < b64.length; i += MAX_CHUNK_DATA) slices.push(b64.slice(i, i + MAX_CHUNK_DATA))

    const envs: Envelope[] = []
    const ids: string[] = []
    let head: { seq: number; id: string } | null = null
    let ts = 1000
    for (const data of slices) {
      const e = createEnvelope(alice, head, 'audio-chunk', { data }, ts++)
      const id = msgId(e)
      envs.push(e)
      ids.push(id)
      head = { seq: e.seq, id }
    }
    envs.push(createEnvelope(alice, head, 'dm-audio', { to, n, mime: 'audio/webm', dur: 3000, chunks: ids }, ts++))

    const db = await testDb()
    for (const e of envs) expect((await receiveEnvelope(db, e)).status).toBe('accepted')

    let acc = ''
    for (const id of ids) acc += ((await getMessage(db, id))!.content as AudioChunkContent).data
    const reCipher = fromB64url(acc)

    // recipient and sender can decrypt; a relaying third party cannot
    expect(openDmAudio(bob, alice.pub, to, n, reCipher)).toEqual(bytes)
    expect(openDmAudio(alice, alice.pub, to, n, reCipher)).toEqual(bytes)
    expect(openDmAudio(carol, alice.pub, to, n, reCipher)).toBeNull()
  })
})

describe('voice clip round-trip through the log', () => {
  it('splits into chunks + manifest and reassembles the exact bytes', async () => {
    const bytes = new Uint8Array(30000)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7) % 251
    const b64 = toB64url(bytes)

    const slices: string[] = []
    for (let i = 0; i < b64.length; i += MAX_CHUNK_DATA) slices.push(b64.slice(i, i + MAX_CHUNK_DATA))
    expect(slices.length).toBeGreaterThan(1)
    expect(slices.length).toBeLessThanOrEqual(MAX_AUDIO_CHUNKS)

    const envs: Envelope[] = []
    const ids: string[] = []
    let head: { seq: number; id: string } | null = null
    let ts = 1000
    for (const data of slices) {
      const e = createEnvelope(alice, head, 'audio-chunk', { data }, ts++)
      const id = msgId(e)
      envs.push(e)
      ids.push(id)
      head = { seq: e.seq, id }
    }
    const manifest = createEnvelope(alice, head, 'audio', { dur: 5000, mime: 'audio/webm', chunks: ids }, ts++)
    envs.push(manifest)

    const db = await testDb()
    for (const e of envs) {
      const r = await receiveEnvelope(db, e)
      expect(r.status).toBe('accepted')
    }

    let acc = ''
    for (const id of ids) {
      const m = await getMessage(db, id)
      expect(m?.type).toBe('audio-chunk')
      acc += (m!.content as AudioChunkContent).data
    }
    expect(fromB64url(acc)).toEqual(bytes)
  })
})
