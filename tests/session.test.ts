import { describe, expect, it } from 'vitest'
import { testDb, generateIdentity } from './helpers'
import { getSessionRecord } from '../src/core/db'
import {
  MAX_SESSION_MS,
  clearSession,
  createSession,
  getSessionExpiry,
  loadSession,
} from '../src/core/session'

describe('session', () => {
  it('round-trips the identity without the passphrase', async () => {
    const db = await testDb()
    const id = generateIdentity()
    const now = 1_000_000
    const expiresAt = await createSession(db, id, 60_000, now)
    expect(expiresAt).toBe(now + 60_000)

    const resumed = await loadSession(db, now + 30_000)
    expect(resumed).not.toBeNull()
    expect(resumed!.pub).toBe(id.pub)
    expect([...resumed!.seed]).toEqual([...id.seed])
  })

  it('stores the session key as non-extractable', async () => {
    const db = await testDb()
    await createSession(db, generateIdentity(), 60_000, 0)
    const rec = await getSessionRecord(db)
    expect(rec!.key.extractable).toBe(false)
  })

  it('refuses an expired session and clears it', async () => {
    const db = await testDb()
    const id = generateIdentity()
    await createSession(db, id, 60_000, 0)

    expect(await loadSession(db, 60_001)).toBeNull()
    expect(await getSessionRecord(db)).toBeUndefined()
  })

  it('clamps duration to the maximum', async () => {
    const db = await testDb()
    const expiresAt = await createSession(db, generateIdentity(), MAX_SESSION_MS * 10, 0)
    expect(expiresAt).toBe(MAX_SESSION_MS)
  })

  it('reports and clears the live expiry', async () => {
    const db = await testDb()
    await createSession(db, generateIdentity(), 60_000, 0)
    expect(await getSessionExpiry(db, 10_000)).toBe(60_000)

    await clearSession(db)
    expect(await getSessionExpiry(db, 10_000)).toBeNull()
    expect(await loadSession(db, 10_000)).toBeNull()
  })
})
