import L from 'leaflet'
import { useEffect, useRef } from 'react'

import { LeafletMap } from '@/components/map/LeafletMap'

import { colorFor } from '../lib/colors'
import { useAtlasStore } from '../store'
import type { AtlasCustomer, AtlasWarehouse } from '../types'

interface FallbackProps {
  customers: AtlasCustomer[]
  warehouses: AtlasWarehouse[]
  byStatus: boolean
}

/**
 * Same data on a 2D map (Leaflet + OpenStreetMap): used when the device has no
 * WebGL, and on demand. Circle area ∝ sales; colour = status or segment.
 */
export function AtlasFallback2D({ customers, warehouses, byStatus }: FallbackProps) {
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    layerRef.current?.remove()
    const layer = L.layerGroup().addTo(map)
    const max = Math.max(...customers.map((c) => Number(c.sales_total)), 1)
    for (const c of customers) {
      const color = colorFor([c], byStatus)
      L.circleMarker([c.lat, c.lng], {
        radius: 4 + 16 * Math.sqrt(Number(c.sales_total) / max),
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.45,
      })
        .bindTooltip(`<strong>${escapeHtml(c.name)}</strong><br>${escapeHtml(c.city ?? '')}`)
        .on('click', () => useAtlasStore.getState().select(c.id))
        .addTo(layer)
    }
    for (const w of warehouses) {
      L.circleMarker([w.lat, w.lng], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: '#6366f1',
        fillOpacity: 1,
      })
        .bindTooltip(`Almacén ${escapeHtml(w.name)}`)
        .addTo(layer)
    }
    layerRef.current = layer
  }, [customers, warehouses, byStatus])

  return (
    <LeafletMap
      center={[-17.2, -64.5]}
      zoom={6}
      className="h-full w-full rounded-none border-0"
      onReady={(map) => {
        mapRef.current = map
        return () => {
          mapRef.current = null
          layerRef.current = null
        }
      }}
    />
  )
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
}
