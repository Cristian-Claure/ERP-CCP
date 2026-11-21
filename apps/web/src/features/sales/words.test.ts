import { describe, expect, it } from 'vitest'

import { amountInWords, integerToWords } from './words'

describe('amountInWords', () => {
  it.each([
    [0, 'cero'],
    [1, 'uno'],
    [16, 'dieciséis'],
    [21, 'veintiuno'],
    [45, 'cuarenta y cinco'],
    [100, 'cien'],
    [101, 'ciento uno'],
    [999, 'novecientos noventa y nueve'],
    [1000, 'un mil'],
    [1250, 'un mil doscientos cincuenta'],
    [21000, 'veintiún mil'],
    [500000, 'quinientos mil'],
    [1_000_000, 'un millón'],
    [2_345_678, 'dos millones trescientos cuarenta y cinco mil seiscientos setenta y ocho'],
  ])('%i → %s', (n, words) => {
    expect(integerToWords(n)).toBe(words)
  })

  it('formats the cents as NN/100 and capitalizes', () => {
    expect(amountInWords(1250.5)).toBe('Un mil doscientos cincuenta 50/100 Bolivianos')
    expect(amountInWords(0.07)).toBe('Cero 07/100 Bolivianos')
  })
})
