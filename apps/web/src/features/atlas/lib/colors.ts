import type { CustomerSegment, DebtStatus } from '@/features/sales/types'

import type { AtlasCustomer } from '../types'

/** Column colours by collection status (with receivables.view). */
export const STATUS_COLORS: Record<DebtStatus, { color: string; label: string }> = {
  none: { color: '#22d3ee', label: 'Sin deuda' },
  current: { color: '#10b981', label: 'Al día' },
  due_soon: { color: '#f59e0b', label: 'Por vencer' },
  overdue: { color: '#f43f5e', label: 'Vencida' },
}

/** Column colours by segment (without receivables.view). */
export const SEGMENT_COLORS: Record<CustomerSegment, { color: string; label: string }> = {
  retail: { color: '#22d3ee', label: 'Minorista' },
  wholesale: { color: '#818cf8', label: 'Mayorista' },
  corporate: { color: '#facc15', label: 'Corporativo' },
}

const STATUS_RANK: Record<DebtStatus, number> = { none: 0, current: 1, due_soon: 2, overdue: 3 }

/** Colour of one customer or of a cluster (worst status / majority segment). */
export function colorFor(members: AtlasCustomer[], byStatus: boolean): string {
  if (byStatus) {
    let worst: DebtStatus = 'none'
    for (const m of members) {
      const s = m.receivables?.debt_status ?? 'none'
      if (STATUS_RANK[s] > STATUS_RANK[worst]) worst = s
    }
    return STATUS_COLORS[worst].color
  }
  const counts = new Map<CustomerSegment, number>()
  for (const m of members) counts.set(m.segment, (counts.get(m.segment) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'retail'
  return SEGMENT_COLORS[top].color
}

/** Hexbin ramp: low → high sales (cyan → indigo → amber). */
export function rampColor(t: number): string {
  const stops = [
    [34, 211, 238],
    [99, 102, 241],
    [245, 158, 11],
  ]
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  const f = x - i
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}
