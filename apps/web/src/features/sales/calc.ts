/**
 * Client mirror of the API's SalesCalculator (ADR 0005), used for the live
 * totals of the sales form. Exact integer arithmetic (BigInt cents), half-up
 * rounding — the server recomputes authoritatively on save and post, and
 * both must agree to the cent.
 *
 * - gross = round(qty × price) − line discount
 * - global discount prorated over the gross amounts (residual to the last line)
 * - prices include VAT: vat = round(total × 13 %), distributed the same way; net = total − vat
 */

export const VAT_RATE_PERCENT = 13n

export interface CalcLineInput {
  quantity: string
  unit_price: string
  discount_amount?: string | null
}

export interface CalcLine {
  extended: number
  gross: number
  globalShare: number
  total: number
  vat: number
  net: number
}

export interface CalcResult {
  lines: CalcLine[]
  subtotal: number
  lineDiscountTotal: number
  globalDiscount: number
  total: number
  vat: number
  net: number
  /** Field → message, same keys the API uses. */
  errors: Record<string, string>
}

/** Parses a decimal string into an integer scaled by 10^scale ("12.5", 4 → 125000n). Invalid → null. */
export function toScaled(value: string | null | undefined, scale: number): bigint | null {
  const v = (value ?? '').trim()
  if (v === '') return 0n
  if (!/^-?\d+(\.\d+)?$/.test(v)) return null
  const negative = v.startsWith('-')
  const [int, frac = ''] = v.replace('-', '').split('.')
  const padded = (frac + '0'.repeat(scale + 1)).slice(0, scale + 1)
  let n = BigInt(int + padded.slice(0, scale))
  if (Number(padded[scale]) >= 5) n += 1n // half-up on the next digit
  return negative ? -n : n
}

/** a / b rounded half-up (non-negative operands). */
function divRound(a: bigint, b: bigint): bigint {
  return (2n * a + b) / (2n * b)
}

/** Splits `amount` proportionally to `weights`; residual to the last non-zero weight. */
export function prorate(amount: bigint, weights: bigint[]): bigint[] {
  const total = weights.reduce((s, w) => s + w, 0n)
  if (total === 0n) return weights.map(() => 0n)
  let last = -1
  weights.forEach((w, i) => {
    if (w !== 0n) last = i
  })
  let assigned = 0n
  return weights.map((w, i) => {
    if (i === last) return amount - assigned
    const share = divRound(amount * w, total)
    assigned += share
    return share
  })
}

const cents = (n: bigint) => Number(n) / 100

export function computeSalesTotals(
  lines: CalcLineInput[],
  globalDiscount: string | null | undefined,
  breakDownVat: boolean,
): CalcResult {
  const errors: Record<string, string> = {}
  const extended: bigint[] = []
  const grosses: bigint[] = []
  let subtotal = 0n
  let lineDiscounts = 0n

  lines.forEach((line, i) => {
    const qty = toScaled(line.quantity, 4) ?? 0n // 10^-4
    const price = toScaled(line.unit_price, 2) ?? 0n // cents
    const discount = toScaled(line.discount_amount, 2) ?? 0n
    const ext = qty < 0n || price < 0n ? 0n : divRound(qty * price, 10_000n) // → cents
    if (discount < 0n || discount > ext) {
      errors[`lines.${i}.discount_amount`] = 'El descuento no puede ser negativo ni mayor al importe de la línea.'
    }
    extended.push(ext)
    grosses.push(ext - (discount > ext ? ext : discount))
    subtotal += ext
    lineDiscounts += discount
  })

  const grossTotal = grosses.reduce((s, g) => s + g, 0n)
  let global = toScaled(globalDiscount, 2) ?? 0n
  if (global < 0n || global > grossTotal) {
    errors.global_discount = 'El descuento global no puede ser negativo ni mayor al total.'
    global = global < 0n ? 0n : grossTotal
  }

  const shares = prorate(global, grosses)
  const totals = grosses.map((g, i) => g - shares[i])
  const total = grossTotal - global
  const vat = breakDownVat ? divRound(total * VAT_RATE_PERCENT, 100n) : 0n
  const vats = prorate(vat, totals)

  return {
    lines: grosses.map((g, i) => ({
      extended: cents(extended[i]),
      gross: cents(g),
      globalShare: cents(shares[i]),
      total: cents(totals[i]),
      vat: cents(vats[i]),
      net: cents(totals[i] - vats[i]),
    })),
    subtotal: cents(subtotal),
    lineDiscountTotal: cents(lineDiscounts),
    globalDiscount: cents(global),
    total: cents(total),
    vat: cents(vat),
    net: cents(total - vat),
    errors,
  }
}
