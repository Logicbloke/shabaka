import { describe, expect, it } from 'vitest'
import { generateIdentity } from './helpers'
import { openDm, sealDm } from '../src/core/dm'
import { createEnvelope } from '../src/core/envelope'
import type { DmContent, Envelope } from '../src/core/types'

describe('dm', () => {
  const alice = generateIdentity()
  const bob = generateIdentity()
  const carol = generateIdentity()

  function dmEnvelope(text: string): Envelope {
    return createEnvelope(alice, null, 'dm', sealDm(alice, bob.pub, text), 1)
  }

  it('recipient can decrypt', () => {
    const env = dmEnvelope('secret hello')
    expect(openDm(bob, env)).toEqual({ text: 'secret hello' })
  })

  it('sender can decrypt their own sent message (log re-read)', () => {
    const env = dmEnvelope('secret hello')
    expect(openDm(alice, env)).toEqual({ text: 'secret hello' })
  })

  it('a relaying third party cannot decrypt', () => {
    const env = dmEnvelope('secret hello')
    expect(openDm(carol, env)).toBeNull()
  })

  it('tampered ciphertext fails to authenticate', () => {
    const env = dmEnvelope('secret hello')
    const c = env.content as DmContent
    const flipped = (c.box[0] === 'A' ? 'B' : 'A') + c.box.slice(1)
    expect(openDm(bob, { ...env, content: { ...c, box: flipped } })).toBeNull()
  })

  it('rewriting the recipient breaks the AAD binding', () => {
    const env = dmEnvelope('secret hello')
    const c = env.content as DmContent
    // an attacker redirects the DM to carol; even though carol now appears to
    // be the recipient, decryption must fail (and the sig is broken anyway)
    expect(openDm(carol, { ...env, content: { ...c, to: carol.pub } })).toBeNull()
  })

  it('unique nonces per message', () => {
    const a = sealDm(alice, bob.pub, 'same text')
    const b = sealDm(alice, bob.pub, 'same text')
    expect(a.n).not.toBe(b.n)
    expect(a.box).not.toBe(b.box)
  })
})
