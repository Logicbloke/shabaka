import { expect, test } from '@playwright/test'
import { follow, newPeer, onboard } from './helpers'

// The PWA app-icon badge (navigator.setAppBadge) isn't observable from
// Playwright, but the badge module mirrors the same count into document.title,
// so we assert on that.
test('unread notifications show a badge count that clears when the view is opened', async ({
  browser,
}) => {
  const alice = await newPeer(browser)
  const alicePub = await onboard(alice.page, 'Alice')

  const bob = await newPeer(browser)
  const bobPub = await onboard(bob.page, 'Bob')
  // Bob follows Alice so he replicates her log (which carries the DM).
  await follow(bob.page, alicePub)

  // Bob is sitting on the Feed; nothing unread yet.
  await expect(bob.page).toHaveTitle('Shabaka')

  // Alice DMs Bob.
  await alice.page.getByRole('button', { name: 'DMs' }).click()
  await alice.page.getByPlaceholder('Start a conversation: paste a public key').fill(bobPub)
  await alice.page.getByRole('button', { name: 'Open' }).click()
  await alice.page.getByPlaceholder('Encrypted message…').fill('meet at the fountain at 6')
  await alice.page.getByRole('button', { name: 'Send' }).click()

  // The DM arrives while Bob is on the Feed → it counts as unread and the tab
  // title picks up the badge count.
  await expect(bob.page).toHaveTitle(/^\(1\) Shabaka$/, { timeout: 30_000 })

  // Opening the DMs view clears the DM category → badge goes away.
  await bob.page.getByRole('button', { name: 'DMs' }).click()
  await expect(bob.page).toHaveTitle('Shabaka')

  await alice.ctx.close()
  await bob.ctx.close()
})
