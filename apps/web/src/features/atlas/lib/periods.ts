import type { AtlasPeriod } from '../types'

export const PERIODS: { value: AtlasPeriod; label: string }[] = [
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
  { value: '365d', label: 'Últimos 12 meses' },
  { value: 'ytd', label: 'Este año' },
  { value: 'all', label: 'Todo' },
]

export const periodLabel = (p: AtlasPeriod) => PERIODS.find((x) => x.value === p)?.label ?? p
