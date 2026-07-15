export type MessageType =
  | 'post'
  | 'reply'
  | 'reaction'
  | 'profile'
  | 'follow'
  | 'unfollow'
  | 'dm'
  | 'audio'
  | 'audio-chunk'

export interface PostContent {
  text: string
}

export interface ReplyContent {
  text: string
  /** msgId of the thread's original post */
  root: string
  /** msgId of the direct parent (equals root for top-level replies) */
  parent: string
}

export interface ReactionContent {
  target: string
  emoji: string
}

export interface ProfileContent {
  name: string
  bio: string
}

export interface FollowContent {
  target: string
}

export interface DmContent {
  to: string
  /** b64url 24-byte XChaCha20 nonce */
  n: string
  /** b64url ciphertext of {text} */
  box: string
}

/**
 * A voice message manifest: the post that renders in the feed. The audio bytes
 * do not fit one envelope (16 KB cap), so they ride in separate `audio-chunk`
 * messages earlier in the same author's log; `chunks` lists their msgIds in
 * playback order.
 */
export interface AudioContent {
  /** clip length in ms */
  dur: number
  /** MediaRecorder container mime, used to rebuild the Blob for playback */
  mime: string
  /** ordered msgIds (b64url-32) of the audio-chunk messages */
  chunks: string[]
}

/** One slice of a voice clip's base64 audio, referenced by an AudioContent. */
export interface AudioChunkContent {
  /** b64url slice of the clip's base64 bytes */
  data: string
}

export type Content =
  | PostContent
  | ReplyContent
  | ReactionContent
  | ProfileContent
  | FollowContent
  | DmContent
  | AudioContent
  | AudioChunkContent

/**
 * The wire format. Per-author signed hash chain: `prev` is the msgId of the
 * author's previous envelope (null iff seq === 1), seq is dense and 1-based.
 * `sig` signs the canonical bytes of everything except itself.
 */
export interface Envelope {
  v: 1
  author: string
  seq: number
  prev: string | null
  ts: number
  type: MessageType
  content: Content
  sig: string
}

/** Envelope as persisted, plus locally derived fields. */
export interface StoredMessage extends Envelope {
  /** b64url(sha256(canonical(envelope incl. sig))) */
  id: string
  receivedAt: number
  /** min(ts, receivedAt) — sender-claimed ts clamped for display ordering */
  displayTs: number
  /** denormalized from content for indexing: reply root */
  root?: string
  /** denormalized from content for indexing: reaction target / dm recipient */
  target?: string
}

export interface Head {
  author: string
  seq: number
  id: string
  /** author signed two different messages at one seq (equivocation) */
  forked: boolean
}

export interface FollowRecord {
  follower: string
  target: string
  following: boolean
  /** seq of the follow/unfollow message this state came from (latest wins) */
  atSeq: number
}

export interface ProfileRecord {
  author: string
  name: string
  bio: string
  atSeq: number
}

export interface ScryptParams {
  N: number
  r: number
  p: number
}

export interface IdentityRecord {
  id: 'self'
  pub: string
  /** present when stored without a passphrase */
  seed?: string
  /** present when encrypted at rest */
  enc?: {
    salt: string
    nonce: string
    box: string
    scrypt: ScryptParams
  }
}

export interface PendingRecord extends Envelope {
  id: string
  receivedAt: number
}

/**
 * A "stay signed in" session: the seed encrypted under a non-extractable
 * WebCrypto key. The key's raw bytes are never exposed to JS, so this copy
 * cannot be exfiltrated for offline use — see core/session.ts.
 */
export interface SessionRecord {
  id: 'self'
  pub: string
  key: CryptoKey
  iv: Uint8Array
  box: Uint8Array
  createdAt: number
  expiresAt: number
}

export interface Identity {
  pub: string
  pubBytes: Uint8Array
  seed: Uint8Array
}
