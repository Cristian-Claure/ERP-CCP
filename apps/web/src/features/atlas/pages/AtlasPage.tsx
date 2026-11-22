import { Globe2, Map as MapIcon, TriangleAlert } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { cn } from 'cn'

import { useAtlasCustomers, useAtlasWarehouses } from '../api'
import { cityRanking, computeKpis, tourStops } from '../lib/data'
import { hasWebGL, prefersReducedMotion } from '../lib/device'
import { periodLabel } from '../lib/periods'
import { useAtlasStore } from '../store'
import { AtlasFallback2D } from '../ui/AtlasFallback2D'
import { AtlasHud, panel } from '../ui/AtlasHud'
import { AtlasToolbar } from '../ui/AtlasToolbar'
import { CustomerPanel } from '../ui/CustomerPanel'
import { HoverTooltip } from '../ui/HoverTooltip'
import { Legend } from '../ui/Legend'
import { LoadingOverlay } from '../ui/LoadingOverlay'
import { TimeControl } from '../ui/TimeControl'

// three.js and the scene load only with this route (and only when WebGL exists).
const AtlasScene = lazy(() => import('../scene/AtlasScene'))

/**
 * CCP Atlas: immersive 3D globe of customers, sales and receivables. Falls
 * back to a 2D Leaflet map without WebGL (or on demand).
 */
export function AtlasPage() {
  const [search] = useSearchParams()
  const [webgl] = useState(hasWebGL)
  const [reducedMotion] = useState(prefersReducedMotion)
  const [show2D, setShow2D] = useState(false)
  const period = useAtlasStore((s) => s.period)
  const segments = useAtlasStore((s) => s.segments)
  const status = useAtlasStore((s) => s.status)
  const selectedId = useAtlasStore((s) => s.selectedId)
  const { data, isError, refetch } = useAtlasCustomers({ period, segments, status })
  const { data: warehouses = [] } = useAtlasWarehouses()
  const perf = useAtlasStore((s) => s.perf)

  const customers = useMemo(() => data?.data ?? [], [data])
  const byStatus = data?.meta.receivables ?? false
  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const kpis = useMemo(() => computeKpis(customers, byStatus), [customers, byStatus])
  const cities = useMemo(() => cityRanking(customers), [customers])
  const stops = useMemo(() => tourStops(customers), [customers])
  const selected = selectedId !== null ? byId.get(selectedId) : undefined
  const use2D = !webgl || show2D

  // Leaving the route: drop transient UI state (selection, tour, hover, perf).
  useEffect(
    () => () =>
      useAtlasStore
        .getState()
        .set({ selectedId: null, touring: false, hover: null, flyTarget: null, perf: null }),
    [],
  )

  return (
    <div className="relative h-full w-full bg-[#05070f] text-foreground">
      {use2D ? (
        <AtlasFallback2D customers={customers} warehouses={warehouses} byStatus={byStatus} />
      ) : (
        <>
          <Suspense fallback={null}>
            <AtlasScene
              customers={customers}
              warehouses={warehouses}
              byStatus={byStatus}
              reducedMotion={reducedMotion}
              perf={search.get('perf') === '1'}
              tourStops={stops}
            />
          </Suspense>
          <LoadingOverlay />
          <HoverTooltip byId={byId} />
        </>
      )}

      {/* Overlays: the container ignores the pointer, the panels take it back. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <div className={cn(panel, 'pointer-events-auto flex items-center gap-2 px-3 py-2')}>
              <Globe2 className="size-4 text-brand-accent" />
              <h1 className="text-sm font-semibold tracking-tight">CCP Atlas</h1>
              {!webgl && <span className="text-xs text-muted-foreground">· vista 2D (sin WebGL)</span>}
            </div>
            <AtlasHud kpis={kpis} cities={cities} periodLabel={periodLabel(period)} />
          </div>
          <div className="flex w-full flex-col items-end gap-2 sm:w-auto">
            <AtlasToolbar
              customers={customers}
              withReceivables={byStatus}
              reducedMotion={reducedMotion}
              onShowMap={() => setShow2D((v) => !v)}
            />
            {show2D && webgl && (
              <Button
                size="sm"
                variant="secondary"
                className="pointer-events-auto"
                onClick={() => setShow2D(false)}
              >
                <MapIcon /> Volver al globo 3D
              </Button>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 justify-end">
          {selected && <CustomerPanel customer={selected} periodLabel={periodLabel(period)} />}
        </div>

        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
          <Legend byStatus={byStatus} />
          {!use2D && <TimeControl />}
        </div>
      </div>

      {isError && (
        <div
          className={cn(
            panel,
            'absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2 p-4 text-center text-sm',
          )}
        >
          <TriangleAlert className="mx-auto mb-2 size-6 text-destructive" />
          No se pudieron cargar los clientes del globo.
          <Button size="sm" className="mt-3 w-full" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {perf && (
        <div className="num pointer-events-none absolute top-16 left-1/2 z-30 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1 text-xs text-emerald-300">
          {perf.fps} fps · {perf.calls} draw calls · {(perf.triangles / 1000).toFixed(0)}k triángulos
        </div>
      )}
    </div>
  )
}
