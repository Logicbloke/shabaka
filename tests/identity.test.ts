import { describe, expect, it } from 'vitest'
import {
  exportIdentity,
  generateIdentity,
  importIdentity,
  recordNeedsPassphrase,
  toIdentityRecord,
  unlockIdentity,
} from '../src/core/identity'

const FAST_SCRYPT = { N: 1024, r: 8, p: 1 } // tests only

describe('identity', () => {
  it('generates a 32-byte seed with matching b64url pubkey', () => {
    const id = generateIdentity()
    expect(id.seed).toHaveLength(32)
    expect(id.pub).toHaveLength(43)
  })

  it('export/import round-trips', () => {
    const id = generateIdentity()
    const exported = exportIdentity(id)
    expect(exported.startsWith('shabaka-key-v1:')).toBe(true)
    const imported = importIdentity(' ' + exported + '\n')
    expect(imported.pub).toBe(id.pub)
    expect([...imported.seed]).toEqual([...id.seed])
  })

  it('rejects malformed backups', () => {
    expect(() => importIdentity('nonsense')).toThrow()
    expect(() => importIdentity('shabaka-key-v1:AAAA')).toThrow() // wrong length
  })

  it('stores plaintext when no passphrase is given', async () => {
    const id = generateIdentity()
    const record = await toIdentityRecord(id)
    expect(recordNeedsPassphrase(record)).toBe(false)
    const unlocked = await unlockIdentity(record)
    expect(unlocked.pub).toBe(id.pub)
  })

  it('encrypts at rest with a passphrase and round-trips', async () => {
    const id = generateIdentity()
    const record = await toIdentityRecord(id, 'hunter2', FAST_SCRYPT)
    expect(recordNeedsPassphrase(record)).toBe(true)
    expect(record.seed).toBeUndefined()
    const unlocked = await unlockIdentity(record, 'hunter2')
    expect(unlocked.pub).toBe(id.pub)
    expect([...unlocked.seed]).toEqual([...id.seed])
  })

  it('rejects a wrong or missing passphrase', async () => {
    const id = generateIdentity()
    const record = await toIdentityRecord(id, 'hunter2', FAST_SCRYPT)
    await expect(unlockIdentity(record, 'hunter3')).rejects.toThrow('wrong passphrase')
    await expect(unlockIdentity(record)).rejects.toThrow('passphrase required')
  })
})
