import { Vector3 } from 'three'

/** Globe radius in scene units. Everything else is expressed relative to it. */
export const GLOBE_RADIUS = 1

const DEG = Math.PI / 180

/**
 * Latitude/longitude (degrees) → point on a sphere of radius `r`.
 *
 * Matches three.js SphereGeometry's UV mapping (u = 0 at longitude −180°), so a
 * point lands exactly on its pixel of an equirectangular texture:
 * x = −r·sinφ·cos(λ+180°), y = r·cosφ, z = r·sinφ·sin(λ+180°), with φ the polar angle.
 */
export function latLngToVector3(lat: number, lng: number, r = GLOBE_RADIUS, target = new Vector3()): Vector3 {
  const phi = (90 - lat) * DEG
  const theta = (lng + 180) * DEG
  return target.set(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

/** Inverse of latLngToVector3 (any radius). */
export function vector3ToLatLng(v: Vector3): { lat: number; lng: number } {
  const r = v.length()
  const lat = 90 - Math.acos(Math.min(1, Math.max(-1, v.y / r))) / DEG
  let lng = Math.atan2(v.z, -v.x) / DEG - 180
  if (lng < -180) lng += 360
  return { lat, lng }
}

/** Great-circle angle between two points, in radians (haversine). */
export function angularDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG
  const dLng = (lng2 - lng1) * DEG
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2
  return 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Points of an arc between two surface points: spherical interpolation along the
 * great circle, lifted with a sine profile proportional to the distance (long
 * arcs rise higher, short ones stay close to the ground).
 */
export function greatCircleArc(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  segments = 48,
  r = GLOBE_RADIUS,
): Vector3[] {
  const a = latLngToVector3(from.lat, from.lng, 1)
  const b = latLngToVector3(to.lat, to.lng, 1)
  const omega = Math.acos(Math.min(1, Math.max(-1, a.dot(b))))
  const height = Math.min(0.45, 0.04 + omega * 0.32)
  const points: Vector3[] = []

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const p =
      omega < 1e-6
        ? a.clone()
        : a
            .clone()
            .multiplyScalar(Math.sin((1 - t) * omega) / Math.sin(omega))
            .add(b.clone().multiplyScalar(Math.sin(t * omega) / Math.sin(omega)))
    points.push(p.normalize().multiplyScalar(r * (1 + height * Math.sin(Math.PI * t))))
  }
  return points
}
