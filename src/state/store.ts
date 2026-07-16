import { create } from 'zustand'
import {
  getIdentityRecord,
  getMessage,
  openShabakaDb,
  putIdentityRecord,
  type ShabakaDb,
} from '../core/db'
import { fromB64url, toB64url } from '../core/b64'
import { MAX_AUDIO_CHUNKS, MAX_CHUNK_DATA } from '../core/validate'
import {
  exportIdentity,
  generateIdentity,
  importIdentity,
  recordNeedsPassphrase,
  toIdentityRecord,
  unlockIdentity,
} from '../core/identity'
import { clearSession, createSession, getSessionExpiry, loadSession } from '../core/session'
import { appendLocal, resetAuthorLog } from '../core/logstore'
import { openDmAudio, sealDm, sealDmAudio } from '../core/dm'
import { coreEvents, type StrategyState } from '../core/events'
import type {
  AudioChunkContent,
  AudioContent,
  Content,
  DmAudioContent,
  Identity,
  MessageType,
  StoredMessage,
} from '../core/types'

export type View =
  | { name: 'feed' }
  | { name: 'thread'; root: string; focus?: string }
  | { name: 'profile'; author: string }
  | { name: 'follows' }
  | { name: 'notifications' }
  | { name: 'dms' }
  | { name: 'dm'; other: string }
  | { name: 'security' }

export type Phase = 'loading' | 'fresh' | 'locked' | 'ready'

export type Lang = 'en' | 'ar'

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('shabaka-lang')
    if (saved === 'ar' || saved === 'en') return saved
    return navigator.language.startsWith('ar') ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

function applyDir(lang: Lang): void {
  if (typeof document === 'undefined') return
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}

interface AppState {
  phase: Phase
  identity: Identity | null
  view: View
  /** bumped on every ingested message; components re-query off this */
  dataVersion: number
  peers: Record<string, { state: StrategyState; peerCount: number }>
  /** unread notifications (likes + replies to me); maintained by state/badge.ts */
  notifUnread: number
  /** unread DMs addressed to me; maintained by state/badge.ts */
  dmUnread: number
  lang: Lang
}

export const useApp = create<AppState>(() => ({
  phase: 'loading',
  identity: null,
  view: initialView(),
  dataVersion: 0,
  peers: {},
  notifUnread: 0,
  dmUnread: 0,
  lang: detectLang(),
}))

export function setLang(lang: Lang): void {
  useApp.setState({ lang })
  try {
    localStorage.setItem('shabaka-lang', lang)
  } catch {
    // private mode etc. — language just won't persist
  }
  applyDir(lang)
}

let db: ShabakaDb | null = null
let opening: Promise<ShabakaDb> | null = null

/** Open (or reopen) the connection, coalescing concurrent callers. */
function openDb(): Promise<ShabakaDb> {
  if (db) return Promise.resolve(db)
  if (opening) return opening
  opening = openShabakaDb('shabaka', () => {
    // WebKit (every iOS browser) drops the connection when the tab is
    // backgrounded or under memory pressure. Discard the dead handle and
    // reconnect so the next operation gets a live one.
    db = null
    opening = null
    void openDb()
  }).then((opened) => {
    db = opened
    opening = null
    return opened
  })
  return opening
}

export function getDb(): ShabakaDb {
  if (!db) throw new Error('db not ready')
  return db
}

function isConnectionClosing(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'InvalidStateError' || /connection is closing/i.test(e.message))
  )
}

/**
 * Run a DB operation, transparently reconnecting and retrying once if the
 * connection was closing (the iOS/WebKit failure mode). Use this for any DB
 * access that must survive the tab being backgrounded.
 */
export async function withDb<T>(fn: (db: ShabakaDb) => Promise<T>): Promise<T> {
  const conn = await openDb()
  try {
    return await fn(conn)
  } catch (e) {
    if (!isConnectionClosing(e)) throw e
    db = null
    return fn(await openDb())
  }
}

function me(): Identity {
  const id = useApp.getState().identity
  if (!id) throw new Error('no identity')
  return id
}

export function navigate(view: View): void {
  useApp.setState({ view })
}

/**
 * Public, shareable base URL for the page, or null when there is nothing worth
 * sharing: served from a file, from localhost, or as an installed PWA (phone
 * home screen), where the URL points at the reader's own device, not a host.
 */
