import { expect, test } from '@playwright/test'
import { newPeer } from './helpers'

/** Create an identity encrypted with a passphrase, choosing "stay signed in". */
async function onboardEncrypted(page: import('@playwright/test').Page, remember: string | null) {
  await page.getByRole('button', { name: 'Create a new identity' }).click()
  await page.getByRole('button', { name: 'I saved it — continue' }).click()
  await page.getByPlaceholder('Passphrase (leave empty to skip)').fill('correct horse battery')
  if (remember) {
    await page.getByLabel('Stay signed in on this device').selectOption({ label: remember })
  }
  await page.getByRole('button', { name: 'Encrypt and start' }).click()
  await expect(page.getByRole('button', { name: 'Feed' })).toBeVisible()
}

test('reload requires the passphrase when not staying signed in', async ({ browser }) => {
  const { page } = await newPeer(browser)
  await onboardEncrypted(page, null)

  await page.reload()
  // Back to the locked screen — passphrase field is present.
  await expect(page.getByPlaceholder('Passphrase')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Feed' })).toBeHidden()
})

test('reload skips the passphrase while a session is active, then ends on sign-out', async ({
  browser,
}) => {
  const { page } = await newPeer(browser)
  await onboardEncrypted(page, '1 day')

  // Reload lands straight in the app, no passphrase prompt.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Feed' })).toBeVisible()
  await expect(page.getByPlaceholder('Passphrase')).toBeHidden()

  // Security page reports the active session; signing out reloads to locked.
  await page.getByRole('button', { name: 'Security' }).click()
  await expect(page.locator('.security')).toContainText('stays unlocked')
  await page.getByRole('button', { name: 'Sign out of this device now' }).click()

  await expect(page.getByPlaceholder('Passphrase')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Feed' })).toBeHidden()
})
