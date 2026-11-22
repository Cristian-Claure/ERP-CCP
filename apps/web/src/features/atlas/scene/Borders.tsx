import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type BufferGeometry, LineBasicMaterial } from 'three'

import {
  findRegion,
  type LoadedBorders,
  linesToGeometry,
  loadCountries,
  loadRegions,
  shapeOutline,
} from '../lib/borders'
import { vector3ToLatLng } from '../lib/geo'
import { useAtlasStore } from '../store'

const GEO = '/atlas/geo'
/** Level of detail by camera distance. */
const DETAIL_50M_BELOW = 2.2
const BOLIVIA_BELOW = 1.65
/** Hover picking runs at most every 80 ms (point-in-polygon is not free). */
const HOVER_THROTTLE_MS = 80

type Level = '110m' | '50m'

/**
 * Country borders (Natural Earth): 1:110m seen from far, 1:50m when closer,
 * plus Bolivia's departments when very close. The country under the pointer
 * is highlighted (throttled picking on an invisible sphere).
 */
export function Borders() {
  const distance = useAtlasStore((s) => s.cameraDistance)
  const level: Level = distance < DETAIL_50M_BELOW ? '50m' : '110m'
  const showDepartments = distance < BOLIVIA_BELOW
  const [data, setData] = useState<Partial<Record<Level | 'bolivia', LoadedBorders>>>({})
  const [highlight, setHighlight] = useState<BufferGeometry | null>(null)
  const lastPick = useRef(0)
  const hovered = useRef<string | null>(null)

  // Lazy loading: each level is fetched the first time it is needed.
  useEffect(() => {
    let cancelled = false
    const need: (Level | 'bolivia')[] = ['110m', level, ...(showDepartments ? (['bolivia'] as const) : [])]
    for (const key of need) {
      if (data[key]) continue
      const load =
        key === 'bolivia'
          ? loadRegions(`${GEO}/bolivia-admin1.json`)
          : loadCountries(`${GEO}/countries-${key}.json`)
      void load.then((d) => !cancelled && setData((prev) => ({ ...prev, [key]: d })))
    }
    return () => {
      cancelled = true
    }
  }, [level, showDepartments, data])

  const countries = data[level] ?? data['110m']
  const countryGeometry = useMemo(
    () => (countries ? linesToGeometry(countries.lines, 1.0025) : null),
    [countries],
  )
  const departmentGeometry = useMemo(
    () => (data.bolivia ? linesToGeometry(data.bolivia.lines, 1.0022, 0.25) : null),
    [data.bolivia],
  )
  const materials = useMemo(
    () => ({
      country: new LineBasicMaterial({
        color: '#cbd5e1',
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
      department: new LineBasicMaterial({
        color: '#94a3b8',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
      highlight: new LineBasicMaterial({
        color: '#22d3ee',
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    }),
    [],
  )

  useEffect(() => () => countryGeometry?.dispose(), [countryGeometry])
  useEffect(() => () => departmentGeometry?.dispose(), [departmentGeometry])
  useEffect(() => () => highlight?.dispose(), [highlight])
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const now = performance.now()
    if (now - lastPick.current < HOVER_THROTTLE_MS || !countries) return
    lastPick.current = now
    const { lat, lng } = vector3ToLatLng(e.point)
    const department = showDepartments && data.bolivia ? findRegion(data.bolivia.shapes, lat, lng) : null
    const region = department ?? findRegion(data['110m']?.shapes ?? countries.shapes, lat, lng)
    const name = region ? (department ? `${region.name}, Bolivia` : region.name) : null
    if (name === hovered.current) return
    hovered.current = name
    useAtlasStore.getState().set({ hoverCountry: name })
    setHighlight(region ? linesToGeometry(shapeOutline(region), 1.003, 0.5) : null)
  }

  const clear = () => {
    hovered.current = null
    useAtlasStore.getState().set({ hoverCountry: null })
    setHighlight(null)
  }

  return (
    <group>
      {/* Invisible picking sphere for the hover (columns stop propagation above it). */}
      <mesh onPointerMove={onMove} onPointerOut={clear}>
        <sphereGeometry args={[1.001, 64, 32]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {countryGeometry && (
        <lineSegments geometry={countryGeometry} material={materials.country} raycast={() => null} />
      )}
      {showDepartments && departmentGeometry && (
        <lineSegments geometry={departmentGeometry} material={materials.department} raycast={() => null} />
      )}
      {highlight && <lineSegments geometry={highlight} material={materials.highlight} raycast={() => null} />}
    </group>
  )
}
