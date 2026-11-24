import { cashSuggestions, summarizePayments } from './payments'

describe('POS payments', () => {
  it('computes change for a cash payment', () => {
    const s = summarizePayments(87.5, [{ method: 'cash', amount: '100' }])
    expect(s).toMatchObject({ cashDue: 87.5, received: 100, change: 12.5, missing: 0, valid: true })
  })

  it('splits a mixed payment: QR applies as is, cash covers the rest with change', () => {
    const s = summarizePayments(40, [
      { method: 'qr', amount: '15.00' },
      { method: 'cash', amount: '30.00' },
    ])
    expect(s).toMatchObject({ nonCash: 15, cashDue: 25, received: 30, change: 5, valid: true })
  })

  it('reports what is missing and rejects non-cash above the total', () => {
    expect(summarizePayments(40, [{ method: 'cash', amount: '39.99' }])).toMatchObject({
      missing: 0.01,
      valid: false,
    })
    expect(summarizePayments(40, [{ method: 'card', amount: '45' }])).toMatchObject({
      excessNonCash: 5,
      valid: false,
    })
    expect(summarizePayments(40, [{ method: 'card', amount: '40' }])).toMatchObject({ change: 0, valid: true })
  })

  it('is exact to the cent (no float drift)', () => {
    const s = summarizePayments(0.3, [
      { method: 'qr', amount: '0.1' },
      { method: 'cash', amount: '0.2' },
    ])
    expect(s).toMatchObject({ change: 0, missing: 0, valid: true })
  })

  it('suggests common bills for the cash due', () => {
    expect(cashSuggestions(87.5)).toEqual([87.5, 90, 100, 200])
    expect(cashSuggestions(0)).toEqual([])
  })
})
