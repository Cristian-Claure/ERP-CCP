import { formatCurrency, formatPercent, initials } from './format'

describe('format helpers', () => {
  it('formats BOB amounts with two decimals', () => {
    const formatted = formatCurrency(12345.5)

    expect(formatted).toMatch(/Bs/)
    expect(formatted).toMatch(/12.?345,50/)
  })

  it('formats signed percentages with a comma decimal', () => {
    expect(formatPercent(7.25)).toBe('+7,3%')
    expect(formatPercent(-4.1)).toBe('-4,1%')
  })

  it('builds initials from a full name', () => {
    expect(initials('Administrador CCP')).toBe('AC')
    expect(initials('víctor')).toBe('V')
  })
})
