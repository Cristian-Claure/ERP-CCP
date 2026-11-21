import { FileText, type LucideIcon, ReceiptText, ScrollText } from 'lucide-react'

import type {
  CustomerDocumentType,
  CustomerSegment,
  DebtStatus,
  PaymentMethod,
  PaymentTerms,
  SalesDocumentType,
} from './types'

export const SALES_DOCUMENT_TYPES: {
  value: SalesDocumentType
  label: string
  newTitle: string
  prefix: string
  description: string
  icon: LucideIcon
}[] = [
  {
    value: 'invoice',
    label: 'Factura',
    newTitle: 'Nueva factura',
    prefix: 'VTA',
    description: 'Venta con IVA desglosado. Descuenta stock y genera la cuenta por cobrar.',
    icon: ReceiptText,
  },
  {
    value: 'sales_note',
    label: 'Nota de venta',
    newTitle: 'Nueva nota de venta',
    prefix: 'NV',
    description: 'Venta sin factura fiscal. Descuenta stock y genera la cuenta por cobrar.',
    icon: ScrollText,
  },
  {
    value: 'quote',
    label: 'Cotización',
    newTitle: 'Nueva cotización',
    prefix: 'COT',
    description: 'Propuesta con validez. No mueve stock; se convierte en venta.',
    icon: FileText,
  },
]

export const salesTypeMeta = (type: SalesDocumentType) => SALES_DOCUMENT_TYPES.find((t) => t.value === type)!

export const DOCUMENT_TYPE_OPTIONS: { value: CustomerDocumentType; label: string }[] = [
  { value: 'ci', label: 'CI' },
  { value: 'ci_complement', label: 'CI con complemento' },
  { value: 'nit', label: 'NIT' },
  { value: 'passport', label: 'Pasaporte' },
  { value: 'cex', label: 'Cédula de extranjero' },
]

export const SEGMENTS: { value: CustomerSegment; label: string }[] = [
  { value: 'retail', label: 'Minorista' },
  { value: 'wholesale', label: 'Mayorista' },
  { value: 'corporate', label: 'Corporativo' },
]

export const PAYMENT_TERMS: { value: PaymentTerms; label: string }[] = [
  { value: 'cash', label: 'Contado' },
  { value: 'credit', label: 'Crédito' },
]

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'qr', label: 'QR' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'check', label: 'Cheque' },
]

export const DEPARTMENTS = [
  'Santa Cruz',
  'La Paz',
  'Cochabamba',
  'Chuquisaca',
  'Tarija',
  'Oruro',
  'Potosí',
  'Beni',
  'Pando',
]

export const DEBT_STATUS: Record<DebtStatus, { label: string; className: string; dot: string }> = {
  none: {
    label: 'Sin deuda',
    className: 'border-border bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  current: { label: 'Al día', className: 'border-success/25 bg-success/12 text-success', dot: 'bg-success' },
  due_soon: {
    label: 'Por vencer',
    className: 'border-warning/30 bg-warning/12 text-warning',
    dot: 'bg-warning',
  },
  overdue: {
    label: 'Vencida',
    className: 'border-destructive/25 bg-destructive/10 text-destructive',
    dot: 'bg-destructive',
  },
}

export const AGING_BUCKETS: {
  key: 'not_due' | 'd0_30' | 'd31_60' | 'd61_90' | 'd90_plus'
  label: string
  color: string
}[] = [
  { key: 'not_due', label: 'Por vencer', color: 'var(--color-success)' },
  { key: 'd0_30', label: '0–30 días', color: 'var(--color-warning)' },
  { key: 'd31_60', label: '31–60 días', color: 'oklch(0.70 0.17 50)' },
  { key: 'd61_90', label: '61–90 días', color: 'oklch(0.64 0.20 35)' },
  { key: 'd90_plus', label: '+90 días', color: 'var(--color-destructive)' },
]

const dateFmt = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })

/** "2026-11-21" (business date, no timezone shift) → "21 nov 2026". */
export function formatBizDate(value: string | null | undefined): string {
  if (!value) return '—'
  return dateFmt.format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

/** Today in the browser as YYYY-MM-DD. */
export const todayIso = () => new Date().toLocaleDateString('en-CA')

/** Days between today and a YYYY-MM-DD date (negative = past). */
export function daysFromToday(value: string): number {
  const target = new Date(`${value}T00:00:00`).getTime()
  const today = new Date(`${todayIso()}T00:00:00`).getTime()
  return Math.round((target - today) / 86_400_000)
}
