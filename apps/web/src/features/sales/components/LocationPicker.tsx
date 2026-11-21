import L from 'leaflet'
import { Crosshair, MapPinOff } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'

import { pinIcon } from '@/components/map/icons'
import { LeafletMap } from '@/components/map/LeafletMap'
import { Button } from '@/components/ui/button'

/** Santa Cruz de la Sierra (default view when the customer has no location yet). */
const DEFAULT_CENTER: [number, number] = [-17.7833, -63.1821]

interface LocationPickerProps {
  latitude: string
  longitude: string
  onChange: (latitude: string, longitude: string) => void
}

const fixed = (n: number) => n.toFixed(6)

/** Click on the map or drag the pin to set the coordinates (6 decimals ≈ 0,1 m). */
export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const changeRef = useRef(onChange)
  useLayoutEffect(() => {
    changeRef.current = onChange
  })
  const hasValue = latitude !== '' && longitude !== ''
  const initial: [number, number] = hasValue ? [Number(latitude), Number(longitude)] : DEFAULT_CENTER

  const place = (lat: number, lng: number) => {
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: true, icon: pinIcon(), keyboard: true })
        .addTo(map)
        .on('dragend', (e) => {
          const p = (e.target as L.Marker).getLatLng()
          changeRef.current(fixed(p.lat), fixed(p.lng))
        })
    }
  }

  return (
    <div className="space-y-2">
      <LeafletMap
        center={initial}
        zoom={hasValue ? 16 : 12}
        className="h-64 w-full"
        onReady={(map) => {
          mapRef.current = map
          if (hasValue) place(initial[0], initial[1])
          map.on('click', (e: L.LeafletMouseEvent) => {
            place(e.latlng.lat, e.latlng.lng)
            changeRef.current(fixed(e.latlng.lat), fixed(e.latlng.lng))
          })
          return () => {
            mapRef.current = null
            markerRef.current = null
          }
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="num">
          {hasValue ? `${latitude}, ${longitude}` : 'Haz clic en el mapa para fijar la ubicación.'}
        </span>
        <div className="flex gap-1">
          {'geolocation' in navigator && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                navigator.geolocation.getCurrentPosition((pos) => {
                  const { latitude: lat, longitude: lng } = pos.coords
                  place(lat, lng)
                  mapRef.current?.setView([lat, lng], 17)
                  changeRef.current(fixed(lat), fixed(lng))
                })
              }
            >
              <Crosshair /> Mi ubicación
            </Button>
          )}
          {hasValue && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                markerRef.current?.remove()
                markerRef.current = null
                changeRef.current('', '')
              }}
            >
              <MapPinOff /> Quitar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
