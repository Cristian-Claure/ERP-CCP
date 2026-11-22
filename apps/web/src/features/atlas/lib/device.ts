/** Device capabilities that decide how Atlas renders. */

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

export type TextureQuality = '2k' | '4k'

/**
 * 4K day/night maps only when the screen and the GPU can take advantage of them:
 * large or dense display, enough memory, and a GPU that accepts 4096² textures.
 * Everything else (and every phone) gets 2K.
 */
export function pickTextureQuality(): TextureQuality {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number }
    const coarse = window.matchMedia?.('(pointer: coarse)').matches
    const pixels = window.screen.width * window.screen.height * window.devicePixelRatio ** 2
    const memory = nav.deviceMemory ?? 8
    const gl = document.createElement('canvas').getContext('webgl2')
    const maxTexture = gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 2048
    return !coarse && memory >= 4 && maxTexture >= 4096 && pixels >= 2_500_000 ? '4k' : '2k'
  } catch {
    return '2k'
  }
}

const BASE = '/atlas/textures'

export function textureUrls(quality: TextureQuality) {
  return {
    day: `${BASE}/day-${quality}.webp`,
    night: `${BASE}/night-${quality}.webp`,
    specular: `${BASE}/specular-2k.webp`,
    bump: `${BASE}/bump-2k.webp`,
    clouds: `${BASE}/clouds-2k.webp`,
  }
}
