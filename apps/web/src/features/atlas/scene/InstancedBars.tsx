import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  type InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three'

import { latLngToVector3 } from '../lib/geo'
import { useAtlasStore } from '../store'

export interface BarItem {
  key: string
  lat: number
  lng: number
  height: number
  width: number
  color: string
  customerIds: number[]
}

interface InstancedBarsProps {
  items: BarItem[]
  /** Upper bound of instances (allocated once). */
  capacity: number
  /** 12 = round light columns, 6 = hexagonal prisms. */
  radialSegments: number
  onSelect: (item: BarItem) => void
}

const UP = new Vector3(0, 1, 0)

/**
 * Many bars standing on the globe in ONE draw call (InstancedMesh). Each bar is
 * placed on the surface, oriented along the normal and scaled by its value.
 */
export function InstancedBars({ items, capacity, radialSegments, onSelect }: InstancedBarsProps) {
  const meshRef = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => {
    const g = new CylinderGeometry(0.5, 0.5, 1, radialSegments, 1)
    g.translate(0, 0.5, 0) // base on the surface
    return g
  }, [radialSegments])
  const glow = useMemo(
    () => new MeshBasicMaterial({ transparent: true, opacity: 0.9, toneMapped: false, depthWrite: true }),
    [],
  )
  const halo = useMemo(
    () =>
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0.28,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const haloRef = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    const haloMesh = haloRef.current
    if (!mesh || !haloMesh) return
    const dummy = new Object3D()
    const normal = new Vector3()
    const q = new Quaternion()
    const color = new Color()
    items.slice(0, capacity).forEach((item, i) => {
      latLngToVector3(item.lat, item.lng, 1, dummy.position)
      normal.copy(dummy.position).normalize()
      dummy.quaternion.copy(q.setFromUnitVectors(UP, normal))
      dummy.scale.set(item.width, item.height, item.width)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.set(item.color)
      mesh.setColorAt(i, color)
      // Soft halo: a wider, shorter, additive copy around the base.
      dummy.scale.set(item.width * 2.6, item.height * 0.35, item.width * 2.6)
      dummy.updateMatrix()
      haloMesh.setMatrixAt(i, dummy.matrix)
      haloMesh.setColorAt(i, color)
    })
    for (const m of [mesh, haloMesh]) {
      m.count = Math.min(items.length, capacity)
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      m.computeBoundingSphere()
    }
  }, [items, capacity])

  useEffect(
    () => () => {
      geometry.dispose()
      glow.dispose()
      halo.dispose()
    },
    [geometry, glow, halo],
  )

  const itemAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId !== undefined ? items[e.instanceId] : undefined

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[geometry, glow, capacity]}
        frustumCulled={false}
        onPointerMove={(e) => {
          const item = itemAt(e)
          if (!item) return
          e.stopPropagation()
          useAtlasStore.getState().set({
            hover: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, customerIds: item.customerIds },
          })
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          useAtlasStore.getState().set({ hover: null })
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          const item = itemAt(e)
          if (!item) return
          e.stopPropagation()
          onSelect(item)
        }}
      />
      <instancedMesh
        ref={haloRef}
        args={[geometry, halo, capacity]}
        frustumCulled={false}
        raycast={() => null}
      />
    </group>
  )
}
