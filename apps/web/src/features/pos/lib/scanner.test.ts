import type { PosProduct } from '../types'
import { createScannerDetector } from './scanner'
import { buildProductIndex, normalize } from './search'

const type = (
  detector: ReturnType<typeof createScannerDetector>,
  text: string,
  start: number,
  gap: number,
) => {
  let t = start
  let result: string | null = null
  for (const ch of [...text, 'Enter']) {
    result = detector.feed(ch, t)
    t += gap
  }
  return result
}

describe('barcode scanner detector', () => {
  it('detects a fast burst ending in Enter', () => {
    expect(type(createScannerDetector(), '7790000000011', 0, 8)).toBe('7790000000011')
  })

  it('ignores human typing and short bursts', () => {
    expect(type(createScannerDetector(), 'arroz', 0, 120)).toBeNull()
    expect(type(createScannerDetector(), '123', 0, 5)).toBeNull()
  })

  it('starts a new burst after a pause (human prefix + scan)', () => {
    const d = createScannerDetector()
    d.feed('a', 0)
    d.feed('b', 300)
    expect(type(d, '7790000000028', 1000, 10)).toBe('7790000000028')
  })

  it('resets on non-printable keys', () => {
    const d = createScannerDetector()
    for (const [i, ch] of [...'77900'].entries()) d.feed(ch, i * 5)
    d.feed('Shift', 30)
    expect(d.feed('Enter', 35)).toBeNull()
  })
})

describe('local product search', () => {
  const p = (id: number, name: string, sku: string, barcode: string | null, category_id = 1): PosProduct => ({
    id,
    name,
    sku,
    barcode,
    category_id,
    category: null,
    unit: 'UND',
    allows_decimals: false,
    sale_price: '1.00',
    min_price: null,
    stock: '1',
  })
  const index = buildProductIndex([
    p(1, 'Azúcar blanca', 'ABA-002', '7771'),
    p(2, 'Arroz grano largo', 'ABA-001', '7772'),
    p(3, 'Gaseosa cola 2 L', 'BEB-001', null, 2),
  ])

  it('finds by exact barcode or SKU', () => {
    expect(index.byCode('7772')?.id).toBe(2)
    expect(index.byCode('aba-002')?.id).toBe(1)
    expect(index.byCode('999')).toBeUndefined()
  })

  it('matches every token, accent-insensitive, and filters by category', () => {
    expect(normalize('Azúcar')).toBe('azucar')
    expect(index.search('azucar').map((x) => x.id)).toEqual([1])
    expect(index.search('a').map((x) => x.id)).toEqual([1, 2, 3])
    expect(index.search('aba', { categoryId: 2 })).toEqual([])
    expect(index.search('cola 2').map((x) => x.id)).toEqual([3])
    expect(index.search('BEB-001')[0].id).toBe(3)
  })
})
