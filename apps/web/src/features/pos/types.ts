import type { PaymentMethod } from '@/features/sales/types'

/** Compact product row of GET /pos/catalog (cached and searched locally). */
export interface PosProduct {
  id: number
  sku: string
  barcode: string | null
  name: string
  category_id: number | null
  category: string | null
  unit: string
  allows_decimals: boolean
  sale_price: string | null
  min_price: string | null
  /** Stock in the POS warehouse ("12.0000"). */
  stock: string
}

export interface CartLine {
  productId: number
  sku: string
  name: string
  unit: string
  allowsDecimals: boolean
  /** Decimal strings with a dot ("1.5"), as the API expects. */
  quantity: string
  unitPrice: string
  discount: string
}

export type PosDocumentType = 'sales_note' | 'invoice'

export interface PosCustomerInput {
  id?: number | null
  document_type?: 'nit' | 'ci'
  document_number?: string
  name?: string
}

export interface Tender {
  method: PaymentMethod
  /** Amount tendered (cash may exceed what is due: change). */
  amount: string
}

export interface PosCheckoutPayload {
  type: PosDocumentType
  warehouse_id: number
  customer: PosCustomerInput | null
  global_discount?: string
  lines: { product_id: number; quantity: string; unit_price: string; discount_amount?: string }[]
  payments: Tender[]
  below_cost_reason?: string
}
