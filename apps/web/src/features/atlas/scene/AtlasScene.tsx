import { Canvas, useThree } from '@react-three/fiber'

import { latLngToVector3 } from '../lib/geo'
import { useAtlasStore } from '../store'
import type { AtlasCustomer, AtlasWarehouse } from '../types'
import { Arcs, WarehouseMarkers } from './Arcs'
import { Borders } from './Borders'
import { CameraRig } from './CameraRig'
import { CustomerColumns, SalesHexbins } from './CustomerLayers'
import { Earth } from './Earth'
import { PerfMeter } from './PerfMeter'
import { Stars } from './Stars'
import { useAtlasTextures } from './useAtlasTextures'

export interface AtlasSceneProps {
  customers: AtlasCustomer[]
  warehouses: AtlasWarehouse[]
  byStatus: boolean
  reducedMotion: boolean
  perf: boolean
  tourStops: { lat: number; lng: number }[]
}

/** Initial view: Bolivia, from far enough to see the continent. */
const INITIAL_CAMERA = latLngToVector3(-18, -64, 3.1)

/** The WebGL canvas. Lazy-loaded with the /atlas route (three.js stays out of the main bundle). */
export default function AtlasScene(props: AtlasSceneProps) {
  return (
    <Canvas
      camera={{ fov: 40, near: 0.01, far: 200, position: INITIAL_CAMERA.toArray() }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      onPointerMissed={() => useAtlasStore.getState().select(null)}
      aria-label="Globo 3D de clientes"
    >
      <color attach="background" args={['#05070f']} />
      <SceneContent {...props} />
    </Canvas>
  )
}

function SceneContent({ customers, warehouses, byStatus, reducedMotion, perf, tourStops }: AtlasSceneProps) {
  const gl = useThree((s) => s.gl)
  const textures = useAtlasTextures(gl.capabilities.getMaxAnisotropy())
  const mode = useAtlasStore((s) => s.mode)
  const showArcs = useAtlasStore((s) => s.showArcs)
  const showBorders = useAtlasStore((s) => s.showBorders)

  return (
    <>
      <Stars />
      {textures && (
        <>
          <Earth textures={textures} reducedMotion={reducedMotion} />
          {showBorders && <Borders />}
          {mode === 'columns' ? (
            <CustomerColumns customers={customers} byStatus={byStatus} />
          ) : (
            <SalesHexbins customers={customers} />
          )}
          {showArcs && <Arcs customers={customers} warehouses={warehouses} animate={!reducedMotion} />}
          <WarehouseMarkers warehouses={warehouses} />
        </>
      )}
      <CameraRig reducedMotion={reducedMotion} stops={tourStops} />
      {perf && <PerfMeter />}
    </>
  )
}
