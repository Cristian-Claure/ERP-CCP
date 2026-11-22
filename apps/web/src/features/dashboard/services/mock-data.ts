import type { DashboardSummary } from '../types'

/**
 * Demo data for the indicators whose module does not exist yet.
 * Sales, receivables and stock are live; only "pending orders" waits for
 * the Purchases phase.
 */
export const mockDashboardSummary: DashboardSummary = {
  currency: 'BOB',
  kpis: [
    {
      key: 'pending_orders',
      label: 'Órdenes de compra',
      value: 18,
      format: 'integer',
      delta: -10,
      higherIsBetter: false,
      source: 'demo',
      hint: 'disponible en la fase de Compras',
      trend: [24, 22, 25, 21, 20, 22, 20, 18],
    },
  ],
}
