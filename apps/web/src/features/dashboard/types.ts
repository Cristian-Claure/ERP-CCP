export type KpiKey = 'monthly_sales' | 'receivables' | 'low_stock' | 'pending_orders'
export type KpiFormat = 'currency' | 'integer'

export interface Kpi {
  key: KpiKey
  label: string
  value: number
  format: KpiFormat
  /** Percent change vs previous period (null when not computed yet). */
  delta: number | null
  /** Whether an increase is good (sales) or bad (low stock). */
  higherIsBetter: boolean
  hint: string
  trend?: number[]
  /** live = real API data; demo = mock until its module exists. */
  source: 'live' | 'demo'
}
