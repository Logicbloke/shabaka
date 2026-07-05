import { describe, expect, it } from 'vitest'
import { isNewer, parseVersion } from '../src/ui/version'

describe('parseVersion', () => {
  it('parses plain and prefixed release tags', () => {
    expect(parseVersion('v0.1.0')).toEqual([0, 1, 0])
    expect(parseVersion('0.2.3')).toEqual([0, 2, 3])
  })

  it('parses git-describe output (tag ahead of a commit)', () => {
    expect(parseVersion('v0.1.0-3-gabc1234')).toEqual([0, 1, 0])
    expect(parseVersion('v1.2.3-1-gdeadbee-dirty')).toEqual([1, 2, 3])
  })

  it('returns null for versionless strings', () => {
    expect(parseVersion('unknown')).toBeNull()
    expect(parseVersion('gabc1234')).toBeNull()
    expect(parseVersion('')).toBeNull()
  })
})

describe('isNewer', () => {
  it('is true when the latest release is strictly greater', () => {
    expect(isNewer('v0.2.0', 'v0.1.0')).toBe(true)
    expect(isNewer('v0.1.1', 'v0.1.0')).toBe(true)
    expect(isNewer('v1.0.0', 'v0.9.9')).toBe(true)
  })

  it('is false when equal or older', () => {
    expect(isNewer('v0.1.0', 'v0.1.0')).toBe(false)
    expect(isNewer('v0.1.0', 'v0.2.0')).toBe(false)
  })

  it('treats a build ahead of its tag as not older', () => {
    // local build described as v0.1.0-3-gabc has base 0.1.0; the latest
    // release is still 0.1.0, so no update should be offered.
    expect(isNewer('v0.1.0', 'v0.1.0-3-gabc1234')).toBe(false)
  })

  it('fails safe on unparseable input', () => {
    expect(isNewer('unknown', 'v0.1.0')).toBe(false)
    expect(isNewer('v0.2.0', 'unknown')).toBe(false)
  })
})
