import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'

import { todayIso } from '../../format'
import { useCustomer } from '../../hooks'
import { emptySalesLine, type SalesFormInput, type SalesFormValues, salesFormSchema } from '../../schemas'
import type { SalesDocument, SalesDocumentType } from '../../types'

export type SalesEditorForm = ReturnType<typeof useSalesEditorForm>['form']

function defaultValues(
  type: SalesDocumentType,
  document: SalesDocument | undefined,
  initialCustomerId: number | undefined,
): SalesFormInput {
  return {
    type,
    customer_id: document?.customer_id ?? initialCustomerId ?? 0,
    warehouse_id: document?.warehouse_id ?? 0,
    document_date: document?.document_date ?? todayIso(),
    valid_until: document?.valid_until ?? '',
    payment_terms: document?.payment_terms ?? 'cash',
    payment_method: document?.payment_method ?? 'cash',
    global_discount: document && Number(document.global_discount) > 0 ? document.global_discount : '',
    reference: document?.reference ?? '',
    notes: document?.notes ?? '',
    lines: document?.lines?.length
      ? document.lines.map((l) => ({
          product_id: l.product_id,
          allows_decimals: l.product?.unit?.allows_decimals ?? false,
          quantity: String(Number(l.quantity)),
          unit_price: l.unit_price,
          discount_amount: Number(l.discount_amount) > 0 ? l.discount_amount : '',
        }))
      : [emptySalesLine()],
  }
}

/** React Hook Form setup of the sales editor plus the watched values the page reacts to. */
export function useSalesEditorForm({
  type,
  document,
  initialCustomerId,
}: {
  type: SalesDocumentType
  document?: SalesDocument
  initialCustomerId?: number
}) {
  const form = useForm<SalesFormInput, unknown, SalesFormValues>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: defaultValues(type, document, initialCustomerId),
    mode: 'onTouched',
  })
  const fieldArray = useFieldArray({ control: form.control, name: 'lines' })
  const lines = useWatch({ control: form.control, name: 'lines' })
  const customerId = useWatch({ control: form.control, name: 'customer_id' })
  const warehouseId = useWatch({ control: form.control, name: 'warehouse_id' })
  const terms = useWatch({ control: form.control, name: 'payment_terms' })
  const globalDiscount = useWatch({ control: form.control, name: 'global_discount' })
  const { data: customer } = useCustomer(customerId || undefined)

  // A customer preselected from its page (?cliente=) brings its payment terms.
  const presetTermsFor = initialCustomerId && !document ? initialCustomerId : undefined
  useEffect(() => {
    if (presetTermsFor && customer?.id === presetTermsFor && !form.getFieldState('payment_terms').isDirty) {
      form.setValue('payment_terms', customer.payment_terms)
    }
  }, [presetTermsFor, customer, form])

  return { form, fieldArray, lines, warehouseId, terms, globalDiscount, customer }
}
