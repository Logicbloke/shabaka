import { describe, expect, it } from 'vitest'
import jsQR from 'jsqr'
import { qrModules } from '../src/ui/qrcode'

/** Rasterize a QR matrix to RGBA ImageData bytes, dark-on-white with a quiet zone. */
function rasterize(modules: boolean[][], scale = 4, quiet = 4): [Uint8ClampedArray, number] {
  const n = modules.length
  const size = (n + quiet * 2) * scale
  const data = new Uint8ClampedArray(size * size * 4).fill(255)
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!modules[r][c]) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const y = (r + quiet) * scale + dy
          const x = (c + quiet) * scale + dx
          const i = (y * size + x) * 4
          data[i] = data[i + 1] = data[i + 2] = 0
        }
      }
    }
  }
  return [data, size]
}

describe('qrModules', () => {
  it.each([
    'kZ8xY2pQr7wN3mL0aB4cD5eF6gH1jK9sT2uV3wX4yZ0', // 43-char public key shape
    'shabaka-key-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // key backup shape
  ])('encodes a scannable QR that decodes back to the input: %s', (value) => {
    const [data, size] = rasterize(qrModules(value))
    const decoded = jsQR(data, size, size, { inversionAttempts: 'dontInvert' })
    expect(decoded?.data).toBe(value)
  })

  it('produces a square matrix', () => {
    const m = qrModules('hello')
    expect(m.length).toBeGreaterThan(0)
    expect(m.every((row) => row.length === m.length)).toBe(true)
  })
})
