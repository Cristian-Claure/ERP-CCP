import { describe, expect, it } from 'vitest'

import { customerFormSchema, salesFormSchema, toCustomerPayload, toSalesPayload } from './schemas'

const customer = {
  document_type: 'nit' as const,
  document_number: '1020304050',
  complement: '',
  name: 'Comercial Andina S.R.L.',
  email: '',
  phone: '',
  address: '',
  city: 'Santa Cruz de la Sierra',
  department: 'Santa Cruz',
  country: 'bo',
  latitude: '-17,783327',
  longitude: '-63.18214',
  payment_terms: 'credit' as const,
  credit_days: '30',
  credit_limit: '5.000,50',
  segment: 'wholesale' as const,
  is_active: true,
  notes: '',
}

describe('customerFormSchema', () => {
  it('normalizes the decimal comma and builds the payload', () => {
    const parsed = customerFormSchema.parse(customer)
    const payload = toCustomerPayload(parsed)
    expect(payload).toMatchObject({
      latitude: '-17.783327',
      credit_limit: '5000.50',
      credit_days: 30,
      country: 'BO',
      complement: null,
    })
  })

  it('requires the complement and credit conditions when applicable', () => {
    const result = customerFormSchema.safeParse({
      ...customer,
      document_type: 'ci_complement',
      credit_days: '',
      credit_limit: '',
    })
    expect(result.success).toBe(false)
    const paths = result.error!.issues.map((i) => i.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['complement', 'credit_days', 'credit_limit']))
  })

  it('rejects a half-set location and out-of-range coordinates', () => {
    expect(customerFormSchema.safeParse({ ...customer, longitude: '' }).success).toBe(false)
    expect(customerFormSchema.safeParse({ ...customer, latitude: '95' }).success).toBe(false)
  })

  it('drops credit conditions for cash customers', () => {
    const payload = toCustomerPayload(customerFormSchema.parse({ ...customer, payment_terms: 'cash' }))
    expect(payload.credit_days).toBeNull()
    expect(payload.credit_limit).toBeNull()
  })
})

describe('salesFormSchema', () => {
  const sale = {
    type: 'invoice' as const,
    customer_id: 1,
    warehouse_id: 2,
    document_date: '2026-11-21',
    valid_until: '',
    payment_terms: 'cash' as const,
    payment_method: 'qr' as const,
    global_discount: '',
    reference: '',
    notes: '',
    lines: [
      { product_id: 5, allows_decimals: false, quantity: '2', unit_price: '12,50', discount_amount: '' },
    ],
  }

  it('builds the API payload', () => {
    expect(toSalesPayload(salesFormSchema.parse(sale))).toMatchObject({
      payment_method: 'qr',
      global_discount: '0',
      lines: [{ product_id: 5, quantity: '2', unit_price: '12.50', discount_amount: '0' }],
    })
  })

  it('rejects decimals for whole units and missing prices', () => {
    const result = salesFormSchema.safeParse({
      ...sale,
      lines: [{ ...sale.lines[0], quantity: '1.5', unit_price: '' }],
    })
    expect(result.success).toBe(false)
    expect(result.error!.issues.map((i) => i.path.join('.'))).toEqual(
      expect.arrayContaining(['lines.0.quantity', 'lines.0.unit_price']),
    )
  })

  it('omits the payment method on credit sales', () => {
    expect(
      toSalesPayload(salesFormSchema.parse({ ...sale, payment_terms: 'credit' })).payment_method,
    ).toBeNull()
  })
})
