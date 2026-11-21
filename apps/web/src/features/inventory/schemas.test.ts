import { documentFormSchema, emptyLine, normalizeDecimal, toDocumentPayload } from './schemas'

const base = {
  warehouse_id: 1,
  destination_warehouse_id: null,
  document_date: '2026-11-20',
  adjustment_reason: null,
  reference: '',
  notes: '',
}

const line = (overrides: Partial<ReturnType<typeof emptyLine>> = {}) => ({
  ...emptyLine(),
  product_id: 7,
  ...overrides,
})

describe('documentFormSchema', () => {
  it('accepts a valid entry and normalizes the decimal comma', () => {
    const result = documentFormSchema.safeParse({
      ...base,
      type: 'entry',
      lines: [line({ quantity: '12', unit_cost: '7,85' })],
    })

    expect(result.success).toBe(true)
    expect(result.data?.lines[0]?.unit_cost).toBe('7.85')
  })

  it('requires a unit cost on entries', () => {
    const result = documentFormSchema.safeParse({ ...base, type: 'entry', lines: [line({ quantity: '1' })] })
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('lines.0.unit_cost')
  })

  it('rejects decimals for non-fractional units but accepts them for kg/l/m', () => {
    const integerUnit = documentFormSchema.safeParse({
      ...base,
      type: 'exit',
      lines: [line({ quantity: '1.5' })],
    })
    expect(integerUnit.error?.issues[0]?.message).toBe('Esta unidad no admite decimales.')

    const fractional = documentFormSchema.safeParse({
      ...base,
      type: 'exit',
      lines: [line({ quantity: '1.25', allows_decimals: true })],
    })
    expect(fractional.success).toBe(true)
  })

  it('requires a different destination for transfers', () => {
    const result = documentFormSchema.safeParse({
      ...base,
      type: 'transfer',
      destination_warehouse_id: 1,
      lines: [line({ quantity: '1' })],
    })
    expect(result.error?.issues[0]?.message).toBe('Debe ser distinto del origen.')
  })

  it('requires reason, counted quantity and notes for "other" adjustments; no repeated products', () => {
    const result = documentFormSchema.safeParse({
      ...base,
      type: 'adjustment',
      adjustment_reason: 'other',
      lines: [line({ counted_quantity: '3' }), line({ counted_quantity: '' })],
    })
    const paths = result.error?.issues.map((i) => i.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['notes', 'lines.1.counted_quantity', 'lines.1.product_id']))
  })

  it('builds the API payload for each type', () => {
    const parsed = documentFormSchema.parse({
      ...base,
      type: 'adjustment',
      adjustment_reason: 'shrinkage',
      lines: [line({ counted_quantity: '0', unit_cost: '' })],
    })
    expect(toDocumentPayload(parsed)).toMatchObject({
      type: 'adjustment',
      destination_warehouse_id: null,
      lines: [{ product_id: 7, quantity: null, counted_quantity: '0', unit_cost: null }],
    })
  })
})

describe('normalizeDecimal', () => {
  it('handles Bolivian and plain formats', () => {
    expect(normalizeDecimal('1.234,56')).toBe('1234.56')
    expect(normalizeDecimal('12,5')).toBe('12.5')
    expect(normalizeDecimal(' 10.25 ')).toBe('10.25')
  })
})
