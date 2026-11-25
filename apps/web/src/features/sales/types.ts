import type { Unit, Warehouse } from '@/features/inventory/types'
import type { PaginationMeta } from '@/lib/pagination'

export type CustomerDocumentType = 'ci' | 'ci_complement' | 'nit' | 'passport' | 'cex'
export type PaymentTerms = 'cash' | 'credit'
export type CustomerSegment = 'retail' | 'wholesale' | 'corporate'
export type DebtStatus = 'none' | 'current' | 'due_soon' | 'overdue'
export type SalesDocumentType = 'quote' | 'invoice' | 'sales_note'
export type SalesDocumentStatus = 'draft' | 'posted' | 'voided'
export type PaymentMethod = 'cash' | 'transfer' | 'qr' | 'card' | 'check'

export interface CustomerReceivables {
  balance: string
  overdue_amount: string | null
  available_credit: string
  debt_status: DebtStatus | null
  debt_status_label: string | null
}

export interface Customer {
  id: number
  document_type: CustomerDocumentType
  document_type_label: string
  document_number: string
  complement: string | null
  document_label: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  department: string | null
  country: string
  latitude: string | null
  longitude: string | null
  payment_terms: PaymentTerms
  payment_terms_label: string
  credit_days: number
  credit_limit: string
  segment: CustomerSegment
  segment_label: string
  is_active: boolean
  notes: string | null
  /** Only with receivables.view. */
  receivables?: CustomerReceivables
  stats?: { sales_count: number; sales_total: string; last_sale_at: string | null }
  created_at: string
}

export interface Aging {
  not_due: string
  d0_30: string
  d31_60: string
  d61_90: string
  d90_plus: string
  total: string
}

export interface CustomerPayload {
  document_type: CustomerDocumentType
  document_number: string
  complement?: string | null
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  department?: string | null
  country?: string | null
  latitude?: string | null
  longitude?: string | null
  payment_terms: PaymentTerms
  credit_days?: number | null
  credit_limit?: string | null
  segment: CustomerSegment
  is_active?: boolean
  notes?: string | null
}

export interface LedgerEntry {
  id: number
  kind: 'charge' | 'payment' | 'reversal'
  kind_label: string
  entry_date: string
  due_date: string | null
  description: string
  debit: string | null
  credit: string | null
  amount: string
  balance_after: string
  source_type: 'sales_document' | 'customer_payment'
  source_id: number
  created_at: string
}

export interface StatementResponse {
  data: LedgerEntry[]
  meta: PaginationMeta
  opening_balance: string
  balance: string
  aging: Aging
}

export interface SalesDocumentLine {
  id: number
  position: number
  product_id: number
  product?: { id: number; sku: string; name: string; unit: Unit | null }
  quantity: string
  unit_price: string
  discount_amount: string
  gross_amount: string
  global_discount_share: string
  total: string
  iva_amount: string
  net_amount: string
  /** Only with sales.view_margin. */
  unit_cost?: string | null
  cost_total?: string | null
  margin?: string | null
  notes: string | null
}

interface UserRef {
  id: number
  name: string
}

export interface Authorization {
  by: UserRef | null
  at: string | null
  reason: string | null
}

export interface SalesDocument {
  id: number
  type: SalesDocumentType
  type_label: string
  status: SalesDocumentStatus
  status_label: string
  number: string | null
  document_date: string
  valid_until: string | null
  due_date: string | null
  payment_terms: PaymentTerms
  payment_terms_label: string
  payment_method: PaymentMethod | null
  channel?: 'desk' | 'pos'
  cash_received?: string | null
  change_amount?: string | null
  customer_id: number
  customer?: {
    id: number
    name: string
    document_label: string
    city: string | null
    address: string | null
    phone: string | null
    email: string | null
  }
  warehouse_id: number
  warehouse?: Warehouse
  subtotal: string
  line_discount_total: string
  global_discount: string
  total: string
  iva_amount: string
  net_amount: string
  paid_amount: string
  open_amount: string | null
  cost_total?: string | null
  margin_total?: string | null
  quote?: { id: number; number: string | null } | null
  conversions?: { id: number; number: string | null; type: SalesDocumentType; status: SalesDocumentStatus }[]
  inventory_document?: { id: number; number: string | null; status: SalesDocumentStatus } | null
  below_cost_authorization: Authorization | null
  credit_override: Authorization | null
  payments?: {
    payment_id: number
    number: string | null
    date: string | null
    method: PaymentMethod | null
    method_label: string | null
    status: 'posted' | 'voided' | null
    amount: string
  }[]
  reference: string | null
  notes: string | null
  lines_count?: number
  lines?: SalesDocumentLine[]
  created_by?: UserRef | null
  posted_by?: UserRef | null
  posted_at: string | null
  voided_by?: UserRef | null
  voided_at: string | null
  void_reason: string | null
  created_at: string
}

export interface SalesDocumentPayload {
  type: SalesDocumentType
  customer_id: number
  warehouse_id: number
  document_date: string
  valid_until?: string | null
  payment_terms?: PaymentTerms | null
  payment_method?: PaymentMethod | null
  global_discount?: string | null
  reference?: string | null
  notes?: string | null
  lines: { product_id: number; quantity: string; unit_price: string; discount_amount?: string | null }[]
}

export interface PostingAuthorizationPayload {
  below_cost_reason?: string
  credit_override_reason?: string
}

export interface Payment {
  id: number
  number: string
  status: 'posted' | 'voided'
  status_label: string
  payment_date: string
  method: PaymentMethod
  method_label: string
  amount: string
  reference: string | null
  notes: string | null
  is_automatic: boolean
  customer_id: number
  customer?: { id: number; name: string; document_label: string }
  allocations?: { sales_document_id: number; number: string | null; amount: string }[]
  created_by?: UserRef | null
  voided_at: string | null
  void_reason: string | null
  created_at: string
}

export interface PaymentPayload {
  customer_id: number
  payment_date: string
  method: PaymentMethod
  amount: string
  reference?: string | null
  notes?: string | null
  allocations?: { sales_document_id: number; amount: string }[]
}

/** Details of the 422 errors the sales form reacts to. */
export interface CreditLimitDetails {
  customer: string
  balance: string
  credit_limit: string
  total: string
  available: string
}

export interface PriceBelowCostDetails {
  lines: {
    position: number
    product_id: number
    product: string
    rule: 'below_cost' | 'below_min_price'
    unit_price: string
    min_price: string | null
  }[]
}

export interface SalesDashboard {
  month: {
    current: { total: string; net: string; count: number }
    previous: { total: string; net: string; count: number }
  }
  daily: { date: string; total: string; count: number }[]
  top_customers: { customer_id: number; name: string; city: string | null; total: string; count: number }[]
  top_products: {
    metric: 'margin' | 'revenue'
    items: {
      product_id: number
      sku: string
      name: string
      revenue: string
      margin: string | null
      margin_pct: string | null
      quantity: string
    }[]
  }
  receivables: ReceivablesSummary | null
}

export interface ReceivablesSummary {
  total: string
  overdue: string
  aging: Aging
  customers_with_debt: number
  top_debtors: {
    customer_id: number
    name: string
    city: string | null
    balance: string
    credit_limit: string
  }[]
}

export interface SalesSettings {
  sales_note_vat_breakdown: boolean
  quote_validity_days: number
  default_customer_id: number | null
  vat_rate: string
}
