import { describe, expect, it } from 'vitest'

import { computeSalesTotals, prorate, toScaled } from './calc'

const line = (quantity: string, unit_price: string, discount_amount = '0') => ({
  quantity,
  unit_price,
  discount_amount,
})

// Same cases as the API's tests/Unit/Sales/SalesCalculatorTest.php: both must agree to the cent.
describe('computeSalesTotals (mirror of SalesCalculator)', () => {
  it('breaks down VAT included in the price', () => {
    const t = computeSalesTotals([line('1', '113.00')], '0', true)
    expect([t.total, t.vat, t.net]).toEqual([113, 14.69, 98.31])
  })

  it('rounds the document VAT once and distributes it exactly', () => {
    const t = computeSalesTotals([line('1', '33.33'), line('1', '33.33'), line('1', '33.34')], '0', true)
    expect(t.vat).toBe(13)
    expect(t.lines.reduce((s, l) => s + Math.round(l.vat * 100), 0)).toBe(1300)
  })

  it('prorates the global discount with the residual on the last line', () => {
    const t = computeSalesTotals([line('1', '10'), line('1', '10'), line('1', '10')], '10.00', true)
    expect(t.lines.map((l) => l.globalShare)).toEqual([3.33, 3.33, 3.34])
    expect(t.lines.map((l) => l.total)).toEqual([6.67, 6.67, 6.66])
    expect(t.total).toBe(20)
  })

  it('prorates proportionally after line discounts', () => {
    const t = computeSalesTotals([line('2', '50', '10'), line('1', '10')], '7', true)
    expect([t.subtotal, t.lineDiscountTotal, t.total]).toEqual([110, 10, 93])
    expect(t.lines.map((l) => l.globalShare)).toEqual([6.3, 0.7])
  })

  it.each(['0.01', '1.00', '5.55', '13.37', '50.00'])('keeps Σ lines == total for global %s', (global) => {
    const t = computeSalesTotals(
      [line('3', '7.77'), line('1.5', '19.99'), line('7', '0.33'), line('1', '1.01')],
      global,
      true,
    )
    const sumCents = t.lines.reduce((s, l) => s + Math.round(l.total * 100), 0)
    expect(sumCents).toBe(Math.round(t.total * 100))
  })

  it('rounds the extended amount half-up (1.5 × 19.99 = 29.985 → 29.99)', () => {
    expect(computeSalesTotals([line('1.5', '19.99')], '0', true).subtotal).toBe(29.99)
  })

  it('skips the VAT breakdown when not applicable', () => {
    const t = computeSalesTotals([line('1', '113.00')], '0', false)
    expect([t.vat, t.net]).toEqual([0, 113])
  })

  it('reports invalid discounts with the API field keys', () => {
    expect(computeSalesTotals([line('1', '10', '11')], '0', true).errors).toHaveProperty([
      'lines.0.discount_amount',
    ])
    expect(computeSalesTotals([line('1', '10')], '10.01', true).errors).toHaveProperty('global_discount')
  })
})

describe('helpers', () => {
  it('parses decimals into scaled integers with half-up rounding', () => {
    expect(toScaled('12.5', 4)).toBe(125000n)
    expect(toScaled('0.005', 2)).toBe(1n)
    expect(toScaled('abc', 2)).toBeNull()
    expect(toScaled('', 2)).toBe(0n)
  })

  it('prorates skipping zero weights', () => {
    expect(prorate(100n, [1n, 0n, 2n, 0n])).toEqual([33n, 0n, 67n, 0n])
  })
})
