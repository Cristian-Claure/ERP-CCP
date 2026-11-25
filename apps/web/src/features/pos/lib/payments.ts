import { toScaled } from '@/features/sales/calc'

import type { Tender } from '../types'

export interface PaymentSummary {
  /** Applied by non-cash methods (QR, card, transfer…). */
  nonCash: number
  /** What cash must cover: total − non-cash. */
  cashDue: number
  /** Cash tendered by the customer. */
  received: number
  change: number
  /** Still to collect (0 when covered). */
  missing: number
  /** Non-cash payments above the total (cannot be given back as change). */
  excessNonCash: number
  valid: boolean
}

const c = (v: string) => toScaled(v, 2) ?? 0n
const money = (n: bigint) => Number(n) / 100

/**
 * Mirrors the server's PosCheckout::applyTenders exactly (integer cents):
 * non-cash tenders apply as is; cash covers the rest and any excess is change.
 */
export function summarizePayments(total: number, tenders: Tender[]): PaymentSummary {
  const totalCents = c(total.toFixed(2))
  let nonCash = 0n
  let received = 0n
  for (const t of tenders) {
    const amount = c(t.amount)
    if (amount <= 0n) continue
    if (t.method === 'cash') received += amount
    else nonCash += amount
  }
  const cashDue = totalCents - nonCash
  const excessNonCash = cashDue < 0n ? -cashDue : 0n
  const due = cashDue < 0n ? 0n : cashDue
  const missing = received < due ? due - received : 0n
  const change = received > due ? received - due : 0n

  return {
    nonCash: money(nonCash),
    cashDue: money(due),
    received: money(received),
    change: money(change),
    missing: money(missing),
    excessNonCash: money(excessNonCash),
    valid: totalCents > 0n && missing === 0n && excessNonCash === 0n,
  }
}

/** Common bills to suggest as "amount received" for a cash due (exact, then next 10/50/100/200). */
export function cashSuggestions(due: number): number[] {
  if (due <= 0) return []
  const out = new Set<number>([Math.round(due * 100) / 100])
  for (const step of [10, 50, 100, 200]) out.add(Math.ceil(due / step) * step)
  return [...out].sort((a, b) => a - b).slice(0, 4)
}
