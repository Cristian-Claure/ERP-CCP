import type { PosProduct } from '../types'

/** Lowercase without accents: "Azúcar" → "azucar". */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

interface Entry {
  product: PosProduct
  haystack: string
}

export interface ProductIndex {
  /** Exact barcode or SKU (case-insensitive), the scanner's path. */
  byCode: (code: string) => PosProduct | undefined
  /** Every token must appear in name/SKU/barcode; exact code matches first. */
  search: (term: string, opts?: { categoryId?: number | null; limit?: number }) => PosProduct[]
}

/** In-memory index over the cached catalog: instantaneous search, no request per keystroke. */
export function buildProductIndex(products: PosProduct[]): ProductIndex {
  const entries: Entry[] = products.map((p) => ({
    product: p,
    haystack: normalize(`${p.name} ${p.sku} ${p.barcode ?? ''}`),
  }))
  const codes = new Map<string, PosProduct>()
  for (const p of products) {
    codes.set(normalize(p.sku), p)
    if (p.barcode) codes.set(normalize(p.barcode), p)
  }

  return {
    byCode: (code) => codes.get(normalize(code.trim())),
    search(term, { categoryId = null, limit = 60 } = {}) {
      const tokens = normalize(term).split(/\s+/).filter(Boolean)
      const inCategory = (p: PosProduct) => categoryId === null || p.category_id === categoryId
      const exact = tokens.length === 1 ? codes.get(tokens[0]) : undefined
      const out: PosProduct[] = exact && inCategory(exact) ? [exact] : []
      for (const e of entries) {
        if (out.length >= limit) break
        if (e.product === exact || !inCategory(e.product)) continue
        if (tokens.every((t) => e.haystack.includes(t))) out.push(e.product)
      }
      return out
    },
  }
}
