import { z } from 'zod'

import type { Supplier, SupplierPayload } from './types'

const days = z
  .string()
  .trim()
  .regex(/^\d{1,3}$/, 'Ingresa un número de días (0 a 365).')

export const supplierFormSchema = z.object({
  tax_id: z
    .string()
    .trim()
    .min(3, 'El NIT es obligatorio.')
    .max(30)
    .regex(/^[0-9A-Za-z.-]+$/, 'Solo números, letras, puntos y guiones.'),
  name: z.string().trim().min(2, 'La razón social es obligatoria.').max(200),
  contact_name: z.string().trim().max(120),
  email: z.union([z.literal(''), z.email('Correo no válido.')]),
  phone: z.string().trim().max(30),
  address: z.string().trim().max(255),
  country: z.string().trim().length(2, 'Código de país de 2 letras.'),
  city: z.string().trim().max(80),
  latitude: z.string(),
  longitude: z.string(),
  payment_terms_days: days,
  lead_time_days: days,
  issues_invoice: z.boolean(),
  is_active: z.boolean(),
  notes: z.string().max(2000),
})

export type SupplierFormInput = z.input<typeof supplierFormSchema>
export type SupplierFormValues = z.output<typeof supplierFormSchema>

export function blankSupplier(): SupplierFormInput {
  return {
    tax_id: '',
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    country: 'BO',
    city: 'Santa Cruz de la Sierra',
    latitude: '',
    longitude: '',
    payment_terms_days: '30',
    lead_time_days: '7',
    issues_invoice: true,
    is_active: true,
    notes: '',
  }
}

export function fromSupplier(s: Supplier): SupplierFormInput {
  return {
    tax_id: s.tax_id,
    name: s.name,
    contact_name: s.contact_name ?? '',
    email: s.email ?? '',
    phone: s.phone ?? '',
    address: s.address ?? '',
    country: s.country,
    city: s.city ?? '',
    latitude: s.latitude ?? '',
    longitude: s.longitude ?? '',
    payment_terms_days: String(s.payment_terms_days),
    lead_time_days: String(s.lead_time_days),
    issues_invoice: s.issues_invoice,
    is_active: s.is_active,
    notes: s.notes ?? '',
  }
}

const orNull = (v: string) => (v.trim() === '' ? null : v.trim())

export function toSupplierPayload(v: SupplierFormValues): SupplierPayload {
  return {
    tax_id: v.tax_id,
    name: v.name,
    contact_name: orNull(v.contact_name),
    email: orNull(v.email),
    phone: orNull(v.phone),
    address: orNull(v.address),
    country: v.country.toUpperCase(),
    city: orNull(v.city),
    latitude: orNull(v.latitude),
    longitude: orNull(v.longitude),
    payment_terms_days: Number(v.payment_terms_days),
    lead_time_days: Number(v.lead_time_days),
    issues_invoice: v.issues_invoice,
    is_active: v.is_active,
    notes: orNull(v.notes),
  }
}
