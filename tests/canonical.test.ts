import { describe, expect, it } from 'vitest'
import { canonicalize } from '../src/core/canonical'

describe('canonicalize', () => {
  it('is insensitive to key insertion order', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }))
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
  })

  it('sorts keys recursively in nested structures', () => {
    const a = { outer: { z: 1, a: [{ y: 'x', b: null }] }, first: 'v' }
    const b = { first: 'v', outer: { a: [{ b: null, y: 'x' }], z: 1 } }
    expect(canonicalize(a)).toBe(canonicalize(b))
  })

  it('handles unicode strings via JSON escaping', () => {
    expect(canonicalize({ t: 'héllo 🌍 "quoted"\n' })).toBe(
      '{"t":' + JSON.stringify('héllo 🌍 "quoted"\n') + '}',
    )
  })

  it('serializes safe integers plainly', () => {
    expect(canonicalize(0)).toBe('0')
    expect(canonicalize(-42)).toBe('-42')
    expect(canonicalize(Number.MAX_SAFE_INTEGER)).toBe('9007199254740991')
  })

  it('rejects floats, NaN, huge numbers', () => {
    expect(() => canonicalize(1.5)).toThrow()
    expect(() => canonicalize(NaN)).toThrow()
    expect(() => canonicalize(1e21)).toThrow()
    expect(() => canonicalize({ a: 0.1 })).toThrow()
  })

  it('rejects booleans, undefined, functions', () => {
    expect(() => canonicalize(true)).toThrow()
    expect(() => canonicalize({ a: false })).toThrow()
    expect(() => canonicalize({ a: undefined })).toThrow()
    expect(() => canonicalize(() => 1)).toThrow()
  })

  it('accepts null and arrays', () => {
    expect(canonicalize(null)).toBe('null')
    expect(canonicalize([1, 'a', null])).toBe('[1,"a",null]')
  })
})
