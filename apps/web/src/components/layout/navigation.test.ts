import { findNavMatch, visibleNavigation } from './navigation'

describe('navigation', () => {
  it('hides items the user cannot access and drops empty sections', () => {
    const sections = visibleNavigation((p) => ['dashboard.view', 'sales.view'].includes(p))

    expect(sections.map((s) => s.title)).toEqual(['General', 'Operaciones'])
    expect(sections[1]?.items.map((i) => i.title)).toEqual(['Ventas'])
  })

  it('matches nested paths to their module', () => {
    expect(findNavMatch('/finanzas/cuentas')?.item.title).toBe('Cuentas')
    expect(findNavMatch('/')?.item.title).toBe('Dashboard')
    expect(findNavMatch('/no-existe')).toBeNull()
  })
})