function shareableBase(): string | null {
  if (typeof location === 'undefined') return null
  const { protocol, hostname } = location
  if (protocol === 'file:') return null
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return null
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return null
    // iOS Safari home-screen apps
    if ((navigator as { standalone?: boolean }).standalone) return null
  } catch {
    // matchMedia unavailable — fall through and treat as a normal page
  }
  return location.origin + location.pathname
}

/** Shareable link to a post's thread, or null when the page isn't hosted. */
export function postUrl(root: string): string | null {
  const base = shareableBase()
  return base ? `${base}#/thread/${root}` : null
}

/** Initial view derived from the URL hash so shared post links deep-link. */
function initialView(): View {
  if (typeof location === 'undefined') return { name: 'feed' }
  const m = /^#\/thread\/(.+)$/.exec(location.hash)
  return m ? { name: 'thread', root: decodeURIComponent(m[1]) } : { name: 'feed' }
}

export async function initApp(): Promise<void> {
  applyDir(useApp.getState().lang)
  const conn = await openDb()

  coreEvents.on('message-ingested', () => {
    useApp.setState((s) => ({ dataVersion: s.dataVersion + 1 }))
  })
  coreEvents.on('peer-status', (p) => {
    useApp.setState((s) => ({
      peers: { ...s.peers, [p.strategy]: { state: p.state, peerCount: p.peerCount } },
    }))
  })

  const record = await getIdentityRecord(conn)
  if (!record) {
    useApp.setState({ phase: 'fresh' })
  } else if (recordNeedsPassphrase(record)) {
    const resumed = await loadSession(conn).catch(() => null)
    if (resumed && resumed.pub === record.pub) ready(resumed)
    else useApp.setState({ phase: 'locked' })
  } else {
    ready(await unlockIdentity(record))
  }
}

function ready(identity: Identity): void {
  useApp.setState({ identity, phase: 'ready' })
  void onReady(identity)
}

/** Phase C replaces this with network startup; local-only for now. */
let onReady: (identity: Identity) => Promise<void> = async () => {}
export function setOnReady(fn: (identity: Identity) => Promise<void>): void {
  onReady = fn
}

// ---- onboarding actions ----

/** Generate but do NOT persist — the UI shows the backup string first. */
export function prepareIdentity(): { identity: Identity; backup: string } {
  const identity = generateIdentity()
  return { identity, backup: exportIdentity(identity) }
}

export async function commitIdentity(
  identity: Identity,
  passphrase?: string,
  rememberMs = 0,
): Promise<void> {
  await putIdentityRecord(getDb(), await toIdentityRecord(identity, passphrase || undefined))
  // A session only makes sense when the key is actually encrypted at rest;
  // without a passphrase the identity auto-unlocks anyway.
  if (passphrase && rememberMs > 0) await createSession(getDb(), identity, rememberMs)
  ready(identity)
}

export async function importAndCommit(
  backup: string,
  passphrase?: string,
  rememberMs = 0,
): Promise<void> {
  await commitIdentity(importIdentity(backup), passphrase, rememberMs)
}

export async function unlock(passphrase: string, rememberMs = 0): Promise<void> {
  const record = await getIdentityRecord(getDb())
  if (!record) throw new Error('no identity record')
  const identity = await unlockIdentity(record, passphrase)
  if (rememberMs > 0) await createSession(getDb(), identity, rememberMs)
  ready(identity)
}

/** Whether the stored key is encrypted at rest (so a session is meaningful). */
export async function identityEncrypted(): Promise<boolean> {
  const record = await getIdentityRecord(getDb()).catch(() => undefined)
  return !!record && recordNeedsPassphrase(record)
}

/** Expiry epoch of the active "stay signed in" session, or null. */
export function sessionExpiry(): Promise<number | null> {
  return getSessionExpiry(getDb()).catch(() => null)
}

/** Drop the session and lock: reload so in-memory key and network are torn down. */
export async function endSession(): Promise<void> {
  await clearSession(getDb()).catch(() => {})
  if (typeof location !== 'undefined') location.reload()
}

/**
 * Fork recovery: throw away this device's copy of our own log, then reload so
 * the network re-init re-pulls the canonical chain from a peer. Only run this on
 * the device whose history you are abandoning — everything it posted that never
 * propagated is gone. See `resetAuthorLog`.
 */
export async function resetMyLog(): Promise<void> {
  await withDb((conn) => resetAuthorLog(conn, me().pub))
  if (typeof location !== 'undefined') location.reload()
}

// ---- compose actions ----

