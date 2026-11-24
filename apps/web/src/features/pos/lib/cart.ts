import { computeSalesTotals, toScaled } from '@/features/sales/calc'

import type { CartLine, PosProduct } from '../types'

/**
 * Pure cart operations (immutable). Quantities are decimal strings with a dot;
 * whole-unit products only take integers.
 */

const fromScaled = (n: bigint, scale: number): string => {
  const negative = n < 0n
  const abs = (negative ? -n : n).toString().padStart(scale + 1, '0')
  const int = abs.slice(0, abs.length - scale)
  const frac = abs.slice(abs.length - scale).replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

/** Adds two decimal quantities exactly (4 decimals). */
export function addQty(a: string, b: string): string {
  return fromScaled((toScaled(a, 4) ?? 0n) + (toScaled(b, 4) ?? 0n), 4)
}

export function lineFromProduct(product: PosProduct, quantity = '1'): CartLine {
  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    unit: product.unit,
    allowsDecimals: product.allows_decimals,
    quantity,
    unitPrice: product.sale_price ?? '0',
    discount: '0',
  }
}

/** Adds a product: a second scan of the same product adds to its existing line. */
export function addProduct(cart: CartLine[], product: PosProduct, quantity = '1'): CartLine[] {
  const index = cart.findIndex((l) => l.productId === product.id)
  if (index === -1) return [...cart, lineFromProduct(product, quantity)]
  return cart.map((l, i) => (i === index ? { ...l, quantity: addQty(l.quantity, quantity) } : l))
}

/** Sets a quantity; invalid, zero or negative values remove nothing and are ignored. */
export function setQuantity(cart: CartLine[], index: number, quantity: string): CartLine[] {
  const line = cart[index]
  const scaled = toScaled(quantity, 4)
  if (!line || scaled === null || scaled <= 0n) return cart
  if (!line.allowsDecimals && scaled % 10_000n !== 0n) return cart
  return cart.map((l, i) => (i === index ? { ...l, quantity: fromScaled(scaled, 4) } : l))
}

/** +1 / −1 unit; never goes below one unit (use remove for that). */
export function stepQuantity(cart: CartLine[], index: number, delta: 1 | -1): CartLine[] {
  const line = cart[index]
  if (!line) return cart
  const next = addQty(line.quantity, delta === 1 ? '1' : '-1')
  return (toScaled(next, 4) ?? 0n) > 0n ? setQuantity(cart, index, next) : cart
}

export function setLine(cart: CartLine[], index: number, patch: Partial<Pick<CartLine, 'unitPrice' | 'discount'>>) {
  return cart.map((l, i) => (i === index ? { ...l, ...patch } : l))
}

export function removeLine(cart: CartLine[], index: number): CartLine[] {
  return cart.filter((_, i) => i !== index)
}

/** Totals with the same algorithm as the server (VAT 13 % included, global discount prorated). */
export function cartTotals(cart: CartLine[], globalDiscount: string, breakDownVat: boolean) {
  return computeSalesTotals(
    cart.map((l) => ({ quantity: l.quantity, unit_price: l.unitPrice, discount_amount: l.discount })),
    globalDiscount,
    breakDownVat,
  )
}

/** Units requested per product beyond the stock of the warehouse (for the "sin stock" mark). */
export function overStock(cart: CartLine[], stockOf: (productId: number) => string | undefined): Set<number> {
  const out = new Set<number>()
  for (const l of cart) {
    const stock = toScaled(stockOf(l.productId) ?? '0', 4) ?? 0n
    if ((toScaled(l.quantity, 4) ?? 0n) > stock) out.add(l.productId)
  }
  return out
}
