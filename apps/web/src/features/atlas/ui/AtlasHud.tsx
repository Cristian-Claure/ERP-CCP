import { MapPin } from 'lucide-react'

import { formatCompact, formatCurrency, formatInteger } from '@/lib/format'
import { cn } from 'cn'

import type { AtlasKpis, CityRank } from '../lib/data'
import { useAtlasStore } from '../store'

/** Glass panel shared by every Atlas overlay (design-system tokens). */
export const panel =
  'rounded-xl border border-border/70 bg-background/70 shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-background/55'

const COUNTRY_FLAG: Record<string, string> = {
  BO: '🇧🇴',
  PE: '🇵🇪',
  CL: '🇨🇱',
  AR: '🇦🇷',
  BR: '🇧🇷',
  PY: '🇵🇾',
  US: '🇺🇸',
  ES: '🇪🇸',
  CN: '🇨🇳',
}

/** KPIs of what is visible (after filters) and a mini ranking of cities. */
export function AtlasHud({
  kpis,
  cities,
  periodLabel,
}: {
  kpis: AtlasKpis
  cities: CityRank[]
  periodLabel: string
}) {
  const items = [
    { label: 'Clientes', value: formatInteger(kpis.customers) },
    {
      label: `Ventas · ${periodLabel}`,
      value: formatCurrency(kpis.sales),
      hint: `${formatInteger(kpis.salesCount)} documentos`,
    },
    ...(kpis.debt !== null
      ? [
          { label: 'Por cobrar', value: formatCurrency(kpis.debt) },
          { label: 'Vencido', value: formatCurrency(kpis.overdue ?? 0), danger: (kpis.overdue ?? 0) > 0 },
        ]
      : []),
  ]
  const max = cities[0]?.sales ?? 1

  return (
    <div className="pointer-events-auto flex w-full flex-col gap-2 sm:w-72">
      <div className={cn(panel, 'grid grid-cols-2 gap-x-4 gap-y-2 p-3')}>
        {items.map((i) => (
          <div key={i.label} className="min-w-0">
            <p className="truncate text-[11px] text-muted-foreground">{i.label}</p>
            <p className={cn('num truncate text-sm font-semibold', i.danger && 'text-destructive')}>
              {i.value}
            </p>
            {i.hint && <p className="num text-[10px] text-muted-foreground">{i.hint}</p>}
          </div>
        ))}
      </div>
      {cities.length > 0 && (
        <div className={cn(panel, 'hidden p-3 sm:block')}>
          <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Top ciudades
          </p>
          <ol className="space-y-1.5">
            {cities.map((c, i) => (
              <li key={c.key}>
                <button
                  type="button"
                  className="group w-full text-left"
                  onClick={() =>
                    useAtlasStore
                      .getState()
                      .set({ flyTarget: { lat: c.lat, lng: c.lng, distance: 1.6 }, touring: false })
                  }
                >
                  <span className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate group-hover:text-brand-accent">
                      <span className="num mr-1.5 text-muted-foreground">{i + 1}</span>
                      {COUNTRY_FLAG[c.country] ?? <MapPin className="inline size-3" />} {c.city}
                    </span>
                    <span className="num shrink-0 font-medium">Bs {formatCompact(c.sales)}</span>
                  </span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${(c.sales / max) * 100}%` }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
