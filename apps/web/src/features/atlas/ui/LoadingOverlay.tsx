import { Globe2, TriangleAlert } from 'lucide-react'

import { useAtlasStore } from '../store'

/** Real texture-loading progress (LoadingManager) until the Earth is ready. */
export function LoadingOverlay() {
  const progress = useAtlasStore((s) => s.loadProgress)
  if (progress >= 1) return null
  const failed = progress < 0
  const pct = Math.round(Math.max(progress, 0) * 100)

  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-[#05070f]"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-64 flex-col items-center gap-4 text-center">
        {failed ? (
          <TriangleAlert className="size-10 text-destructive" />
        ) : (
          <Globe2 className="size-10 animate-pulse text-brand-accent motion-reduce:animate-none" />
        )}
        <div className="w-full">
          <p className="text-sm font-medium text-slate-100">
            {failed ? 'No se pudieron cargar las texturas del globo' : 'Preparando CCP Atlas…'}
          </p>
          {!failed && (
            <>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-brand-accent transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="num mt-2 text-xs text-slate-400">Texturas {pct} %</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
