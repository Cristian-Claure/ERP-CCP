import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react'

import type { DocumentStatus, DocumentType } from './types'

const LOCALE = 'es-BO'

/** Quantity: up to 4 decimals, trailing zeros trimmed ("12,5"). */
export function formatQty(value: string | number | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  const text = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 4 }).format(n)
  return unit ? `${text} ${unit}` : text
}

/** Unit cost with 4 decimals when needed (min 2). */
export function formatCost(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(
    Number(value),
  )
}

export const DOCUMENT_TYPES: {
  value: DocumentType
  label: string
  /** Title for the create form (Spanish gender agreement). */
  newTitle: string
  prefix: string
  description: string
}[] = [
  {
    value: 'entry',
    label: 'Entrada',
    newTitle: 'Nueva entrada',
    prefix: 'ENT',
    description: 'Compras o ingresos de mercadería',
  },
  {
    value: 'exit',
    label: 'Salida',
    newTitle: 'Nueva salida',
    prefix: 'SAL',
    description: 'Ventas, consumos o despachos',
  },
  {
    value: 'transfer',
    label: 'Transferencia',
    newTitle: 'Nueva transferencia',
    prefix: 'TRF',
    description: 'Mover stock entre almacenes',
  },
  {
    value: 'adjustment',
    label: 'Ajuste por conteo',
    newTitle: 'Nuevo ajuste por conteo',
    prefix: 'AJU',
    description: 'Corregir según inventario físico',
  },
]

export const DOCUMENT_STATUSES: { value: DocumentStatus; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'posted', label: 'Confirmado' },
  { value: 'voided', label: 'Anulado' },
]

export function documentTypeLabel(type: DocumentType): string {
  return DOCUMENT_TYPES.find((t) => t.value === type)?.label ?? type
}

export const TYPE_ICONS: Record<DocumentType, LucideIcon> = {
  entry: ArrowDownToLine,
  exit: ArrowUpFromLine,
  transfer: ArrowLeftRight,
  adjustment: ClipboardCheck,
}
