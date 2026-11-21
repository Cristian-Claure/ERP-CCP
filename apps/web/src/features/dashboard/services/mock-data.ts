import type { DashboardSummary, SalesPoint } from '../types'

const MONTHS = ['Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov']
const CURRENT = [
  182_400, 168_900, 175_300, 191_800, 186_200, 204_500, 198_700, 213_900, 221_400, 216_800, 232_100,
  248_930.5,
]
const PREVIOUS = [
  158_200, 149_700, 152_900, 166_400, 171_000, 178_300, 174_600, 185_200, 190_800, 187_500, 199_300, 205_600,
]

const sales: SalesPoint[] = MONTHS.map((label, index) => ({
  month: `2026-${String(index === 0 ? 12 : index).padStart(2, '0')}`,
  label,
  current: CURRENT[index] ?? 0,
  previous: PREVIOUS[index] ?? 0,
}))

export const mockDashboardSummary: DashboardSummary = {
  currency: 'BOB',
  kpis: [
    {
      key: 'monthly_sales',
      label: 'Ventas del mes',
      value: 248_930.5,
      format: 'currency',
      delta: 7.3,
      higherIsBetter: true,
      source: 'demo',
      hint: 'vs. octubre',
      trend: CURRENT.slice(-8),
    },
    {
      key: 'receivables',
      label: 'Cuentas por cobrar',
      value: 86_412.75,
      format: 'currency',
      delta: -4.1,
      higherIsBetter: false,
      source: 'demo',
      hint: '23 documentos abiertos',
      trend: [98, 95, 101, 93, 91, 94, 89, 86],
    },
    {
      key: 'low_stock',
      label: 'Bajo stock mínimo',
      value: 12,
      format: 'integer',
      delta: 20,
      higherIsBetter: false,
      source: 'demo',
      hint: 'productos a reponer',
      trend: [6, 8, 7, 9, 8, 10, 10, 12],
    },
    {
      key: 'pending_orders',
      label: 'Órdenes pendientes',
      value: 18,
      format: 'integer',
      delta: -10,
      higherIsBetter: false,
      source: 'demo',
      hint: '5 vencen esta semana',
      trend: [24, 22, 25, 21, 20, 22, 20, 18],
    },
  ],
  sales,
  recentOperations: [
    {
      id: '1',
      code: 'VTA-000128',
      type: 'venta',
      counterparty: 'Distribuidora Andina S.A.',
      date: '2026-11-20',
      amount: 12_480,
      status: 'completada',
    },
    {
      id: '2',
      code: 'CMP-000057',
      type: 'compra',
      counterparty: 'Importadora del Sur Ltda.',
      date: '2026-11-20',
      amount: 34_250.4,
      status: 'pendiente',
    },
    {
      id: '3',
      code: 'COB-000213',
      type: 'cobro',
      counterparty: 'Supermercado El Prado',
      date: '2026-11-19',
      amount: 8_900,
      status: 'completada',
    },
    {
      id: '4',
      code: 'VTA-000127',
      type: 'venta',
      counterparty: 'Ferretería San Miguel',
      date: '2026-11-19',
      amount: 3_215.5,
      status: 'anulada',
    },
    {
      id: '5',
      code: 'AJS-000009',
      type: 'ajuste',
      counterparty: 'Almacén central',
      date: '2026-11-18',
      amount: 1_120,
      status: 'completada',
    },
    {
      id: '6',
      code: 'PAG-000088',
      type: 'pago',
      counterparty: 'Transportes Illimani',
      date: '2026-11-18',
      amount: 5_600,
      status: 'completada',
    },
    {
      id: '7',
      code: 'VTA-000126',
      type: 'venta',
      counterparty: 'Farmacia Cristo Rey',
      date: '2026-11-17',
      amount: 18_744.9,
      status: 'pendiente',
    },
  ],
}
