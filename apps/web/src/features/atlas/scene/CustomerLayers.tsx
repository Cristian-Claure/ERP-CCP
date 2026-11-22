import { useMemo } from 'react'

import { cellSizeForDistance, clusterPoints, hexbinPoints } from '../lib/cluster'
import { colorFor, rampColor } from '../lib/colors'
import { columnHeight, toPoints } from '../lib/data'
import { useAtlasStore } from '../store'
import type { AtlasCustomer } from '../types'
import { type BarItem, InstancedBars } from './InstancedBars'

interface LayerProps {
  customers: AtlasCustomer[]
  byStatus: boolean
}

/** Hexbin size (degrees) by camera distance. */
const hexSizeFor = (distance: number) => (distance < 1.5 ? 0.35 : distance < 2.2 ? 1.2 : 3)

function useSelectHandler() {
  return (item: BarItem) => {
    const { select, set, cameraDistance } = useAtlasStore.getState()
    if (item.customerIds.length === 1) {
      select(item.customerIds[0], { lat: item.lat, lng: item.lng, distance: 1.32 })
    } else {
      // Cluster: fly closer so it splits into its customers.
      set({
        flyTarget: { lat: item.lat, lng: item.lng, distance: Math.max(1.3, cameraDistance * 0.55) },
        touring: false,
      })
    }
  }
}

/**
 * Light columns: height = sales of the period, colour = collection status
 * (or segment without receivables.view). Nearby customers merge into one
 * column when the camera is far and split when it gets close.
 */
export function CustomerColumns({ customers, byStatus }: LayerProps) {
  const cellDeg = useAtlasStore((s) => cellSizeForDistance(s.cameraDistance))
  const onSelect = useSelectHandler()

  const items = useMemo<BarItem[]>(() => {
    const points = toPoints(customers)
    const clusters = clusterPoints(points, cellDeg)
    const max = Math.max(...clusters.map((c) => c.weight), 1)
    return clusters.map((c) => {
      const n = c.members.length
      return {
        key: c.key,
        lat: c.lat,
        lng: c.lng,
        height: columnHeight(c.weight, max),
        width: 0.0065 + Math.min(0.02, 0.0035 * Math.log2(n + 1)) * (n > 1 ? 1 : 0),
        color: colorFor(
          c.members.map((m) => m.customer),
          byStatus,
        ),
        customerIds: c.members.map((m) => m.id),
      }
    })
  }, [customers, cellDeg, byStatus])

  return (
    <InstancedBars
      items={items}
      capacity={Math.max(customers.length, 1)}
      radialSegments={12}
      onSelect={onSelect}
    />
  )
}

/** Alternative mode: hexagonal prisms with the sales of each zone. */
export function SalesHexbins({ customers }: { customers: AtlasCustomer[] }) {
  const size = useAtlasStore((s) => hexSizeFor(s.cameraDistance))
  const onSelect = useSelectHandler()

  const items = useMemo<BarItem[]>(() => {
    const bins = hexbinPoints(toPoints(customers), size).filter((b) => b.weight > 0)
    const max = Math.max(...bins.map((b) => b.weight), 1)
    return bins.map((b) => ({
      key: b.key,
      lat: b.lat,
      lng: b.lng,
      height: 0.01 + 0.3 * Math.sqrt(b.weight / max),
      width: ((size * Math.PI) / 180) * 1.6,
      color: rampColor(Math.sqrt(b.weight / max)),
      customerIds: b.members.map((m) => m.id),
    }))
  }, [customers, size])

  return (
    <InstancedBars
      items={items}
      capacity={Math.max(customers.length, 1)}
      radialSegments={6}
      onSelect={onSelect}
    />
  )
}
