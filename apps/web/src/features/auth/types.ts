export interface Company {
  id: number
  name: string
  legal_name: string
  tax_id: string
  currency: string
  timezone: string
  allow_negative_stock: boolean
  document_backdate_days: number
  sales_note_vat_breakdown: boolean
  quote_validity_days: number
  default_customer_id: number | null
  email: string | null
  phone: string | null
  address: string | null
}

export interface AuthUser {
  id: number
  name: string
  email: string
  company: Company
  roles: string[]
  permissions: string[]
  /** Warehouse the POS opens with (per-user preference). */
  pos_warehouse_id: number | null
  last_login_at: string | null
}

export interface LoginPayload {
  email: string
  password: string
  remember: boolean
}
