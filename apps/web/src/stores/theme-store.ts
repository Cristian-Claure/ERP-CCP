import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

interface ThemeState {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  toggle: () => void
}

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(theme: ThemePreference): void {
  const resolved = resolveTheme(theme)
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(resolved)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#0B1020' : '#F6F7FB')
}

/** Persisted under "ccp-theme" (also read by the inline script in index.html). */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      toggle: () => get().setTheme(resolveTheme(get().theme) === 'dark' ? 'light' : 'dark'),
    }),
    { name: 'ccp-theme', version: 1 },
  ),
)
