import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Strict CSP is injected only into production builds: the dev server needs
// inline scripts for React refresh, and localhost is not the threat surface.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' ws: wss:",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
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

// GitHub Pages serves project sites from /<repo>/ — CI sets BASE_PATH
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
export default defineConfig({
  base: env?.BASE_PATH ?? '/',
  plugins: [react(), injectCsp()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
