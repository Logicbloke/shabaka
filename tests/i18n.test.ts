import { describe, expect, it } from 'vitest'
import { ar, en, translate, translateError } from '../src/ui/i18n'

describe('i18n', () => {
  it('arabic covers exactly the english key set', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort())
  })

  it('has no empty translations', () => {
    for (const [k, v] of Object.entries(ar)) expect(v, k).not.toBe('')
    for (const [k, v] of Object.entries(en)) expect(v, k).not.toBe('')
  })

  it('interpolates params', () => {
    expect(translate('en', 'peersMany', { n: 3 })).toBe('3 peers')
    expect(translate('ar', 'peersMany', { n: 3 })).toContain('3')
  })

  it('keeps placeholders consistent across languages', () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      const enParams = (en[key].match(/\{\w+\}/g) ?? []).sort()
      const arParams = (ar[key].match(/\{\w+\}/g) ?? []).sort()
      expect(arParams, key).toEqual(enParams)
    }
  })

  it('translates known core error messages, passes unknown through', () => {
    expect(translateError('ar', 'wrong passphrase')).toBe(ar.errWrongPassphrase)
    expect(translateError('en', 'wrong passphrase')).toBe(en.errWrongPassphrase)
    expect(translateError('ar', 'something else')).toBe('something else')
  })
})
