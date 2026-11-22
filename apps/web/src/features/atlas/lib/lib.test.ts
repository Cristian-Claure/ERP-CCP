import { SphereGeometry, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { cellSizeForDistance, clusterPoints, hexbinPoints } from './cluster'
import { angularDistance, greatCircleArc, latLngToVector3, vector3ToLatLng } from './geo'
import { subsolarPoint, sunDirection } from './sun'

describe('latLngToVector3', () => {
  it('maps the reference points of the globe', () => {
    const close = (v: Vector3, x: number, y: number, z: number) => {
      expect(v.x).toBeCloseTo(x, 6)
      expect(v.y).toBeCloseTo(y, 6)
      expect(v.z).toBeCloseTo(z, 6)
    }
    close(latLngToVector3(90, 0), 0, 1, 0) // north pole
    close(latLngToVector3(-90, 0), 0, -1, 0) // south pole
    close(latLngToVector3(0, 0), 1, 0, 0) // Gulf of Guinea
    close(latLngToVector3(0, 90), 0, 0, -1)
    close(latLngToVector3(0, -90), 0, 0, 1)
  })

  it('agrees with SphereGeometry UVs (point lands on its texture pixel)', () => {
    const geo = new SphereGeometry(1, 64, 32)
    const pos = geo.attributes.position
    const uv = geo.attributes.uv
    for (const i of [70, 300, 1200, 1800]) {
      const lng = uv.getX(i) * 360 - 180
      const lat = uv.getY(i) * 180 - 90
      const v = latLngToVector3(lat, lng)
      expect(v.distanceTo(new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)))).toBeLessThan(1e-6)
    }
  })

  it('round-trips through vector3ToLatLng (Santa Cruz, Shanghai, Madrid)', () => {
    for (const [lat, lng] of [
      [-17.7833, -63.1821],
      [31.2304, 121.4737],
      [40.4168, -3.7038],
    ]) {
      const back = vector3ToLatLng(latLngToVector3(lat, lng, 1.3))
      expect(back.lat).toBeCloseTo(lat, 6)
      expect(back.lng).toBeCloseTo(lng, 6)
    }
  })

  it('measures great-circle distances and builds lifted arcs', () => {
    // Santa Cruz → La Paz ≈ 550 km
    expect(angularDistance(-17.78, -63.18, -16.5, -68.15) * 6371).toBeGreaterThan(520)
    expect(angularDistance(-17.78, -63.18, -16.5, -68.15) * 6371).toBeLessThan(580)
    const arc = greatCircleArc({ lat: -17.78, lng: -63.18 }, { lat: 40.42, lng: -3.7 }, 32)
    expect(arc).toHaveLength(33)
    expect(arc[0].length()).toBeCloseTo(1, 6)
    expect(arc[32].length()).toBeCloseTo(1, 6)
    expect(arc[16].length()).toBeGreaterThan(1.2)
  })
})

describe('subsolarPoint', () => {
  it('reaches the tropics at the solstices and the equator at the equinoxes', () => {
    expect(subsolarPoint(new Date('2026-06-21T08:24:00Z')).lat).toBeCloseTo(23.44, 1)
    expect(subsolarPoint(new Date('2026-12-21T20:50:00Z')).lat).toBeCloseTo(-23.44, 1)
    expect(Math.abs(subsolarPoint(new Date('2026-03-20T14:46:00Z')).lat)).toBeLessThan(0.1)
    expect(Math.abs(subsolarPoint(new Date('2026-09-23T00:05:00Z')).lat)).toBeLessThan(0.1)
  })

  it('places solar noon according to UTC and the equation of time', () => {
    // Mid-February the sun runs ~14 min late: at 12:00 UTC it is overhead ~3.5° east.
    const feb = subsolarPoint(new Date('2026-02-11T12:00:00Z'))
    expect(feb.equationOfTime).toBeCloseTo(-14.2, 0)
    expect(feb.lng).toBeCloseTo(3.55, 0)
    // Early November it runs ~16 min early.
    expect(subsolarPoint(new Date('2026-11-03T12:00:00Z')).equationOfTime).toBeCloseTo(16.4, 0)
    // Every hour the subsolar point moves 15° west.
    const a = subsolarPoint(new Date('2026-05-01T10:00:00Z')).lng
    const b = subsolarPoint(new Date('2026-05-01T11:00:00Z')).lng
    expect(a - b).toBeCloseTo(15, 1)
  })

  it('points the sun vector at the subsolar point', () => {
    const date = new Date('2026-11-21T16:00:00Z') // noon in Bolivia ≈ sun over South America
    const sun = sunDirection(date)
    const { lat, lng } = subsolarPoint(date)
    expect(sun.length()).toBeCloseTo(1, 6)
    expect(lng).toBeGreaterThan(-70)
    expect(lng).toBeLessThan(-55)
    expect(sun.angleTo(latLngToVector3(lat, lng))).toBeLessThan(1e-6)
  })
})

describe('clustering', () => {
  const p = (id: number, lat: number, lng: number, weight = 1) => ({ id, lat, lng, weight })

  it('merges nearby customers and keeps distant ones apart', () => {
    const points = [
      p(1, -17.76, -63.19, 100),
      p(2, -17.8, -63.2, 50),
      p(3, -16.5, -68.13, 10),
      p(4, 40.42, -3.7, 5),
    ]
    const clusters = clusterPoints(points, 3.5)
    expect(clusters).toHaveLength(3)
    const sc = clusters.find((c) => c.members.some((m) => m.id === 1))!
    expect(sc.members.map((m) => m.id).sort()).toEqual([1, 2])
    expect(sc.weight).toBe(150)
    expect(sc.lat).toBeCloseTo(-17.78, 1)
  })

  it('does not cluster when the camera is close', () => {
    expect(cellSizeForDistance(1.3)).toBe(0)
    expect(clusterPoints([p(1, 0, 0), p(2, 0.001, 0.001)], 0)).toHaveLength(2)
    expect(cellSizeForDistance(5)).toBeGreaterThan(cellSizeForDistance(2))
  })

  it('computes centroids correctly across the antimeridian', () => {
    const [c] = clusterPoints([p(1, 0, 179.9), p(2, 0, 179.7)], 6)
    expect(Math.abs(c.lng)).toBeGreaterThan(179)
  })

  it('bins into hexagons summing their weights', () => {
    const bins = hexbinPoints([p(1, -17.76, -63.19, 3), p(2, -17.77, -63.18, 2), p(3, -16.5, -68.13, 1)], 1)
    expect(bins).toHaveLength(2)
    expect(bins.map((b) => b.weight).sort()).toEqual([1, 5])
  })
})
