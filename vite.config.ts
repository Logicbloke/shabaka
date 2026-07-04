import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
const SINGLE_FILE = env?.SINGLE_FILE === '1'

// Strict CSP is injected only into production builds: the dev server needs
// inline scripts for React refresh, and localhost is not the threat surface.
// The single-file build inlines all code into index.html, so it must allow
// inline script/style — the file itself is the trust boundary there.
const CSP = [
  "default-src 'self'",
  SINGLE_FILE ? "script-src 'unsafe-inline'" : "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' ws: wss:",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  // no frame-ancestors: it is ignored in <meta> CSP and just logs a warning
].join('; ')

function injectCsp(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<!--csp-->',
        `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
      )
    },
  }
}

/**
 * Inline the bundle and stylesheet into one self-contained shabaka.html that
 * runs from a double-click (file://) — a distribution channel that needs no
 * git, no server, and no install, and can be passed around on a USB stick.
 */
function singleFile(): Plugin {
  return {
    name: 'single-file',
    apply: 'build',
    closeBundle() {
      const dir = 'dist-single'
      let html = readFileSync(join(dir, 'index.html'), 'utf8')
      html = html.replace(
        /<script type="module"[^>]*src="\.?\/?(assets\/[^"]+)"[^>]*><\/script>/,
        (_, asset: string) =>
          `<script type="module">${readFileSync(join(dir, asset), 'utf8')}</script>`,
      )
      html = html.replace(
        /<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+)"[^>]*>/,
        (_, asset: string) => `<style>${readFileSync(join(dir, asset), 'utf8')}</style>`,
      )
      writeFileSync(join(dir, 'shabaka.html'), html)
      rmSync(join(dir, 'assets'), { recursive: true, force: true })
      rmSync(join(dir, 'index.html'))
    },
  }
}

export default defineConfig({
  base: SINGLE_FILE ? './' : (env?.BASE_PATH ?? '/'),
  plugins: [react(), injectCsp(), ...(SINGLE_FILE ? [singleFile()] : [])],
  build: SINGLE_FILE
    ? {
        outDir: 'dist-single',
        cssCodeSplit: false,
        assetsInlineLimit: 1024 * 1024 * 100,
        modulePreload: false,
      }
    : undefined,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
