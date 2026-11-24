import type { PurchaseOrderStatus, ReceiptCostKind } from './types'

export const ORDER_STATUSES: { value: PurchaseOrderStatus; label: string; className: string }[] = [
  {
    value: 'draft',
    label: 'Borrador',
    className: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  },
  { value: 'approved', label: 'Aprobada', className: 'border-brand/30 bg-brand/12 text-brand' },
  {
    value: 'partially_received',
    label: 'Recibida parcial',
    className: 'border-warning/30 bg-warning/12 text-warning',
  },
  { value: 'received', label: 'Recibida', className: 'border-success/25 bg-success/12 text-success' },
  {
    value: 'cancelled',
    label: 'Cancelada',
    className: 'border-destructive/25 bg-destructive/10 text-destructive line-through',
  },
]

export const orderStatusMeta = (status: PurchaseOrderStatus) =>
  ORDER_STATUSES.find((s) => s.value === status)!

export const COST_KINDS: { value: ReceiptCostKind; label: string }[] = [
  { value: 'freight', label: 'Flete' },
  { value: 'unloading', label: 'Descarga' },
  { value: 'other', label: 'Otros' },
]

/** ISO 3166-1 alpha-2 countries offered for suppliers (the API accepts any code). */
export const COUNTRIES: { value: string; label: string }[] = [
  { value: 'BO', label: 'Bolivia' },
  { value: 'AR', label: 'Argentina' },
  { value: 'BR', label: 'Brasil' },
  { value: 'CL', label: 'Chile' },
  { value: 'PE', label: 'Perú' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'CN', label: 'China' },
  { value: 'US', label: 'Estados Unidos' },
]

export const countryLabel = (code: string) => COUNTRIES.find((c) => c.value === code)?.label ?? code
