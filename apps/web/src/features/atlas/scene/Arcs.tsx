import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  type LineSegments,
  ShaderMaterial,
} from 'three'

import { greatCircleArc, latLngToVector3 } from '../lib/geo'
import arcFrag from '../shaders/arc.frag.glsl?raw'
import arcVert from '../shaders/arc.vert.glsl?raw'
import { useAtlasStore } from '../store'
import type { AtlasCustomer, AtlasWarehouse } from '../types'

/** Most relevant flows only: keeps the globe readable and the geometry small. */
const MAX_ARCS = 220
const SEGMENTS = 40

interface ArcsProps {
  customers: AtlasCustomer[]
  warehouses: AtlasWarehouse[]
  animate: boolean
}

/** One flow drawn as an arc: from -> to, weighted by its amount. */
export interface ArcFlow {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  total: number
}

/** Sales arcs: warehouse that served each customer -> customer (cyan). */
export function Arcs({ customers, warehouses, animate }: ArcsProps) {
  const flows = useMemo<ArcFlow[]>(() => {
    const byId = new Map(warehouses.map((w) => [w.id, w]))
    return customers.flatMap((c) =>
      c.flows
        .filter((f) => byId.has(f.warehouse_id))
        .map((f) => ({ from: byId.get(f.warehouse_id)!, to: c, total: Number(f.total) })),
    )
  }, [customers, warehouses])
  return <FlowArcs flows={flows} palette={['#22d3ee', '#a5b4fc']} animate={animate} />
}

/**
 * Animated arcs with particles travelling along them. All arcs of a layer
 * share ONE LineSegments geometry and one shader (a single draw call).
 */
export function FlowArcs({
  flows: input,
  palette,
  animate,
}: {
  flows: ArcFlow[]
  palette: [string, string]
  animate: boolean
}) {
  const geometry = useMemo(() => {
    const flows = input
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, MAX_ARCS)

    const max = flows[0]?.total ?? 1
    const positions = new Float32Array(flows.length * SEGMENTS * 2 * 3)
    const progress = new Float32Array(flows.length * SEGMENTS * 2)
    const seeds = new Float32Array(flows.length * SEGMENTS * 2)
    const colors = new Float32Array(flows.length * SEGMENTS * 2 * 3)
    const cold = new Color(palette[0])
    const hot = new Color(palette[1])
    const color = new Color()

    flows.forEach(({ from, to, total }, a) => {
      const points = greatCircleArc(from, to, SEGMENTS, 1.002)
      const seed = (a * 0.618034) % 1
      color.copy(cold).lerp(hot, Math.sqrt(total / max))
      for (let i = 0; i < SEGMENTS; i++) {
        const v = (a * SEGMENTS + i) * 2
        for (const [k, p] of [
          [0, points[i]],
          [1, points[i + 1]],
        ] as const) {
          positions.set([p.x, p.y, p.z], (v + k) * 3)
          progress[v + k] = (i + k) / SEGMENTS
          seeds[v + k] = seed
          colors.set([color.r, color.g, color.b], (v + k) * 3)
        }
      }
    })

    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('progress', new BufferAttribute(progress, 1))
    g.setAttribute('seed', new BufferAttribute(seeds, 1))
    g.setAttribute('arcColor', new BufferAttribute(colors, 3))
    g.computeBoundingSphere()
    return g
  }, [input, palette])

  const lineRef = useRef<LineSegments>(null)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: arcVert,
        fragmentShader: arcFrag,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { time: { value: 0 }, speed: { value: 0.22 } },
      }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    // prefers-reduced-motion: static trails, no travelling particles.
    if (animate && lineRef.current) (lineRef.current.material as ShaderMaterial).uniforms.time.value += delta
  })

  return <lineSegments ref={lineRef} geometry={geometry} material={material} raycast={() => null} />
}

/** Warehouses: small bright diamonds with a vertical beacon. */
export function WarehouseMarkers({ warehouses }: { warehouses: AtlasWarehouse[] }) {
  // Same visual size at any zoom (the markers are ~1.2 % of the view width).
  const scale = useAtlasStore((s) => Math.max(0.0012, 0.012 * Math.min(1, (s.cameraDistance - 1) / 2.1)))
  return (
    <group>
      {warehouses.map((w) => {
        const p = latLngToVector3(w.lat, w.lng, 1.004)
        return (
          <mesh
            key={w.id}
            position={p}
            scale={scale}
            onUpdate={(m) => m.lookAt(0, 0, 0)}
            raycast={() => null}
          >
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}
