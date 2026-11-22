import { z } from 'zod'

import { moneyString, normalizeDecimal } from '@/features/inventory/schemas'

import type { CustomerPayload, PaymentPayload, SalesDocumentPayload } from './types'

const DECIMAL_4 = /^\d+(\.\d{1,4})?$/

/* -------------------------------- Customer -------------------------------- */

const coordinate = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform(normalizeDecimal)
    .refine(
      (v) => v === '' || (/^-?\d+(\.\d{1,6})?$/.test(v) && Number(v) >= min && Number(v) <= max),
      'Coordenada inválida.',
    )

export const customerFormSchema = z
  .object({
    document_type: z.enum(['ci', 'ci_complement', 'nit', 'passport', 'cex']),
    document_number: z
      .string()
      .trim()
      .min(1, 'El número de documento es obligatorio.')
      .max(20)
      .regex(/^[0-9A-Za-z-]+$/, 'Usa solo números, letras o guion.'),
    complement: z.string().trim().max(5),
    name: z.string().trim().min(2, 'La razón social o nombre es obligatorio.').max(200),
    email: z.union([z.literal(''), z.email('Correo inválido.')]),
    phone: z.string().trim().max(30),
    address: z.string().trim().max(255),
    city: z.string().trim().max(80),
    department: z.string().trim().max(80),
    country: z.string().trim().length(2, 'Código de país de 2 letras.'),
    latitude: coordinate(-90, 90),
    longitude: coordinate(-180, 180),
    payment_terms: z.enum(['cash', 'credit']),
    credit_days: z.string().trim(),
    credit_limit: moneyString('Límite de crédito'),
    segment: z.enum(['retail', 'wholesale', 'corporate']),
    is_active: z.boolean(),
    notes: z.string().trim().max(2000),
  })
  .superRefine((c, ctx) => {
    if (c.document_type === 'ci_complement' && !/^[0-9A-Za-z]{1,5}$/.test(c.complement)) {
      ctx.addIssue({ code: 'custom', path: ['complement'], message: 'Ingresa el complemento del CI.' })
    }
    if (c.payment_terms === 'credit') {
      const days = Number(c.credit_days)
      if (c.credit_days === '' || !Number.isInteger(days) || days < 0 || days > 365) {
        ctx.addIssue({ code: 'custom', path: ['credit_days'], message: 'Plazo entre 0 y 365 días.' })
      }
      if (c.credit_limit === '') {
        ctx.addIssue({ code: 'custom', path: ['credit_limit'], message: 'Ingresa el límite de crédito.' })
      }
    }
    if ((c.latitude === '') !== (c.longitude === '')) {
      ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Fija la ubicación completa en el mapa.' })
    }
  })

export type CustomerFormInput = z.input<typeof customerFormSchema>
export type CustomerFormValues = z.output<typeof customerFormSchema>

export function toCustomerPayload(v: CustomerFormValues): CustomerPayload {
  const credit = v.payment_terms === 'credit'
  return {
    document_type: v.document_type,
    document_number: v.document_number,
    complement: v.document_type === 'ci_complement' ? v.complement.toUpperCase() : null,
    name: v.name,
    email: v.email || null,
    phone: v.phone || null,
    address: v.address || null,
    city: v.city || null,
    department: v.department || null,
    country: v.country.toUpperCase(),
    latitude: v.latitude || null,
    longitude: v.longitude || null,
    payment_terms: v.payment_terms,
    credit_days: credit ? Number(v.credit_days) : null,
    credit_limit: credit ? v.credit_limit : null,
    segment: v.segment,
    is_active: v.is_active,
    notes: v.notes || null,
  }
}

/* ----------------------------- Sales document ----------------------------- */

export const salesLineSchema = z.object({
  product_id: z.number({ error: 'Selecciona un producto.' }).int().positive('Selecciona un producto.'),
  /** UI only (from the selected product). */
  allows_decimals: z.boolean(),
  quantity: z
    .string()
    .trim()
    .transform(normalizeDecimal)
    .refine((v) => DECIMAL_4.test(v) && Number(v) > 0, 'Cantidad mayor a 0.'),
  unit_price: moneyString('Precio').refine((v) => v !== '', 'Ingresa el precio.'),
  discount_amount: moneyString('Descuento'),
})

export const salesFormSchema = z
  .object({
    type: z.enum(['quote', 'invoice', 'sales_note']),
    customer_id: z.number({ error: 'Selecciona el cliente.' }).int().positive('Selecciona el cliente.'),
    warehouse_id: z.number({ error: 'Selecciona el almacén.' }).int().positive('Selecciona el almacén.'),
    document_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.'),
    valid_until: z.string(),
    payment_terms: z.enum(['cash', 'credit']),
    payment_method: z.enum(['cash', 'transfer', 'qr', 'card', 'check']),
    global_discount: moneyString('Descuento global'),
    reference: z.string().trim().max(100),
    notes: z.string().trim().max(2000),
    lines: z.array(salesLineSchema).min(1, 'Agrega al menos un producto.'),
  })
  .superRefine((doc, ctx) => {
    doc.lines.forEach((line, i) => {
      if (!line.allows_decimals && !Number.isInteger(Number(line.quantity))) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines', i, 'quantity'],
          message: 'Esta unidad no admite decimales.',
        })
      }
    })
    if (doc.type === 'quote' && doc.valid_until && doc.valid_until < doc.document_date) {
      ctx.addIssue({ code: 'custom', path: ['valid_until'], message: 'No puede ser anterior a la fecha.' })
    }
  })

export type SalesFormInput = z.input<typeof salesFormSchema>
export type SalesFormValues = z.output<typeof salesFormSchema>

export const emptySalesLine = () => ({
  product_id: 0,
  allows_decimals: false,
  quantity: '1',
  unit_price: '',
  discount_amount: '',
})

export function toSalesPayload(v: SalesFormValues): SalesDocumentPayload {
  return {
    type: v.type,
    customer_id: v.customer_id,
    warehouse_id: v.warehouse_id,
    document_date: v.document_date,
    valid_until: v.type === 'quote' ? v.valid_until || null : null,
    payment_terms: v.payment_terms,
    payment_method: v.payment_terms === 'cash' ? v.payment_method : null,
    global_discount: v.global_discount || '0',
    reference: v.reference || null,
    notes: v.notes || null,
    lines: v.lines.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_amount: l.discount_amount || '0',
    })),
  }
}

/* --------------------------------- Payment -------------------------------- */

export const paymentFormSchema = z.object({
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.'),
  method: z.enum(['cash', 'transfer', 'qr', 'card', 'check']),
  amount: moneyString('Monto').refine((v) => v !== '' && Number(v) > 0, 'Ingresa un monto mayor a 0.'),
  reference: z.string().trim().max(100),
  notes: z.string().trim().max(2000),
})

export type PaymentFormInput = z.input<typeof paymentFormSchema>
export type PaymentFormValues = z.output<typeof paymentFormSchema>

export function toPaymentPayload(v: PaymentFormValues, customerId: number, saleId?: number): PaymentPayload {
  return {
    customer_id: customerId,
    payment_date: v.payment_date,
    method: v.method,
    amount: v.amount,
    reference: v.reference || null,
    notes: v.notes || null,
    allocations: saleId ? [{ sales_document_id: saleId, amount: v.amount }] : undefined,
  }
}

export const reasonSchema = z.object({
  reason: z.string().trim().min(5, 'Describe el motivo (mínimo 5 caracteres).').max(500),
})
