import { devices, expect, test } from '@playwright/test'
import { newPeer, onboard, post } from './helpers'

test('relative timestamp shows absolute date/time tooltip on hover', async ({ browser }) => {
  const { page } = await newPeer(browser)
  await onboard(page)
  await post(page, 'hello timestamps')

  const time = page.locator('.post .timestamp').first()
  // Visible text is a relative time like "1s ago" / "1m ago".
  await expect(time).toHaveText(/ago/)

  // Tooltip carries the full absolute date+time and is hidden until hover.
  const tip = time.locator('.timestamp-tip')
  await expect(tip).toHaveText(/\d{4}/) // includes the year
  await expect(tip).toBeHidden()

  await time.hover()
  await expect(tip).toBeVisible()
})

test('relative timestamp toggles tooltip on tap (touch, no hover)', async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices['Pixel 5'] })
  const page = await ctx.newPage()
  await page.goto('/')
  await onboard(page)
  await post(page, 'tap me')

  const time = page.locator('.post .timestamp').first()
  const tip = time.locator('.timestamp-tip')
  await expect(tip).toBeHidden()

  // First tap reveals, second tap hides — no hover involved on touch.
  await time.tap()
  await expect(tip).toBeVisible()
  await time.tap()
  await expect(tip).toBeHidden()

  // Tapping outside dismisses an open tooltip.
  await time.tap()
  await expect(tip).toBeVisible()
  await page.locator('.post-text').tap()
  await expect(tip).toBeHidden()

  await ctx.close()
})
