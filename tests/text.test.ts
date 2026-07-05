import { describe, expect, it } from 'vitest'
import { cleanText } from '../src/ui/text'

// escape-built inputs: literal bidi/C0 characters do not belong in source
const RLO = '\u202E'
const LRE = '\u202A'
const FSI = '\u2068'
const PDI = '\u2069'

describe('cleanText', () => {
  it('strips bidi override/embedding/isolate controls', () => {
    expect(cleanText(`evil${RLO}txt.example`)).toBe('eviltxt.example')
    expect(cleanText(LRE + FSI + PDI)).toBe('')
  })

  it('strips C0/C1 controls but keeps newline and tab', () => {
    expect(cleanText('a\u0008b\u009Fcd')).toBe('abcd')
    expect(cleanText('line1\nline2\tend')).toBe('line1\nline2\tend')
  })

  it('leaves normal multilingual text alone', () => {
    expect(cleanText('\u0645\u0631\u062D\u0628\u0627 hello \uD83D\uDC4D')).toBe('\u0645\u0631\u062D\u0628\u0627 hello \uD83D\uDC4D')
  })
})
