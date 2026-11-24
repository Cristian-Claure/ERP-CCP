import { useMemo } from 'react'

import { latLngToVector3 } from '../lib/geo'
import { useAtlasStore } from '../store'
import type { AtlasSupplier, AtlasWarehouse } from '../types'
import { type ArcFlow, FlowArcs } from './Arcs'

const PALETTE: [string, string] = ['#f59e0b', '#fde68a']

/**
 * Optional supplier layer: amber pyramids at each supplier and inbound arcs
 * supplier -> warehouse (purchases of the period), distinct from the cyan
 * sales arcs warehouse -> customer.
 */
export function SupplierLayer({
  suppliers,
  warehouses,
  animate,
}: {
  suppliers: AtlasSupplier[]
  warehouses: AtlasWarehouse[]
  animate: boolean
}) {
  const scale = useAtlasStore((s) => Math.max(0.0014, 0.014 * Math.min(1, (s.cameraDistance - 1) / 2.1)))
  const flows = useMemo<ArcFlow[]>(() => {
    const byId = new Map(warehouses.map((w) => [w.id, w]))
    return suppliers.flatMap((s) =>
      s.flows
        .filter((f) => byId.has(f.warehouse_id))
        .map((f) => ({ from: s, to: byId.get(f.warehouse_id)!, total: Number(f.total) })),
    )
  }, [suppliers, warehouses])

  return (
    <group>
      <FlowArcs flows={flows} palette={PALETTE} animate={animate} />
      {suppliers.map((s) => (
        <mesh
          key={s.id}
          position={latLngToVector3(s.lat, s.lng, 1.004)}
          scale={scale}
          onUpdate={(m) => m.lookAt(0, 0, 0)}
          raycast={() => null}
        >
          <tetrahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PALETTE[0]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
