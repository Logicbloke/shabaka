import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

export async function newPeer(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/')
  return { ctx, page }
}

/** Create a fresh identity, skipping the passphrase. Returns the pubkey. */
export async function onboard(page: Page, name?: string): Promise<string> {
  await page.getByRole('button', { name: 'Create a new identity' }).click()
  await page.getByRole('button', { name: 'I saved it — continue' }).click()
  await page.getByRole('button', { name: 'Skip and start' }).click()
  await expect(page.getByRole('button', { name: 'Feed' })).toBeVisible()

  const pubkey = await getOwnPubkey(page)
  if (name) {
    await page.getByRole('button', { name: 'Me', exact: true }).click()
    await page.getByRole('button', { name: 'Edit profile' }).click()
    await page.getByPlaceholder('Display name').fill(name)
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('button', { name: 'Feed' }).click()
  }
  return pubkey
}

export async function getOwnPubkey(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Me', exact: true }).click()
  const key = (await page.locator('code.pubkey').first().textContent())?.trim()
  if (!key || key.length !== 43) throw new Error(`bad pubkey read: ${key}`)
  await page.getByRole('button', { name: 'Feed' }).click()
  return key
}

export async function follow(page: Page, pubkey: string): Promise<void> {
  await page.getByRole('button', { name: 'Follows' }).click()
  await page.getByPlaceholder('Paste a public key to follow').fill(pubkey)
  await page.getByRole('button', { name: 'Follow', exact: true }).click()
  await expect(page.locator('.follow-list li')).toHaveCount(1)
  await page.getByRole('button', { name: 'Feed' }).click()
}

export async function post(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: 'Feed' }).click()
  await page.getByPlaceholder("What's happening?").fill(text)
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(page.locator('.post-text', { hasText: text })).toBeVisible()
}

/** Read a value out of the app's IndexedDB from the page context. */
export function headSeq(page: Page, author: string): Promise<number | null> {
  return page.evaluate(async (authorKey) => {
    const req = indexedDB.open('shabaka', 1)
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error as Error)
    })
    const head = await new Promise<{ seq: number } | undefined>((resolve, reject) => {
      const get = db.transaction('heads').objectStore('heads').get(authorKey)
      get.onsuccess = () => resolve(get.result as { seq: number } | undefined)
      get.onerror = () => reject(get.error as Error)
    })
    db.close()
    return head?.seq ?? null
  }, author)
}
