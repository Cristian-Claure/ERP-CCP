import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BackSide, Color, type Mesh, ShaderMaterial, Vector3 } from 'three'

import { GLOBE_RADIUS } from '../lib/geo'
import { sunDirection } from '../lib/sun'
import atmosphereFrag from '../shaders/atmosphere.frag.glsl?raw'
import atmosphereVert from '../shaders/atmosphere.vert.glsl?raw'
import cloudsFrag from '../shaders/clouds.frag.glsl?raw'
import earthFrag from '../shaders/earth.frag.glsl?raw'
import sphereVert from '../shaders/sphere.vert.glsl?raw'
import { useAtlasStore } from '../store'
import type { AtlasTextures } from './useAtlasTextures'

/** Clouds drift slowly on their own (radians per second). */
const CLOUD_SPEED = 0.006

/**
 * Earth + cloud layer + atmosphere. The sun direction follows real UTC time
 * (plus the time-control offset), so the day/night line is the true one.
 */
export function Earth({ textures, reducedMotion }: { textures: AtlasTextures; reducedMotion: boolean }) {
  const cloudsRef = useRef<Mesh>(null)
  const showClouds = useAtlasStore((s) => s.showClouds)
  const sun = useMemo(() => new Vector3(1, 0, 0), [])

  const earthMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: sphereVert,
        fragmentShader: earthFrag,
        uniforms: {
          dayMap: { value: textures.day },
          nightMap: { value: textures.night },
          specularMap: { value: textures.specular },
          bumpMap: { value: textures.bump },
          sunDirection: { value: sun },
          bumpScale: { value: 0.012 },
        },
      }),
    [textures, sun],
  )

  const cloudsMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: sphereVert,
        fragmentShader: cloudsFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          cloudsMap: { value: textures.clouds },
          sunDirection: { value: sun },
          opacity: { value: 0.85 },
        },
      }),
    [textures, sun],
  )

  const atmosphereMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: atmosphereVert,
        fragmentShader: atmosphereFrag,
        side: BackSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          sunDirection: { value: sun },
          dayColor: { value: new Color('#4f9dff') },
          twilightColor: { value: new Color('#6366f1') },
        },
      }),
    [sun],
  )

  // Explicit GPU cleanup when Atlas unmounts or the textures change.
  useEffect(
    () => () => {
      earthMaterial.dispose()
      cloudsMaterial.dispose()
      atmosphereMaterial.dispose()
    },
    [earthMaterial, cloudsMaterial, atmosphereMaterial],
  )

  // Recompute the sun every ~second of real time (it moves 0.25°/min).
  const lastSunUpdate = useRef(-1)
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (t - lastSunUpdate.current > 1 || lastSunUpdate.current < 0) {
      lastSunUpdate.current = t
      const offset = useAtlasStore.getState().timeOffsetHours
      sunDirection(new Date(Date.now() + offset * 3_600_000), sun)
    }
    if (cloudsRef.current && !reducedMotion) cloudsRef.current.rotation.y += CLOUD_SPEED * delta
  })

  return (
    <group>
      <mesh material={earthMaterial} name="earth">
        <sphereGeometry args={[GLOBE_RADIUS, 128, 64]} />
      </mesh>
      {showClouds && (
        <mesh ref={cloudsRef} material={cloudsMaterial} renderOrder={1}>
          <sphereGeometry args={[GLOBE_RADIUS * 1.008, 96, 48]} />
        </mesh>
      )}
      <mesh material={atmosphereMaterial} renderOrder={2}>
        <sphereGeometry args={[GLOBE_RADIUS * 1.13, 64, 32]} />
      </mesh>
    </group>
  )
}
