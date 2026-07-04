import { expect, test } from '@playwright/test'
import { follow, newPeer, onboard } from './helpers'

test('DMs decrypt for the recipient; a relaying peer cannot read them', async ({ browser }) => {
  const alice = await newPeer(browser)
  const alicePub = await onboard(alice.page, 'Alice')

  const bob = await newPeer(browser)
  const bobPub = await onboard(bob.page, 'Bob')
  // both follow alice so both replicate her log (which carries the DM)
  await follow(bob.page, alicePub)

  const carol = await newPeer(browser)
  await onboard(carol.page, 'Carol')
  await follow(carol.page, alicePub)

  // Alice DMs Bob
  await alice.page.getByRole('button', { name: 'DMs' }).click()
  await alice.page.getByPlaceholder('Start a conversation: paste a public key').fill(bobPub)
  await alice.page.getByRole('button', { name: 'Open' }).click()
  await alice.page.getByPlaceholder('Encrypted message…').fill('meet at the fountain at 6')
  await alice.page.getByRole('button', { name: 'Send' }).click()
  await expect(alice.page.locator('.dm.mine p')).toHaveText('meet at the fountain at 6')

  // Bob decrypts it
  await bob.page.getByRole('button', { name: 'DMs' }).click()
  await expect(bob.page.locator('.dm-list li')).toHaveCount(1, { timeout: 30_000 })
  await bob.page.locator('.dm-list li').click()
  await expect(bob.page.locator('.dm.theirs p')).toHaveText('meet at the fountain at 6')

  // Carol replicated Alice's log (the ciphertext envelope) but sees no
  // conversation and cannot decrypt anything
  const carolHasDmEnvelope = await carol.page.evaluate(async () => {
    const req = indexedDB.open('shabaka', 1)
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error as Error)
    })
    const all = await new Promise<Array<{ type: string }>>((resolve, reject) => {
      const get = db.transaction('messages').objectStore('messages').getAll()
      get.onsuccess = () => resolve(get.result as Array<{ type: string }>)
      get.onerror = () => reject(get.error as Error)
    })
    db.close()
    return all.some((m) => m.type === 'dm')
  })
  expect(carolHasDmEnvelope).toBe(true)

  await carol.page.getByRole('button', { name: 'DMs' }).click()
  await expect(carol.page.locator('.dm-list li')).toHaveCount(0)

  await alice.ctx.close()
  await bob.ctx.close()
  await carol.ctx.close()
})
