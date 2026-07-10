import { expect, test } from '@playwright/test'
import { follow, newPeer, onboard, post } from './helpers'

test('likes and replies to my post show as notifications; a live like toasts on the feed', async ({
  browser,
}) => {
  const alice = await newPeer(browser)
  const alicePub = await onboard(alice.page, 'Alice')

  const bob = await newPeer(browser)
  const bobPub = await onboard(bob.page, 'Bob')

  // Mutual follow so each peer replicates the other's log (Alice needs Bob's
  // log to ever see his like/reply).
  await follow(alice.page, bobPub)
  await follow(bob.page, alicePub)

  // Alice posts; Bob replicates it.
  await post(alice.page, 'hello world')
  await expect(bob.page.locator('.post-text', { hasText: 'hello world' })).toBeVisible({
    timeout: 30_000,
  })

  // Alice waits on the Feed so an incoming like will toast.
  await alice.page.getByRole('button', { name: 'Feed' }).click()

  // Bob likes Alice's post.
  await bob.page
    .locator('.post', { hasText: 'hello world' })
    .getByRole('button', { name: '👍' })
    .click()

  // Alice sees a live toast for the like, with an excerpt of her post.
  const toast = alice.page.locator('.toast')
  await expect(toast).toContainText('liked your post', { timeout: 30_000 })
  await expect(toast).toContainText('hello world')

  // The like is also listed on Alice's notifications page.
  await alice.page.getByRole('button', { name: 'Notifications' }).click()
  await expect(alice.page.locator('.notif')).toHaveCount(1)
  await expect(alice.page.locator('.notif').first()).toContainText('liked your post')

  // Bob opens the thread and replies to Alice's post.
  await bob.page
    .locator('.post', { hasText: 'hello world' })
    .getByRole('button', { name: /💬/ })
    .click()
  await bob.page.getByRole('button', { name: 'Reply', exact: true }).click()
  await bob.page.getByPlaceholder('Write a reply…').fill('great post!')
  await bob.page.getByRole('button', { name: 'Reply', exact: true }).click()

  // Alice's notifications now show the reply on top (newest first).
  await expect(alice.page.locator('.notif')).toHaveCount(2, { timeout: 30_000 })
  const top = alice.page.locator('.notif').first()
  await expect(top).toContainText('replied to your post')
  await expect(top).toContainText('great post!')

  await alice.ctx.close()
  await bob.ctx.close()
})
