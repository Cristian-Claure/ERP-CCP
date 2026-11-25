import type { CustomerSegment, DebtStatus } from '@/features/sales/types'

export type AtlasPeriod = '30d' | '90d' | '365d' | 'ytd' | 'all'

export interface AtlasFlow {
  warehouse_id: number
  total: string
  count: number
}

export interface AtlasCustomer {
  id: number
  name: string
  city: string | null
  department: string | null
  country: string
  segment: CustomerSegment
  lat: number
  lng: number
  sales_total: string
  sales_count: number
  last_sale_at: string | null
  flows: AtlasFlow[]
  /** Only with receivables.view. */
  receivables?: { balance: string; overdue: string; debt_status: DebtStatus }
}

export interface AtlasCustomersResponse {
  data: AtlasCustomer[]
  meta: {
    period: { key: AtlasPeriod; from: string | null; to: string }
    receivables: boolean
    segments: { value: CustomerSegment; label: string }[]
    cache_version: number
  }
}

export interface AtlasWarehouse {
  id: number
  code: string
  name: string
  address: string | null
  lat: number
  lng: number
}

/** Supplier layer (GET /atlas/suppliers): inbound flows per destination warehouse. */
export interface AtlasSupplier {
  id: number
  name: string
  tax_id: string
  country: string
  city: string | null
  lat: number
  lng: number
  issues_invoice: boolean
  lead_time_days: number
  purchases_total: string
  receipts_count: number
  last_receipt_at: string | null
  balance: string | null
  flows: { warehouse_id: number; total: string; count: number }[]
}

export type AtlasMode = 'columns' | 'hexbin'

export interface FlyTarget {
  lat: number
  lng: number
  /** Camera distance from the globe center when arriving. */
  distance: number
}
