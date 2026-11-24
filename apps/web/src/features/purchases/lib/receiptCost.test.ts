import { previewReceiptCost, variancePct } from './receiptCost'

// Same example as apps/api/tests/Unit/Purchases/PurchaseCostCalculatorTest.php: client and server agree.
const lines = [
  { quantity: '10', unitPrice: '11.30' },
  { quantity: '3', unitPrice: '7.00' },
  { quantity: '7', unitPrice: '1.43' },
]

describe('receipt cost preview', () => {
  it('with invoice: VAT por dentro as fiscal credit, freight prorated by value', () => {
    const r = previewReceiptCost(lines, ['50.00', '10.00'], true)
    expect(r.invoiceTotal).toBe(144.01)
    expect(r.vatCredit).toBe(18.72)
    expect(r.lines.map((l) => l.vat)).toEqual([14.69, 2.73, 1.3])
    expect(r.lines.map((l) => l.net)).toEqual([98.31, 18.27, 8.71])
    expect(r.lines.map((l) => l.additional)).toEqual([47.08, 8.75, 4.17])
    expect(r.lines.map((l) => l.unitCost)).toEqual([14.539, 9.0067, 1.84])
    expect(r.costTotal).toBe(185.29)
  })

  it('without invoice: the cost is the total paid', () => {
    const r = previewReceiptCost(lines, [], false)
    expect(r.vatCredit).toBe(0)
    expect(r.lines.map((l) => l.costTotal)).toEqual([113, 21, 10.01])
  })

  it('measures the price variance', () => {
    expect(variancePct('11.80', '11.30')).toBe(4.42)
    expect(variancePct('1', '0')).toBe(0)
  })
})
