import { expect, test } from '@playwright/test'
import { newPeer, onboard } from './helpers'

test('shows a QR of the public key on the profile', async ({ browser }) => {
  const { page } = await newPeer(browser)
  await onboard(page)

  await page.getByRole('button', { name: 'Me', exact: true }).click()
  const qr = page.locator('.profile svg.qr')
  await expect(qr).toBeHidden()

  await page.getByRole('button', { name: 'Show QR' }).click()
  await expect(qr).toBeVisible()

  await page.getByRole('button', { name: 'Hide QR' }).click()
  await expect(qr).toBeHidden()
})

test('shows the private-key QR behind the reveal gate with a warning', async ({ browser }) => {
  const { page } = await newPeer(browser)
  await onboard(page)

  await page.getByRole('button', { name: 'Security' }).click()
  // Not present until the backup is revealed.
  await expect(page.getByRole('button', { name: 'Show private key as QR' })).toBeHidden()

  await page.getByRole('button', { name: 'Reveal key backup' }).click()
  await page.getByRole('button', { name: 'Show private key as QR' }).click()

  await expect(page.locator('.security svg.qr')).toBeVisible()
  await expect(page.locator('.security .error')).toContainText('becomes you')
})

test('opens and closes the camera scanner from the follows page', async ({ browser }) => {
  const { page } = await newPeer(browser)
  await onboard(page)

  await page.getByRole('button', { name: 'Follows' }).click()
  await page.getByRole('button', { name: 'Scan QR' }).click()

  const overlay = page.locator('.qr-scanner-overlay')
  await expect(overlay).toBeVisible()
  // The fake device provides a real stream, so we land on the video (not error).
  await expect(page.locator('.qr-scanner video')).toBeVisible()

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(overlay).toBeHidden()
})
