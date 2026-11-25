import { create } from 'zustand'

import { addProduct, removeLine, setLine, setQuantity, stepQuantity } from './lib/cart'
import type { CartLine, PosCustomerInput, PosDocumentType, PosProduct } from './types'

interface PosState {
  lines: CartLine[]
  selected: number
  customer: PosCustomerInput | null
  docType: PosDocumentType
  globalDiscount: string
  /** Products the server rejected for stock in the last checkout attempt. */
  shortages: number[]
  add: (product: PosProduct, quantity?: string) => void
  setQuantity: (index: number, quantity: string) => void
  step: (index: number, delta: 1 | -1) => void
  setLine: (index: number, patch: Partial<Pick<CartLine, 'unitPrice' | 'discount'>>) => void
  remove: (index: number) => void
  select: (index: number) => void
  setCustomer: (customer: PosCustomerInput | null) => void
  setDocType: (type: PosDocumentType) => void
  setGlobalDiscount: (value: string) => void
  setShortages: (productIds: number[]) => void
  clear: () => void
}

const initial = {
  lines: [] as CartLine[],
  selected: -1,
  customer: null,
  docType: 'sales_note' as PosDocumentType,
  globalDiscount: '0',
  shortages: [] as number[],
}

/** Counter cart (UI state, Zustand). Pure operations live in lib/cart.ts. */
export const usePosStore = create<PosState>()((set) => ({
  ...initial,
  add: (product, quantity = '1') =>
    set((s) => {
      const lines = addProduct(s.lines, product, quantity)
      return { lines, selected: lines.findIndex((l) => l.productId === product.id), shortages: [] }
    }),
  setQuantity: (index, quantity) => set((s) => ({ lines: setQuantity(s.lines, index, quantity) })),
  step: (index, delta) => set((s) => ({ lines: stepQuantity(s.lines, index, delta) })),
  setLine: (index, patch) => set((s) => ({ lines: setLine(s.lines, index, patch) })),
  remove: (index) =>
    set((s) => {
      const lines = removeLine(s.lines, index)
      return { lines, selected: Math.min(s.selected, lines.length - 1) }
    }),
  select: (selected) => set({ selected }),
  setCustomer: (customer) => set({ customer }),
  setDocType: (docType) => set({ docType }),
  setGlobalDiscount: (globalDiscount) => set({ globalDiscount }),
  setShortages: (shortages) => set({ shortages }),
  clear: () => set(initial),
}))
