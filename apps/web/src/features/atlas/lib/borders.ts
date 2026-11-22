import { BufferAttribute, BufferGeometry } from 'three'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'

import { latLngToVector3 } from './geo'

/** [lng, lat] */
export type Position = [number, number]
export type Ring = Position[]

export interface RegionShape {
  name: string
  /** Each polygon: outer ring first, then holes. */
  polygons: Ring[][]
  bbox: [number, number, number, number] // minLng, minLat, maxLng, maxLat
}

interface GeoFeature {
  properties: { name?: string } | null
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] } | null
}

export function shapesFromFeatures(features: GeoFeature[]): RegionShape[] {
  return features
    .filter((f) => f.geometry)
    .map((f) => {
      const polygons =
        f.geometry!.type === 'Polygon'
          ? [f.geometry!.coordinates as Ring[]]
          : (f.geometry!.coordinates as Ring[][])
      let minLng = 180
      let minLat = 90
      let maxLng = -180
      let maxLat = -90
      for (const [lng, lat] of polygons.flatMap((p) => p[0])) {
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
      }
      return { name: f.properties?.name ?? '', polygons, bbox: [minLng, minLat, maxLng, maxLat] }
    })
}

function inRing([x, y]: Position, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Region containing a point (bbox pre-check, then even-odd rule with holes). */
export function findRegion(shapes: RegionShape[], lat: number, lng: number): RegionShape | null {
  const p: Position = [lng, lat]
  for (const s of shapes) {
    const [a, b, c, d] = s.bbox
    if (lng < a || lng > c || lat < b || lat > d) continue
    for (const poly of s.polygons) {
      if (inRing(p, poly[0]) && !poly.slice(1).some((hole) => inRing(p, hole))) return s
    }
  }
  return null
}

/**
 * Polylines ([lng, lat]) → LineSegments geometry on a sphere. Long segments are
 * subdivided so the chords never cut below the surface.
 */
export function linesToGeometry(lines: Position[][], radius: number, maxStepDeg = 1): BufferGeometry {
  const out: number[] = []
  const v = latLngToVector3(0, 0)
  const push = (lng: number, lat: number) => {
    latLngToVector3(lat, lng, radius, v)
    out.push(v.x, v.y, v.z)
  }
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, y0] = line[i]
      const [x1, y1] = line[i + 1]
      if (Math.abs(x1 - x0) > 180) continue // antimeridian jump: skip the wrap segment
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / maxStepDeg))
      for (let s = 0; s < steps; s++) {
        const t0 = s / steps
        const t1 = (s + 1) / steps
        push(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0)
        push(x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1)
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(out), 3))
  return g
}

export interface LoadedBorders {
  lines: Position[][]
  shapes: RegionShape[]
}

/** Natural Earth countries (world-atlas TopoJSON): shared border mesh + shapes. */
export async function loadCountries(url: string): Promise<LoadedBorders> {
  const topo = (await (await fetch(url)).json()) as Topology<{ countries: GeometryCollection }>
  const collection = feature(topo, topo.objects.countries) as unknown as { features: GeoFeature[] }
  const borders = mesh(topo, topo.objects.countries) as unknown as { coordinates: Position[][] }
  return { lines: borders.coordinates, shapes: shapesFromFeatures(collection.features) }
}

/** Plain GeoJSON regions (Bolivia's departments). */
export async function loadRegions(url: string): Promise<LoadedBorders> {
  const collection = (await (await fetch(url)).json()) as { features: GeoFeature[] }
  const shapes = shapesFromFeatures(collection.features)
  return { lines: shapes.flatMap((s) => s.polygons.flatMap((p) => p)), shapes }
}

export function shapeOutline(shape: RegionShape): Position[][] {
  return shape.polygons.map((p) => p[0])
}
