import { Clock, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from 'cn'

import { useAtlasStore } from '../store'
import { panel } from './AtlasHud'

const fmt = new Intl.DateTimeFormat('es-BO', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

/** Moves the sun ±24 h around the real UTC time; "Ahora" returns to live. */
export function TimeControl() {
  const offset = useAtlasStore((s) => s.timeOffsetHours)
  const set = useAtlasStore((s) => s.set)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const shown = new Date(now + offset * 3_600_000)

  return (
    <div
      className={cn(panel, 'pointer-events-auto flex w-full max-w-md items-center gap-3 px-3 py-2 sm:w-auto')}
    >
      <Clock className="size-4 shrink-0 text-brand-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <label htmlFor="atlas-time" className="flex items-baseline justify-between gap-3 text-xs">
          <span className="hidden text-muted-foreground sm:inline">Posición del sol</span>
          <span className="num font-medium capitalize">{fmt.format(shown)} UTC</span>
        </label>
        <input
          id="atlas-time"
          type="range"
          min={-24}
          max={24}
          step={0.25}
          value={offset}
          onChange={(e) => set({ timeOffsetHours: Number(e.target.value) })}
          className="mt-1 h-1.5 w-full cursor-pointer accent-[var(--brand)] sm:w-64"
          aria-valuetext={`${offset >= 0 ? '+' : ''}${offset} horas`}
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 px-2 text-xs"
        disabled={offset === 0}
        onClick={() => set({ timeOffsetHours: 0 })}
      >
        <RotateCcw className="size-3.5" /> Ahora
      </Button>
    </div>
  )
}
