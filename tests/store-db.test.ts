import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { withDb } from '../src/state/store'

describe('withDb resilience', () => {
  it('runs an operation against a live connection', async () => {
    const count = await withDb((db) => db.count('messages'))
    expect(count).toBe(0)
  })

  it('reconnects and retries once when the connection is closing', async () => {
    // The iOS/WebKit failure mode: the first transaction throws because the
    // browser closed the connection out from under us. withDb should drop the
    // dead handle, reopen, and retry.
    let calls = 0
    const result = await withDb(async (db) => {
      calls++
      if (calls === 1) {
        throw new DOMException('The database connection is closing.', 'InvalidStateError')
      }
      return db.count('messages')
    })
    expect(calls).toBe(2)
    expect(result).toBe(0)
  })

  it('does not retry on unrelated errors', async () => {
    let calls = 0
    await expect(
      withDb(async () => {
        calls++
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(calls).toBe(1)
  })
})
