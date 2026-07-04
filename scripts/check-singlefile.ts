import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error' && !/WebSocket|net::|Failed to fetch/.test(m.text())) errors.push(m.text())
})

await page.goto('file:///home/taha/shabaka/dist-single/shabaka.html')
await page.getByRole('button', { name: 'Create a new identity' }).waitFor({ timeout: 15000 })
await page.getByRole('button', { name: 'Create a new identity' }).click()
await page.getByRole('button', { name: 'I saved it — continue' }).click()
await page.getByRole('button', { name: 'Skip and start' }).click()
await page.getByRole('button', { name: 'Feed' }).waitFor({ timeout: 15000 })

// post something to prove IndexedDB works on file://
await page.getByPlaceholder("What's happening?").fill('running from a double-clicked file')
await page.getByRole('button', { name: 'Post', exact: true }).click()
await page.locator('.post-text').first().waitFor({ timeout: 10000 })

// arabic toggle works too
await page.locator('.lang-toggle').click()
await page.getByRole('button', { name: 'الخط الزمني' }).waitFor({ timeout: 5000 })
const dir = await page.evaluate(() => document.documentElement.dir)

console.log('dir after toggle:', dir)
console.log('console/page errors:', errors.length ? errors : 'none')
console.log(dir === 'rtl' && errors.length === 0 ? 'SINGLE FILE OK' : 'PROBLEMS FOUND')
await browser.close()
