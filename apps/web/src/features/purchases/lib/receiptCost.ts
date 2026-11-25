import { prorate, toScaled, VAT_RATE_PERCENT } from '@/features/sales/calc'

export interface ReceiptCostLine {
  lineTotal: number
  vat: number
  net: number
  additional: number
  costTotal: number
  unitCost: number
}

export interface ReceiptCostPreview {
  lines: ReceiptCostLine[]
  invoiceTotal: number
  vatCredit: number
  netTotal: number
  additionalTotal: number
  costTotal: number
}

const divRound = (a: bigint, b: bigint) => (2n * a + b) / (2n * b)
const money = (n: bigint) => Number(n) / 100

/**
 * Client preview of the entry cost, exactly like the server's
 * PurchaseCostCalculator (ADR 0006), in integer cents:
 * VAT "por dentro" (total × 13 %) prorated per line as fiscal credit when the
 * supplier invoices; additional costs prorated over the nets by value.
 */
export function previewReceiptCost(
  lines: { quantity: string; unitPrice: string }[],
  additionalCosts: string[],
  issuesInvoice: boolean,
): ReceiptCostPreview {
  const totals = lines.map((l) => {
    const qty = toScaled(l.quantity, 4) ?? 0n
    const price = toScaled(l.unitPrice, 2) ?? 0n
    return qty <= 0n || price < 0n ? 0n : divRound(qty * price, 10_000n)
  })
  const invoice = totals.reduce((s, t) => s + t, 0n)
  const vat = issuesInvoice ? divRound(invoice * VAT_RATE_PERCENT, 100n) : 0n
  const vats = prorate(vat, totals)
  const nets = totals.map((t, i) => t - vats[i])
  const extra = additionalCosts.reduce((s, c) => s + (toScaled(c, 2) ?? 0n), 0n)
  const shares = prorate(extra, nets)

  const out = lines.map((l, i) => {
    const cost = nets[i] + shares[i]
    const qty = Number(l.quantity) || 0
    return {
      lineTotal: money(totals[i]),
      vat: money(vats[i]),
      net: money(nets[i]),
      additional: money(shares[i]),
      costTotal: money(cost),
      unitCost: qty > 0 ? Math.round((money(cost) / qty) * 10_000) / 10_000 : 0,
    }
  })

  return {
    lines: out,
    invoiceTotal: money(invoice),
    vatCredit: money(vat),
    netTotal: money(invoice - vat),
    additionalTotal: money(extra),
    costTotal: money(nets.reduce((s, n) => s + n, 0n) + extra),
  }
}

/** |invoiced − ordered| / ordered × 100 (0 when ordered is 0). */
export function variancePct(invoiced: string, ordered: string): number {
  const base = Number(ordered)
  if (!base) return 0
  return Math.round((Math.abs(Number(invoiced) - base) / base) * 10_000) / 100
}
