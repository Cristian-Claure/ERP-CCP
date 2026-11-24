import type { PosProduct } from '../types'
import { addProduct, addQty, cartTotals, overStock, removeLine, setQuantity, stepQuantity } from './cart'

const product = (id: number, over: Partial<PosProduct> = {}): PosProduct => ({
  id,
  sku: `SKU-${id}`,
  barcode: `77900000000${id}`,
  name: `Producto ${id}`,
  category_id: 1,
  category: 'Abarrotes',
  unit: 'UND',
  allows_decimals: false,
  sale_price: '10.50',
  min_price: null,
  stock: '5.0000',
  ...over,
})

describe('POS cart', () => {
  it('adds a product and sums a second scan into the same line', () => {
    let cart = addProduct([], product(1))
    cart = addProduct(cart, product(2))
    cart = addProduct(cart, product(1))
    expect(cart.map((l) => [l.productId, l.quantity, l.unitPrice])).toEqual([
      [1, '2', '10.50'],
      [2, '1', '10.50'],
    ])
  })

  it('handles fractional quantities exactly (kg, litros)', () => {
    const kg = product(3, { unit: 'KG', allows_decimals: true })
    let cart = addProduct([], kg, '0.25')
    cart = addProduct(cart, kg, '0.1')
    expect(cart[0].quantity).toBe('0.35')
    expect(addQty('0.1', '0.2')).toBe('0.3')
    expect(setQuantity(cart, 0, '1.125')[0].quantity).toBe('1.125')
  })

  it('rejects decimals for whole units and never drops below one unit with −', () => {
    const cart = addProduct([], product(1))
    expect(setQuantity(cart, 0, '1.5')).toBe(cart)
    expect(setQuantity(cart, 0, '0')).toBe(cart)
    expect(setQuantity(cart, 0, 'abc')).toBe(cart)
    expect(stepQuantity(cart, 0, -1)).toBe(cart)
    expect(stepQuantity(cart, 0, 1)[0].quantity).toBe('2')
  })

  it('removes lines and computes totals with VAT included (same algorithm as the server)', () => {
    let cart = addProduct(addProduct([], product(1)), product(2, { sale_price: '3.33' }))
    cart = setQuantity(cart, 1, '3')
    const totals = cartTotals(cart, '0', true)
    expect(totals.total).toBe(20.49)
    expect(totals.vat).toBe(2.66)
    expect(totals.net).toBe(17.83)
    expect(removeLine(cart, 0).map((l) => l.productId)).toEqual([2])
  })

  it('flags products whose requested quantity exceeds the warehouse stock', () => {
    const cart = setQuantity(addProduct([], product(1)), 0, '6')
    expect([...overStock(cart, () => '5.0000')]).toEqual([1])
    expect(overStock(cart, () => '6.0000').size).toBe(0)
  })
})
