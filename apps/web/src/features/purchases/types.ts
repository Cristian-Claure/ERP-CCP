import type { Aging, PaymentMethod } from '@/features/sales/types'

export type PurchaseOrderStatus = 'draft' | 'approved' | 'partially_received' | 'received' | 'cancelled'
export type ReceiptCostKind = 'freight' | 'unloading' | 'other'

export interface Supplier {
  id: number
  tax_id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  country: string
  city: string | null
  latitude: string | null
  longitude: string | null
  payment_terms_days: number
  payment_terms_label: string
  lead_time_days: number
  issues_invoice: boolean
  is_active: boolean
  notes: string | null
  /** Only with payables.view. */
  balance?: string
  aging?: Aging
}

export type SupplierPayload = Omit<
  Supplier,
  'id' | 'payment_terms_label' | 'balance' | 'aging' | 'latitude' | 'longitude'
> & { latitude: string | null; longitude: string | null }

export interface PurchaseOrderLine {
  id: number
  product_id: number
  product: {
    id: number
    sku: string
    name: string
    unit: { code: string; allows_decimals: boolean } | null
  } | null
  quantity: string
  unit_price: string
  line_total: string
  received_quantity: string
  pending_quantity: string
}

export interface PurchaseOrder {
  id: number
  number: string | null
  status: PurchaseOrderStatus
  status_label: string
  order_date: string
  expected_date: string | null
  total: string
  reference: string | null
  notes: string | null
  supplier_id: number
  supplier?: { id: number; name: string; tax_id: string; issues_invoice: boolean; payment_terms_days: number }
  warehouse_id: number
  warehouse?: { id: number; name: string }
  lines_count?: number
  lines?: PurchaseOrderLine[]
  receipts?: {
    id: number
    number: string
    status: 'posted' | 'voided'
    receipt_date: string
    supplier_invoice_number: string | null
    invoice_total: string
  }[]
  created_by?: { id: number; name: string }
  approved_by?: { id: number; name: string } | null
  approved_at: string | null
  cancel_reason: string | null
  created_at: string
}

export interface PurchaseOrderPayload {
  supplier_id: number
  warehouse_id: number
  order_date: string
  expected_date?: string | null
  reference?: string | null
  notes?: string | null
  lines: { product_id: number; quantity: string; unit_price: string }[]
}

export interface PurchaseReceiptLine {
  id: number
  product: { id: number; sku: string; name: string } | null
  quantity: string
  unit_price: string
  order_unit_price: string
  price_variance_pct: string
  price_variance_flag: boolean
  line_total: string
  vat: string
  net: string
  additional_cost: string
  cost_total: string
  unit_cost: string
}

export interface PurchaseReceipt {
  id: number
  number: string
  status: 'posted' | 'voided'
  receipt_date: string
  supplier_invoice_number: string | null
  supplier_invoice_date: string | null
  issues_invoice: boolean
  invoice_total: string
  vat_credit: string
  net_total: string
  additional_costs_total: string
  cost_total: string
  due_date: string
  paid_amount: string
  open_amount: string
  price_variance_reason: string | null
  notes: string | null
  purchase_order_id: number
  order?: { id: number; number: string | null }
  supplier_id: number
  supplier?: { id: number; name: string }
  warehouse?: { id: number; name: string }
  inventory_document?: { id: number; number: string } | null
  lines?: PurchaseReceiptLine[]
  costs?: { kind: ReceiptCostKind; kind_label: string; description: string | null; amount: string }[]
  created_by?: { id: number; name: string }
  voided_by?: { id: number; name: string } | null
  voided_at: string | null
  void_reason: string | null
}

export interface ReceiptPayload {
  receipt_date: string
  supplier_invoice_number?: string | null
  supplier_invoice_date?: string | null
  price_variance_reason?: string | null
  notes?: string | null
  lines: { purchase_order_line_id: number; quantity: string; unit_price: string }[]
  costs: { kind: ReceiptCostKind; description?: string | null; amount: string }[]
}

export interface SupplierPayment {
  id: number
  number: string
  status: 'posted' | 'voided'
  payment_date: string
  method: PaymentMethod
  method_label: string
  amount: string
  reference: string | null
  supplier_id: number
  supplier?: { id: number; name: string }
  allocations?: { purchase_receipt_id: number; number: string | null; amount: string }[]
}

export interface SupplierPaymentPayload {
  supplier_id: number
  payment_date: string
  method: PaymentMethod
  amount: string
  reference?: string | null
}

export interface PurchaseSuggestion {
  product_id: number
  sku: string
  product_name: string
  unit: string
  warehouse_id: number
  warehouse_name: string
  stock: string
  min_stock: string
  daily_sales: string
  lead_time_days: number
  on_order: string
  suggested_quantity: string
  supplier_id: number | null
  supplier_name: string | null
  last_price: string | null
  method: string
}

export interface PayablesSummary {
  aging: Aging
  top_suppliers: { supplier_id: number; name: string; balance: string; overdue: string }[]
}

export interface PurchasesDashboard {
  pending_orders: { count: number; pending_value: string }
  payables: Aging | null
}

export interface PurchaseSettings {
  purchase_approval_threshold: string
  purchase_receipt_tolerance_pct: string
  purchase_price_variance_pct: string
}
