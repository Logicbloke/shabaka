import { expect, test } from '@playwright/test'
import { follow, newPeer, onboard } from './helpers'

test('voice DM decrypts only for the recipient (and sender)', async ({ browser }) => {
  const alice = await newPeer(browser)
  const alicePub = await onboard(alice.page, 'Alice')

  const bob = await newPeer(browser)
  const bobPub = await onboard(bob.page, 'Bob')
  await follow(bob.page, alicePub)

  const carol = await newPeer(browser)
  await onboard(carol.page, 'Carol')
  await follow(carol.page, alicePub) // replicates the ciphertext but can't read it

  // Alice records a voice DM to Bob
  await alice.page.getByRole('button', { name: 'DMs' }).click()
  await alice.page.getByPlaceholder('Start a conversation: paste a public key').fill(bobPub)
  await alice.page.getByRole('button', { name: 'Open' }).click()
  await alice.page.getByRole('button', { name: 'Record a voice message' }).click()
  await expect(alice.page.getByRole('button', { name: 'Stop' })).toBeVisible()
  await alice.page.waitForTimeout(1500)
  await alice.page.getByRole('button', { name: 'Stop' }).click()
  await alice.page.getByRole('button', { name: 'Post voice' }).click()

  // Alice can play back her own sent clip
  await expect(alice.page.locator('.dm.mine .voice-player audio')).toBeVisible()

  // Bob receives and decrypts it
  await bob.page.getByRole('button', { name: 'DMs' }).click()
  await expect(bob.page.locator('.dm-list li')).toHaveCount(1, { timeout: 30_000 })
  await bob.page.locator('.dm-list li').click()
  await expect(bob.page.locator('.dm.theirs .voice-player audio')).toBeVisible({ timeout: 30_000 })

  // Carol replicated the ciphertext chunks but sees no conversation
  await carol.page.getByRole('button', { name: 'DMs' }).click()
  await expect(carol.page.locator('.dm-list li')).toHaveCount(0)

  await alice.ctx.close()
  await bob.ctx.close()
  await carol.ctx.close()
})
