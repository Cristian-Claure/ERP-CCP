/**
 * Amount in Spanish words, as printed on Bolivian commercial documents:
 * 1250.5 → "Un mil doscientos cincuenta 50/100 Bolivianos".
 */
const UNITS = [
  '',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
]
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
]

function below1000(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const h = Math.floor(n / 100)
  const rest = n % 100
  let text = HUNDREDS[h]
  if (rest > 0) {
    const part =
      rest < 30 ? UNITS[rest] : TENS[Math.floor(rest / 10)] + (rest % 10 ? ` y ${UNITS[rest % 10]}` : '')
    text = text ? `${text} ${part}` : part
  }
  return text
}

/** "uno" shortens before "mil"/"millones": "un mil", "veintiún mil", "treinta y un mil". */
const apocope = (words: string) => words.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')

/** Integer to words, in the style of Bolivian documents ("un mil", "veintiún mil"). */
export function integerToWords(n: number): string {
  if (n === 0) return 'cero'
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (millions) parts.push(millions === 1 ? 'un millón' : `${apocope(integerToWords(millions))} millones`)
  if (thousands) parts.push(`${apocope(below1000(thousands))} mil`)
  if (rest) parts.push(below1000(rest))
  return parts.join(' ')
}

export function amountInWords(value: number, currency = 'Bolivianos'): string {
  const cents = Math.round(value * 100)
  const integer = Math.floor(cents / 100)
  const text = integerToWords(integer)
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} ${String(cents % 100).padStart(2, '0')}/100 ${currency}`
}
