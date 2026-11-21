import { z } from 'zod'

import type { DocumentPayload, DocumentType, Unit } from './types'

const DECIMAL_4 = /^\d+(\.\d{1,4})?$/

/** "1.234,5" or "1234.5" → "1234.5" (accepts the Bolivian decimal comma). */
export function normalizeDecimal(value: string): string {
  const v = value.trim().replace(/\s/g, '')
  if (v.includes(',')) return v.replace(/\./g, '').replace(',', '.')
  return v
}

const decimalString = (label: string) =>
  z
    .string()
    .trim()
    .transform(normalizeDecimal)
    .refine((v) => v === '' || DECIMAL_4.test(v), `${label}: número válido con hasta 4 decimales.`)

export const documentLineSchema = z.object({
  product_id: z.number({ error: 'Selecciona un producto.' }).int().positive('Selecciona un producto.'),
  /** Set by the form from the selected product (not sent). */
  allows_decimals: z.boolean(),
  quantity: decimalString('Cantidad'),
  counted_quantity: decimalString('Cantidad contada'),
  unit_cost: decimalString('Costo'),
})

export const documentFormSchema = z
  .object({
    type: z.enum(['entry', 'exit', 'transfer', 'adjustment']),
    warehouse_id: z.number({ error: 'Selecciona el almacén.' }).int().positive('Selecciona el almacén.'),
    destination_warehouse_id: z.number().int().positive().nullable(),
    document_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.'),
    adjustment_reason: z.enum(['shrinkage', 'expiry', 'damage', 'entry_error', 'other']).nullable(),
    reference: z.string().trim().max(100),
    notes: z.string().trim().max(2000),
    lines: z.array(documentLineSchema).min(1, 'Agrega al menos un producto.'),
  })
  .superRefine((doc, ctx) => {
    if (doc.type === 'transfer') {
      if (!doc.destination_warehouse_id) {
        ctx.addIssue({
          code: 'custom',
          path: ['destination_warehouse_id'],
          message: 'Selecciona el almacén de destino.',
        })
      } else if (doc.destination_warehouse_id === doc.warehouse_id) {
        ctx.addIssue({
          code: 'custom',
          path: ['destination_warehouse_id'],
          message: 'Debe ser distinto del origen.',
        })
      }
    }

    if (doc.type === 'adjustment') {
      if (!doc.adjustment_reason) {
        ctx.addIssue({ code: 'custom', path: ['adjustment_reason'], message: 'Selecciona el motivo.' })
      } else if (doc.adjustment_reason === 'other' && !doc.notes) {
        ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Describe el motivo cuando eliges "Otro".' })
      }
    }

    const seen = new Set<number>()
    doc.lines.forEach((line, i) => {
      const qtyField = doc.type === 'adjustment' ? 'counted_quantity' : 'quantity'
      const value = line[qtyField]

      if (value === '') {
        ctx.addIssue({ code: 'custom', path: ['lines', i, qtyField], message: 'Requerido.' })
      } else if (doc.type !== 'adjustment' && Number(value) <= 0) {
        ctx.addIssue({ code: 'custom', path: ['lines', i, qtyField], message: 'Debe ser mayor a 0.' })
      } else if (!line.allows_decimals && !Number.isInteger(Number(value))) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines', i, qtyField],
          message: 'Esta unidad no admite decimales.',
        })
      }

      if (doc.type === 'entry' && line.unit_cost === '') {
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'unit_cost'], message: 'Ingresa el costo.' })
      }

      if (doc.type === 'adjustment' && line.product_id) {
        if (seen.has(line.product_id)) {
          ctx.addIssue({ code: 'custom', path: ['lines', i, 'product_id'], message: 'Producto repetido.' })
        }
        seen.add(line.product_id)
      }
    })
  })

export type DocumentFormInput = z.input<typeof documentFormSchema>
export type DocumentFormValues = z.output<typeof documentFormSchema>

export function emptyLine(unit?: Pick<Unit, 'allows_decimals'>) {
  return {
    product_id: 0,
    allows_decimals: unit?.allows_decimals ?? false,
    quantity: '',
    counted_quantity: '',
    unit_cost: '',
  }
}

export function toDocumentPayload(values: DocumentFormValues): DocumentPayload {
  const t: DocumentType = values.type
  return {
    type: t,
    warehouse_id: values.warehouse_id,
    destination_warehouse_id: t === 'transfer' ? values.destination_warehouse_id : null,
    document_date: values.document_date,
    adjustment_reason: t === 'adjustment' ? values.adjustment_reason : null,
    reference: values.reference || null,
    notes: values.notes || null,
    lines: values.lines.map((l) => ({
      product_id: l.product_id,
      quantity: t === 'adjustment' ? null : l.quantity,
      counted_quantity: t === 'adjustment' ? l.counted_quantity : null,
      unit_cost: t === 'entry' || t === 'adjustment' ? l.unit_cost || null : null,
    })),
  }
}

export const productFormSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'El código es obligatorio.')
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, 'Solo letras, números, punto, guion o guion bajo.'),
  name: z.string().trim().min(2, 'El nombre es obligatorio.').max(160),
  barcode: z.string().trim().max(64),
  description: z.string().trim().max(2000),
  category_id: z.number().int().positive().nullable(),
  unit_id: z.number({ error: 'Selecciona la unidad.' }).int().positive('Selecciona la unidad.'),
  min_stock: decimalString('Stock mínimo'),
  is_active: z.boolean(),
})

export type ProductFormInput = z.input<typeof productFormSchema>
export type ProductFormValues = z.output<typeof productFormSchema>

export const voidSchema = z.object({
  reason: z.string().trim().min(5, 'Describe el motivo (mínimo 5 caracteres).').max(500),
})
