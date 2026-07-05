import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

/**
 * Renders the app icon (a small network graph on the app background color)
 * to the PNG sizes PWA installs need. Run once when the icon changes:
 *   bun scripts/gen-icons.ts
 * Outputs are committed in public/icons/.
 */

// palette from src/ui/styles.css
const BG = '#10141a'
const ACCENT = '#4da3ff'
const EDGE = '#3d6ea8'
const CENTER = '#dbe4f0'

// pentagon of nodes around a hub — "shabaka" means network
const NODES = [
  [50, 20],
  [78.5, 40.7],
  [67.6, 74.3],
  [32.4, 74.3],
  [21.5, 40.7],
] as const

function iconSvg(size: number, opts: { maskable?: boolean; square?: boolean } = {}): string {
  const scale = opts.maskable ? 0.62 : 0.8
  const bg = opts.square || opts.maskable
    ? `<rect width="100" height="100" fill="${BG}"/>`
    : `<rect width="100" height="100" rx="22" fill="${BG}"/>`
  const edges = NODES.map(([x, y], i) => {
    const [nx, ny] = NODES[(i + 1) % NODES.length]!
    return (
      `<line x1="50" y1="50" x2="${x}" y2="${y}" stroke="${EDGE}" stroke-width="3"/>` +
      `<line x1="${x}" y1="${y}" x2="${nx}" y2="${ny}" stroke="${EDGE}" stroke-width="3"/>`
    )
  }).join('')
  const dots = NODES.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${ACCENT}"/>`).join('')
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">` +
    bg +
    `<g transform="translate(50 50) scale(${scale}) translate(-50 -50)">` +
    edges +
    dots +
    `<circle cx="50" cy="50" r="9" fill="${CENTER}"/>` +
    `</g></svg>`
  )
}

mkdirSync('public/icons', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()

const outputs: Array<[string, number, Parameters<typeof iconSvg>[1]]> = [
  ['public/icons/icon-192.png', 192, {}],
  ['public/icons/icon-512.png', 512, {}],
  ['public/icons/maskable-512.png', 512, { maskable: true }],
  ['public/icons/apple-touch-icon.png', 180, { square: true }],
]

for (const [path, size, opts] of outputs) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<!doctype html><body style="margin:0">${iconSvg(size, opts)}</body>`)
  await page.locator('svg').screenshot({ path, omitBackground: true })
  console.log('wrote', path)
}

await browser.close()
