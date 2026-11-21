import { useThemeStore } from './theme-store'

describe('theme store', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'dark' })
    document.documentElement.className = 'dark'
  })

  it('defaults to dark', () => {
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('toggles between dark and light and updates <html>', () => {
    useThemeStore.getState().toggle()

    expect(useThemeStore.getState().theme).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists the preference in localStorage', () => {
    useThemeStore.getState().setTheme('light')

    expect(JSON.parse(localStorage.getItem('ccp-theme') ?? '{}').state.theme).toBe('light')
  })
})
