/** Decimal values travel as strings ("12.5000") to keep exact precision. */
export type Decimal = string

export interface Unit {
  id: number
  code: string
  name: string
  allows_decimals: boolean
}

export interface Category {
  id: number
  name: string
  is_active: boolean
}

export interface Warehouse {
  id: number
  code: string
  name: string
  address: string | null
  latitude?: Decimal | null
  longitude?: Decimal | null
  is_active: boolean
}

export interface Product {
  id: number
  sku: string
  barcode: string | null
  name: string
  description: string | null
  min_stock: Decimal
  /** Price list, VAT included (ADR 0005). */
  sale_price: Decimal | null
  min_price: Decimal | null
  is_active: boolean
  unit?: Unit
  category?: Category | null
  stock?: { quantity: Decimal; value: Decimal; below_min: boolean }
  created_at: string
}

export interface WarehouseStock {
  warehouse: Pick<Warehouse, 'id' | 'code' | 'name' | 'is_active'>
  quantity: Decimal
  avg_cost: Decimal
  total_value: Decimal
  updated_at: string | null
}

export type DocumentType = 'entry' | 'exit' | 'transfer' | 'adjustment'
export type DocumentStatus = 'draft' | 'posted' | 'voided'
export type AdjustmentReason = 'shrinkage' | 'expiry' | 'damage' | 'entry_error' | 'other'

export interface DocumentLine {
  id: number
  position: number
  product_id: number
  product?: { id: number; sku: string; name: string; unit: Unit | null }
  quantity: Decimal | null
  counted_quantity: Decimal | null
  system_quantity: Decimal | null
  unit_cost: Decimal | null
  total_cost: Decimal | null
  notes: string | null
}

export interface UserRef {
  id: number
  name: string
}

export interface InventoryDocument {
  id: number
  type: DocumentType
  type_label: string
  status: DocumentStatus
  status_label: string
  number: string | null
  document_date: string
  warehouse_id: number
  destination_warehouse_id: number | null
  warehouse?: Warehouse
  destination_warehouse?: Warehouse | null
  adjustment_reason: AdjustmentReason | null
  adjustment_reason_label: string | null
  reference: string | null
  notes: string | null
  total_cost: Decimal | null
  lines_count?: number
  lines?: DocumentLine[]
  created_by?: UserRef | null
  posted_by?: UserRef | null
  posted_at: string | null
  voided_by?: UserRef | null
  voided_at: string | null
  void_reason: string | null
  created_at: string
  updated_at: string
}

export interface DocumentLinePayload {
  product_id: number
  quantity?: string | null
  counted_quantity?: string | null
  unit_cost?: string | null
  notes?: string | null
}

export interface DocumentPayload {
  type: DocumentType
  warehouse_id: number
  destination_warehouse_id?: number | null
  document_date: string
  adjustment_reason?: AdjustmentReason | null
  reference?: string | null
  notes?: string | null
  lines: DocumentLinePayload[]
}

export interface KardexEntry {
  id: number
  posted_at: string
  document_date: string
  document?: {
    id: number
    number: string | null
    type: DocumentType
    type_label: string
    status: DocumentStatus
  }
  kind: string
  kind_label: string
  is_reversal: boolean
  quantity_in: Decimal | null
  quantity_out: Decimal | null
  unit_cost: Decimal
  total_cost: Decimal
  quantity_after: Decimal
  avg_cost_after: Decimal
  value_after: Decimal
}

export interface KardexMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
  warehouse: { id: number; name: string }
  opening: { quantity: Decimal; avg_cost: Decimal; value: Decimal }
}

export interface StockAvailability {
  product_id: number
  warehouse_id: number
  quantity: Decimal
  avg_cost: Decimal
}

export interface AdjustmentReasonOption {
  value: AdjustmentReason
  label: string
  requires_notes: boolean
}

export interface InventoryDashboard {
  low_stock: {
    count: number
    items: {
      id: number
      sku: string
      name: string
      unit: string | null
      stock: Decimal
      min_stock: Decimal
    }[]
  }
  valuation: {
    total: Decimal
    warehouses: { warehouse_id: number; code: string; name: string; value: Decimal; products: number }[]
  }
}

export interface InventorySettings {
  allow_negative_stock: boolean
  document_backdate_days: number
  document_date_min: string
  document_date_max: string
}

/** Lines of the 422 insufficient_stock error. */
export interface StockShortage {
  product_id: number
  sku: string
  product: string
  warehouse_id: number
  warehouse: string
  available: Decimal
  requested: Decimal
}
