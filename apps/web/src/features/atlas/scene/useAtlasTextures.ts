import { useEffect, useState } from 'react'
import { LoadingManager, NoColorSpace, SRGBColorSpace, type Texture, TextureLoader } from 'three'

import { pickTextureQuality, textureUrls } from '../lib/device'
import { useAtlasStore } from '../store'

export interface AtlasTextures {
  day: Texture
  night: Texture
  specular: Texture
  bump: Texture
  clouds: Texture
}

/**
 * Loads the Earth textures (2K or 4K by device) with real progress reported to
 * the store, and disposes them when Atlas unmounts (GPU memory is freed).
 */
export function useAtlasTextures(maxAnisotropy: number): AtlasTextures | null {
  const [textures, setTextures] = useState<AtlasTextures | null>(null)

  useEffect(() => {
    let cancelled = false
    const urls = textureUrls(pickTextureQuality())
    const manager = new LoadingManager()
    manager.onProgress = (_url, loaded, total) =>
      useAtlasStore.getState().set({ loadProgress: loaded / total })
    const loader = new TextureLoader(manager)
    const loaded: Partial<AtlasTextures> = {}

    const entries = Object.entries(urls) as [keyof AtlasTextures, string][]
    Promise.all(
      entries.map(
        ([key, url]) =>
          new Promise<void>((resolve, reject) => {
            loader.load(
              url,
              (tex) => {
                // Color maps are sRGB; masks/heights are linear data.
                tex.colorSpace = key === 'day' || key === 'night' ? SRGBColorSpace : NoColorSpace
                tex.anisotropy = key === 'day' ? Math.min(8, maxAnisotropy) : 1
                loaded[key] = tex
                resolve()
              },
              undefined,
              reject,
            )
          }),
      ),
    )
      .then(() => {
        if (cancelled) Object.values(loaded).forEach((t) => t?.dispose())
        else setTextures(loaded as AtlasTextures)
      })
      .catch(() => useAtlasStore.getState().set({ loadProgress: -1 }))

    return () => {
      cancelled = true
      Object.values(loaded).forEach((t) => t?.dispose())
      useAtlasStore.getState().set({ loadProgress: 0 })
    }
  }, [maxAnisotropy])

  return textures
}
