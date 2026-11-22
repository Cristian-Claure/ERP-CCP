import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'

/** Deterministic PRNG (mulberry32) so the sky is the same on every visit. */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Star field: points on a distant shell with a few colour temperatures. */
export function Stars({ count = 4000, radius = 60 }: { count?: number; radius?: number }) {
  const geometry = useMemo(() => {
    const random = rng(2026)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const palette = [
      [0.75, 0.82, 1],
      [1, 1, 1],
      [1, 0.92, 0.78],
    ]
    for (let i = 0; i < count; i++) {
      const u = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      const r = radius * (0.85 + random() * 0.15)
      positions.set([r * s * Math.cos(theta), r * u, r * s * Math.sin(theta)], i * 3)
      const c = palette[Math.floor(random() * palette.length)]
      const b = 0.35 + random() ** 3 * 0.65
      colors.set([c[0] * b, c[1] * b, c[2] * b], i * 3)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('color', new BufferAttribute(colors, 3))
    return g
  }, [count, radius])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.12} sizeAttenuation vertexColors transparent depthWrite={false} />
    </points>
  )
}
