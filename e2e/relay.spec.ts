import { expect, test } from '@playwright/test'
import { follow, headSeq, newPeer, onboard, post } from './helpers'

test('Bob relays offline Alice’s posts to Carol (store-and-forward)', async ({ browser }) => {
  // Alice and Bob online together
  const alice = await newPeer(browser)
  const alicePub = await onboard(alice.page, 'Alice')

  const bob = await newPeer(browser)
  await onboard(bob.page, 'Bob')
  await follow(bob.page, alicePub)

  await post(alice.page, 'signed post one')
  await post(alice.page, 'signed post two')
  await expect(bob.page.locator('.post-text', { hasText: 'signed post two' })).toBeVisible({
    timeout: 30_000,
  })

  // Alice disappears entirely
  await alice.ctx.close()

  // Carol arrives; only Bob is online. She follows Alice by key.
  const carol = await newPeer(browser)
  await onboard(carol.page, 'Carol')
  await follow(carol.page, alicePub)

  // Bob must relay Alice's signed log — Carol never met Alice
  await expect(carol.page.locator('.post-text', { hasText: 'signed post one' })).toBeVisible({
    timeout: 30_000,
  })
  await expect(carol.page.locator('.post-text', { hasText: 'signed post two' })).toBeVisible()

  // Carol's head for Alice is seq 3 (profile + 2 posts), fully chain-validated
  expect(await headSeq(carol.page, alicePub)).toBe(3)

  await bob.ctx.close()
  await carol.ctx.close()
})
