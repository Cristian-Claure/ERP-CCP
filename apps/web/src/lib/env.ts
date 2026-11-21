export const env = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000',
  appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.1.0-beta',
  isDev: import.meta.env.DEV,
} as const
