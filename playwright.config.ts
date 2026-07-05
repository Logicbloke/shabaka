import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    // A fake camera + auto-granted permission so the QR scanner can be driven
    // headlessly (localhost is a secure context, so getUserMedia is available).
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  webServer: {
    command: 'bun run dev',
    port: 5173,
    reuseExistingServer: true,
    env: {
      // deterministic offline testing: mqtt strategy only, local broker
      VITE_STRATEGIES: 'mqtt',
      VITE_LOCAL_BROKER: '1',
    },
  },
})