async function append(type: MessageType, content: Content): Promise<StoredMessage> {
  const msg = await withDb((conn) => appendLocal(conn, me(), type, content))
  coreEvents.emit('message-ingested', msg)
  coreEvents.emit('local-append', msg)
  return msg
}

export async function composePost(text: string): Promise<void> {
  await append('post', { text })
}

export async function composeReply(root: string, parent: string, text: string): Promise<void> {
  await append('reply', { text, root, parent })
}

export async function reactTo(target: string, emoji: string): Promise<void> {
  await append('reaction', { target, emoji })
}

export async function saveProfile(name: string, bio: string): Promise<void> {
  await append('profile', { name, bio })
}

export async function followKey(target: string): Promise<void> {
  await append('follow', { target })
}

export async function unfollowKey(target: string): Promise<void> {
  await append('unfollow', { target })
}

export async function sendDm(to: string, text: string): Promise<void> {
  await append('dm', sealDm(me(), to, text))
}

/**
 * Slice a base64 string into `audio-chunk` messages (audio can't fit one 16 KB
 * envelope) and return their msgIds in order. Used by both public and DM voice.
 */
async function appendAudioChunks(b64: string): Promise<string[]> {
  const slices: string[] = []
  for (let i = 0; i < b64.length; i += MAX_CHUNK_DATA) slices.push(b64.slice(i, i + MAX_CHUNK_DATA))
  if (slices.length === 0) throw new Error('empty recording')
  if (slices.length > MAX_AUDIO_CHUNKS) throw new Error('recording too long')
  const chunks: string[] = []
  for (const data of slices) {
    const msg = await append('audio-chunk', { data } satisfies AudioChunkContent)
    chunks.push(msg.id)
  }
  return chunks
}

/** Concatenate the base64 held by a manifest's chunk messages; null if any is missing. */
async function joinAudioChunks(chunkIds: string[]): Promise<string | null> {
  const parts = await withDb((conn) => Promise.all(chunkIds.map((id) => getMessage(conn, id))))
  let b64 = ''
  for (const p of parts) {
    if (!p || p.type !== 'audio-chunk') return null
    b64 += (p.content as AudioChunkContent).data
  }
  return b64
}

/**
 * Publish a recorded voice clip. The chunk messages are appended first, then an
 * `audio` manifest naming them in playback order — the manifest is the post that
 * renders in the feed. All ride the normal log + sync path.
 */
export async function composeVoice(blob: Blob, dur: number, mime: string): Promise<void> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunks = await appendAudioChunks(toB64url(bytes))
  await append('audio', { dur: Math.round(dur), mime, chunks } satisfies AudioContent)
}

/**
 * Send a recorded voice clip as an encrypted DM: the audio is sealed for the
 * recipient, its ciphertext base64 is chunked, and a `dm-audio` manifest carries
 * the nonce + chunk refs. Only the recipient (or the sender) can decrypt it.
 */
export async function composeVoiceDm(
  to: string,
  blob: Blob,
  dur: number,
  mime: string,
): Promise<void> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const { n, cipher } = sealDmAudio(me(), to, bytes)
  const chunks = await appendAudioChunks(toB64url(cipher))
  await append('dm-audio', { to, n, mime, dur: Math.round(dur), chunks } satisfies DmAudioContent)
}

/**
 * Reassemble a public voice clip from its chunk messages. Returns null while any
 * chunk is still missing (not yet synced) — the caller shows a loading state.
 */
export async function loadVoiceBytes(content: AudioContent): Promise<Uint8Array | null> {
  const b64 = await joinAudioChunks(content.chunks)
  return b64 === null ? null : fromB64url(b64)
}

export type VoiceDmResult =
  | { kind: 'ok'; bytes: Uint8Array }
  | { kind: 'incomplete' } // chunks not fully synced yet
  | { kind: 'error' } // reassembled but not decryptable (not ours / tampered)

/** Reassemble and decrypt a voice DM for the given identity. */
export async function loadVoiceDmBytes(
  identity: Identity,
  msg: StoredMessage,
): Promise<VoiceDmResult> {
  const content = msg.content as DmAudioContent
  const b64 = await joinAudioChunks(content.chunks)
  if (b64 === null) return { kind: 'incomplete' }
  const bytes = openDmAudio(identity, msg.author, content.to, content.n, fromB64url(b64))
  return bytes ? { kind: 'ok', bytes } : { kind: 'error' }
}
