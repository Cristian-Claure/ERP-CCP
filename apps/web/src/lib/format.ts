const LOCALE = 'es-BO'

const currencyFormatters = new Map<string, Intl.NumberFormat>()

/** Formats an amount in the company currency (default BOB): "Bs 12.345,50". */
export function formatCurrency(value: number, currency = 'BOB'): string {
  let formatter = currencyFormatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    currencyFormatters.set(currency, formatter)
  }
  return formatter.format(value)
}

const compactFormatter = new Intl.NumberFormat(LOCALE, {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCompact(value: number): string {
  return compactFormatter.format(value)
}

const integerFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })

export function formatInteger(value: number): string {
  return integerFormatter.format(value)
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(fractionDigits).replace('.', ',')}%`
}

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function formatDate(value: string | Date): string {
  return dateFormatter.format(typeof value === 'string' ? new Date(value) : value)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
