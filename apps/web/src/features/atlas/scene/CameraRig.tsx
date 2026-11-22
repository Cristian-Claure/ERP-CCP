import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { latLngToVector3 } from '../lib/geo'
import { useAtlasStore } from '../store'
import type { FlyTarget } from '../types'

interface Flight {
  fromDir: Vector3
  toDir: Vector3
  fromDist: number
  toDist: number
  angle: number
  t: number
  duration: number
}

/** Pause before auto-rotation resumes after the user touches the globe. */
const IDLE_MS = 7000
/** Seconds each tour stop is shown. */
const TOUR_STOP_SECONDS = 5

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)

/**
 * Camera behaviour: orbit/zoom with mouse and touch (OrbitControls), smooth
 * flights to a point (great-circle + zoom), automatic tour, idle
 * auto-rotation (never with prefers-reduced-motion) and the camera distance
 * that drives clustering and borders LOD.
 */
export function CameraRig({
  reducedMotion,
  stops,
}: {
  reducedMotion: boolean
  stops: { lat: number; lng: number }[]
}) {
  const { camera, gl } = useThree()
  const controls = useRef<OrbitControls | null>(null)
  const flight = useRef<Flight | null>(null)
  const tour = useRef({ index: 0, elapsed: TOUR_STOP_SECONDS })

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.enablePan = false
    c.minDistance = 1.12
    c.maxDistance = 6
    c.zoomSpeed = 0.8
    const onStart = () => {
      flight.current = null
      useAtlasStore.getState().set({ touring: false, flyTarget: null, lastInteraction: performance.now() })
    }
    c.addEventListener('start', onStart)
    controls.current = c
    return () => {
      c.removeEventListener('start', onStart)
      c.dispose()
      controls.current = null
    }
  }, [camera, gl])

  useEffect(() => {
    const start = (target: FlyTarget) => {
      const fromDir = camera.position.clone().normalize()
      const toDir = latLngToVector3(target.lat, target.lng, 1).normalize()
      const angle = fromDir.angleTo(toDir)
      flight.current = {
        fromDir,
        toDir,
        fromDist: camera.position.length(),
        toDist: target.distance,
        angle,
        t: 0,
        duration: reducedMotion ? 0.001 : 1.2 + angle * 0.55,
      }
    }
    return useAtlasStore.subscribe((s, prev) => {
      if (s.flyTarget && s.flyTarget !== prev.flyTarget) start(s.flyTarget)
      if (s.touring && !prev.touring) tour.current = { index: 0, elapsed: TOUR_STOP_SECONDS }
    })
  }, [camera, reducedMotion])

  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return
    const state = useAtlasStore.getState()
    const f = flight.current

    if (f) {
      f.t = Math.min(1, f.t + delta / f.duration)
      const e = easeInOutCubic(f.t)
      // Spherical interpolation of the viewing direction, with a little "lift" on long flights.
      const dir = new Vector3().copy(f.fromDir).lerp(f.toDir, e).normalize()
      if (f.angle > Math.PI * 0.9)
        dir
          .copy(f.fromDir)
          .applyAxisAngle(new Vector3(0, 1, 0), e * f.angle)
          .normalize()
      const dist = f.fromDist + (f.toDist - f.fromDist) * e + Math.sin(Math.PI * e) * f.angle * 0.35
      camera.position.copy(dir.multiplyScalar(dist))
      camera.lookAt(0, 0, 0)
      if (f.t >= 1) flight.current = null
    } else if (state.touring && !reducedMotion && stops.length > 0) {
      tour.current.elapsed += delta
      if (tour.current.elapsed >= TOUR_STOP_SECONDS) {
        const stop = stops[tour.current.index % stops.length]
        tour.current = { index: tour.current.index + 1, elapsed: 0 }
        state.set({ flyTarget: { lat: stop.lat, lng: stop.lng, distance: 1.75 } })
      }
    }

    const distance = camera.position.length()
    const idle = performance.now() - state.lastInteraction > IDLE_MS
    c.autoRotate = !reducedMotion && idle && state.selectedId === null && !flight.current && !state.touring
    c.autoRotateSpeed = 0.35
    // Slower drag when close to the surface.
    c.rotateSpeed = Math.min(0.6, 0.12 + (distance - 1) * 0.25)
    c.update()

    const bucket = Math.round(distance * 20) / 20
    if (bucket !== state.cameraDistance) state.set({ cameraDistance: bucket })
  })

  return null
}
