import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { concatBytes, randomBytes } from '@noble/hashes/utils.js'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { fromB64url, toB64url } from './b64'
import type { DmContent, Envelope, Identity } from './types'

const INFO = new TextEncoder().encode('shabaka-dm-v1')

/**
 * Static–static X25519: both parties (and only they) can derive this key
 * forever, so the sender can decrypt their own sent DMs after a re-sync.
 * Trade-off (documented): no forward secrecy. Sorting the pubkeys into the
 * salt makes the key symmetric for the pair.
 */
function dmKey(me: Identity, otherPub: string): Uint8Array {
  const myX = ed25519.utils.toMontgomerySecret(me.seed)
  const theirX = ed25519.utils.toMontgomery(fromB64url(otherPub))
  const shared = x25519.getSharedSecret(myX, theirX)
  const [a, b] = [me.pub, otherPub].sort()
  const salt = concatBytes(fromB64url(a!), fromB64url(b!))
  return hkdf(sha256, shared, salt, INFO, 32)
}

/** AAD binds the ciphertext to the envelope's (author, to) pair. */
function dmAad(authorPub: string, toPub: string): Uint8Array {
  return concatBytes(fromB64url(authorPub), fromB64url(toPub))
}

export function sealDm(me: Identity, toPub: string, text: string): DmContent {
  const nonce = randomBytes(24)
  const plaintext = new TextEncoder().encode(JSON.stringify({ text }))
  const box = xchacha20poly1305(dmKey(me, toPub), nonce, dmAad(me.pub, toPub)).encrypt(plaintext)
  return { to: toPub, n: toB64url(nonce), box: toB64url(box) }
}

/**
 * Seal raw voice bytes for a recipient (same key schedule as text DMs). Returns
 * the nonce and ciphertext; the caller base64s and chunks the ciphertext into
 * `audio-chunk` messages and records the nonce in the `dm-audio` manifest.
 */
export function sealDmAudio(
  me: Identity,
  toPub: string,
  bytes: Uint8Array,
): { to: string; n: string; cipher: Uint8Array } {
  const nonce = randomBytes(24)
  const cipher = xchacha20poly1305(dmKey(me, toPub), nonce, dmAad(me.pub, toPub)).encrypt(bytes)
  return { to: toPub, n: toB64url(nonce), cipher }
}

/** Decrypt reassembled voice ciphertext. Null when it is not ours or fails to authenticate. */
export function openDmAudio(
  me: Identity,
  author: string,
  toPub: string,
  n: string,
  cipher: Uint8Array,
): Uint8Array | null {
  let other: string
  if (author === me.pub) other = toPub
  else if (toPub === me.pub) other = author
  else return null
  try {
    return xchacha20poly1305(dmKey(me, other), fromB64url(n), dmAad(author, toPub)).decrypt(cipher)
  } catch {
    return null
  }
}

/** Returns null when the DM is not for us or fails to authenticate. */
export function openDm(me: Identity, env: Envelope): { text: string } | null {
  if (env.type !== 'dm') return null
  const c = env.content as DmContent
  let other: string
  if (env.author === me.pub) other = c.to
  else if (c.to === me.pub) other = env.author
  else return null
  try {
    const pt = xchacha20poly1305(
      dmKey(me, other),
      fromB64url(c.n),
      dmAad(env.author, c.to),
    ).decrypt(fromB64url(c.box))
    const parsed: unknown = JSON.parse(new TextDecoder().decode(pt))
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { text?: unknown }).text === 'string'
    ) {
      return { text: (parsed as { text: string }).text }
    }
    return null
  } catch {
    return null
  }
}
