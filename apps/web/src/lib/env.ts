export const env = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000',
  appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.1.0-beta',
  isDev: import.meta.env.DEV,
  /** Map tiles: configurable to switch provider or self-host (OSM tile usage policy). */
  mapTileUrl:
    (import.meta.env.VITE_MAP_TILE_URL as string | undefined) ||
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapTileAttribution:
    (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined) ||
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
} as const
