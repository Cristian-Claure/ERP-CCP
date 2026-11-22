import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

import { useAtlasStore } from '../store'

/**
 * ?perf=1: frames per second, draw calls and triangles of the last frame,
 * published to the store once per second (no per-frame React updates).
 */
export function PerfMeter() {
  const acc = useRef({ frames: 0, since: 0 })

  useFrame(({ gl }) => {
    const a = acc.current
    a.frames++
    const now = performance.now()
    if (a.since === 0) a.since = now
    if (now - a.since >= 1000) {
      useAtlasStore.getState().set({
        perf: {
          fps: Math.round((a.frames * 1000) / (now - a.since)),
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
        },
      })
      a.frames = 0
      a.since = now
    }
  })

  return null
}
