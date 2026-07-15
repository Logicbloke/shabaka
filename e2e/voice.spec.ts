import { expect, test } from '@playwright/test'
import { follow, newPeer, onboard } from './helpers'

// The fake media device (--use-fake-device-for-media-stream) supplies an audio
// track, so MediaRecorder produces a real webm/opus clip we can chunk + sync.
test('records a voice message that syncs to a follower', async ({ browser }) => {
  const alice = await newPeer(browser)
  const alicePub = await onboard(alice.page, 'Alice')

  const bob = await newPeer(browser)
  await onboard(bob.page, 'Bob')
  await follow(bob.page, alicePub)

  // record ~1.5s, stop, then post the clip from the preview
  await alice.page.getByRole('button', { name: 'Record a voice message' }).click()
  await expect(alice.page.getByRole('button', { name: 'Stop' })).toBeVisible()
  await alice.page.waitForTimeout(1500)
  await alice.page.getByRole('button', { name: 'Stop' }).click()
  await alice.page.getByRole('button', { name: 'Post voice' }).click()

  // alice sees her own voice post play
  await expect(alice.page.locator('.voice-player audio')).toBeVisible()

  // it reassembles (manifest + all chunks) on the follower
  await expect(bob.page.locator('.voice-player audio')).toBeVisible({ timeout: 30_000 })

  await alice.ctx.close()
  await bob.ctx.close()
})
