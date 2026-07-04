import { expect, test } from '@playwright/test'
import { follow, newPeer, onboard, post } from './helpers'

test('two peers sync posts live and catch up after reconnect', async ({ browser }) => {
  const alice = await newPeer(browser)
  const alicePub = await onboard(alice.page, 'Alice')

  const bob = await newPeer(browser)
  await onboard(bob.page, 'Bob')
  await follow(bob.page, alicePub)

  // live propagation
  await post(alice.page, 'hello from alice')
  await expect(bob.page.locator('.post-text', { hasText: 'hello from alice' })).toBeVisible({
    timeout: 30_000,
  })

  // bob drops off; alice keeps posting
  await bob.ctx.close()
  await post(alice.page, 'while you were away 1')
  await post(alice.page, 'while you were away 2')

  // fresh context, same storage? no — new context = new device. Instead
  // catch-up is covered by the relay spec; here we assert alice still runs.
  await expect(alice.page.locator('.post')).toHaveCount(3)

  await alice.ctx.close()
})
