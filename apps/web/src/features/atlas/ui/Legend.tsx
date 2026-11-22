import { cn } from 'cn'

import { rampColor, SEGMENT_COLORS, STATUS_COLORS } from '../lib/colors'
import { useAtlasStore } from '../store'
import { panel } from './AtlasHud'

/** What the colours, heights and arcs mean (adapts to mode and permissions). */
export function Legend({ byStatus }: { byStatus: boolean }) {
  const mode = useAtlasStore((s) => s.mode)
  const showArcs = useAtlasStore((s) => s.showArcs)
  const hoverCountry = useAtlasStore((s) => s.hoverCountry)
  const entries = byStatus ? Object.values(STATUS_COLORS) : Object.values(SEGMENT_COLORS)

  return (
    <div className={cn(panel, 'pointer-events-auto max-w-xs p-2.5 text-[11px] sm:p-3 sm:text-xs')}>
      {mode === 'columns' ? (
        <>
          <p className="mb-1.5 font-medium">{byStatus ? 'Estado de cobro' : 'Segmento'}</p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {entries.map((e) => (
              <li key={e.label} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: e.color, boxShadow: `0 0 8px ${e.color}` }}
                />
                {e.label}
              </li>
            ))}
          </ul>
          <p className="mt-2 hidden text-muted-foreground sm:block">
            Altura: ventas del período · se agrupan al alejarse.
          </p>
        </>
      ) : (
        <>
          <p className="mb-1.5 font-medium">Ventas por zona</p>
          <div
            className="h-2 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${rampColor(0)}, ${rampColor(0.5)}, ${rampColor(1)})`,
            }}
          />
          <div className="mt-1 flex justify-between text-muted-foreground">
            <span>menos</span>
            <span>más</span>
          </div>
        </>
      )}
      {showArcs && (
        <p className="mt-2 hidden items-center gap-1.5 text-muted-foreground sm:flex">
          <span className="h-px w-5 bg-gradient-to-r from-brand-accent to-indigo-300" /> Almacén → cliente
          <span className="ml-1 size-2 rotate-45 bg-white" aria-label="almacén" />
        </p>
      )}
      {hoverCountry && <p className="mt-2 border-t pt-2 font-medium text-brand-accent">{hoverCountry}</p>}
    </div>
  )
}
