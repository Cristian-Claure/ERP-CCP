import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useLayoutEffect, useRef } from 'react'

import { env } from '@/lib/env'
import { cn } from 'cn'

/**
 * Thin React wrapper over Leaflet (BSD-2). react-leaflet is not used: its
 * license (Hippocratic 2.1) is not OSI-approved (see docs/LICENSES.md).
 *
 * Tiles come from VITE_MAP_TILE_URL (default OpenStreetMap). OSM tile policy:
 * visible attribution, no bulk downloads, no aggressive prefetch — so no
 * keepBuffer/prefetch tweaks here.
 */
export interface LeafletMapProps {
  center: [number, number]
  zoom: number
  className?: string
  /** Called once with the map instance (add layers, listeners...). Return a cleanup. */
  onReady?: (map: L.Map) => void | (() => void)
}

export function LeafletMap({ center, zoom, className, onReady }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const readyRef = useRef(onReady)
  useLayoutEffect(() => {
    readyRef.current = onReady
  })

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, { center, zoom, zoomControl: true, attributionControl: true })
    map.attributionControl.setPrefix(
      '<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>',
    )
    L.tileLayer(env.mapTileUrl, { attribution: env.mapTileAttribution, maxZoom: 19 }).addTo(map)
    const cleanup = readyRef.current?.(map)

    // The container may be laid out after mount (sheets, tabs): fix the size once visible.
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      cleanup?.()
      map.remove()
    }
    // The map is created once; later center/zoom changes are applied by the parent through onReady.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className={cn('isolate z-0 overflow-hidden rounded-lg border', className)} />
}
