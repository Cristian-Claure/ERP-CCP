/**
 * Screen-space-independent clustering for the globe: points are grouped by
 * cells of an approximately equal-area lat/lng grid whose size depends on how
 * far the camera is. Centroids are computed on unit vectors (correct across the
 * antimeridian and near the poles).
 */
export interface ClusterInput {
  id: number
  lat: number
  lng: number
  /** Value aggregated by the cluster (sales). */
  weight: number
}

export interface Cluster<T extends ClusterInput = ClusterInput> {
  key: string
  lat: number
  lng: number
  weight: number
  members: T[]
}

const DEG = Math.PI / 180

/**
 * Cell size (degrees) for a camera distance from the globe center (radius 1).
 * 0 = no clustering (close enough to see every customer).
 */
export function cellSizeForDistance(distance: number): number {
  if (distance <= 1.45) return 0
  if (distance <= 1.8) return 0.6
  if (distance <= 2.4) return 1.8
  if (distance <= 3.2) return 3.5
  return 6
}

export function clusterPoints<T extends ClusterInput>(points: T[], cellDeg: number): Cluster<T>[] {
  if (cellDeg <= 0) {
    return points.map((p) => ({ key: `p${p.id}`, lat: p.lat, lng: p.lng, weight: p.weight, members: [p] }))
  }

  const cells = new Map<string, T[]>()
  for (const p of points) {
    const row = Math.floor((p.lat + 90) / cellDeg)
    // Wider cells towards the poles keep them roughly equal in area.
    const rowLat = -90 + (row + 0.5) * cellDeg
    const lngSize = Math.min(360, cellDeg / Math.max(Math.cos(rowLat * DEG), 0.05))
    const col = Math.floor((p.lng + 180) / lngSize)
    const key = `${row}:${col}`
    const list = cells.get(key)
    if (list) list.push(p)
    else cells.set(key, [p])
  }

  return [...cells.entries()].map(([key, members]) => {
    let x = 0
    let y = 0
    let z = 0
    let weight = 0
    for (const m of members) {
      const phi = m.lat * DEG
      const lam = m.lng * DEG
      x += Math.cos(phi) * Math.cos(lam)
      y += Math.cos(phi) * Math.sin(lam)
      z += Math.sin(phi)
      weight += m.weight
    }
    const lat = Math.atan2(z, Math.hypot(x, y)) / DEG
    const lng = Math.atan2(y, x) / DEG
    return { key, lat, lng, weight, members }
  })
}

export interface HexBin<T extends ClusterInput = ClusterInput> extends Cluster<T> {
  q: number
  r: number
}

/**
 * Hexagonal binning (pointy-top, axial coordinates) on an equirectangular plane
 * whose x is scaled by cos(latitude): hexagons keep their shape at the
 * latitudes where the business is.
 */
export function hexbinPoints<T extends ClusterInput>(points: T[], sizeDeg: number): HexBin<T>[] {
  const bins = new Map<string, { q: number; r: number; members: T[] }>()
  for (const p of points) {
    const x = p.lng * Math.cos(p.lat * DEG)
    const y = p.lat
    const qf = ((Math.sqrt(3) / 3) * x - y / 3) / sizeDeg
    const rf = ((2 / 3) * y) / sizeDeg
    const [q, r] = axialRound(qf, rf)
    const key = `${q}:${r}`
    const bin = bins.get(key)
    if (bin) bin.members.push(p)
    else bins.set(key, { q, r, members: [p] })
  }

  return [...bins.entries()].map(([key, { q, r, members }]) => {
    const lat = sizeDeg * 1.5 * r
    const x = sizeDeg * Math.sqrt(3) * (q + r / 2)
    const lng = x / Math.max(Math.cos(lat * DEG), 0.05)
    return { key, q, r, lat, lng, weight: members.reduce((s, m) => s + m.weight, 0), members }
  })
}

function axialRound(q: number, r: number): [number, number] {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return [rq + 0, rr + 0]
}
