export type KpiKey = 'monthly_sales' | 'receivables' | 'low_stock' | 'pending_orders'
export type KpiFormat = 'currency' | 'integer'

export interface Kpi {
  key: KpiKey
  label: string
  value: number
  format: KpiFormat
  /** Percent change vs previous period. */
  delta: number
  /** Whether an increase is good (sales) or bad (low stock). */
  higherIsBetter: boolean
  hint: string
  trend: number[]
}

export interface SalesPoint {
  /** ISO month, e.g. "2026-01". */
  month: string
  label: string
  current: number
  previous: number
}

export type OperationType = 'venta' | 'compra' | 'cobro' | 'pago' | 'ajuste'
export type OperationStatus = 'completada' | 'pendiente' | 'anulada'

export interface Operation {
  id: string
  code: string
  type: OperationType
  counterparty: string
  date: string
  amount: number
  status: OperationStatus
}

export interface DashboardSummary {
  currency: string
  kpis: Kpi[]
  sales: SalesPoint[]
  recentOperations: Operation[]
}
