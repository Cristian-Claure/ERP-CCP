import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'

import { useStockAvailability } from '../../hooks'
import {
  type DocumentFormInput,
  type DocumentFormValues,
  documentFormSchema,
  emptyLine,
  normalizeDecimal,
} from '../../schemas'
import type { DocumentType, InventoryDocument } from '../../types'

export const todayIso = () => new Date().toLocaleDateString('en-CA')

/** Parses a form decimal ("1,50") into a number (0 when empty or invalid). */
export const toNumber = (v: string | undefined | null) => Number(normalizeDecimal(v ?? '')) || 0

function defaultValues(type: DocumentType, document?: InventoryDocument): DocumentFormInput {
  return {
    type,
    warehouse_id: document?.warehouse_id ?? 0,
    destination_warehouse_id: document?.destination_warehouse_id ?? null,
    document_date: document?.document_date ?? todayIso(),
    adjustment_reason: document?.adjustment_reason ?? null,
    reference: document?.reference ?? '',
    notes: document?.notes ?? '',
    lines: document?.lines?.length
      ? document.lines.map((l) => ({
          product_id: l.product_id,
          allows_decimals: l.product?.unit?.allows_decimals ?? false,
          quantity: l.quantity ? String(Number(l.quantity)) : '',
          counted_quantity: l.counted_quantity ? String(Number(l.counted_quantity)) : '',
          unit_cost: l.unit_cost ? String(Number(l.unit_cost)) : '',
        }))
      : [emptyLine()],
  }
}

/**
 * Form of the inventory document editor plus its derived figures: stock in the
 * selected warehouse, quantity requested per product and the estimated total
 * (entry: quantity × cost; others: at the current average cost).
 */
export function useDocumentEditorForm(type: DocumentType, document?: InventoryDocument) {
  const isAdjustment = type === 'adjustment'
  const isEntry = type === 'entry'
  const form = useForm<DocumentFormInput, unknown, DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: defaultValues(type, document),
    mode: 'onTouched',
  })
  const fieldArray = useFieldArray({ control: form.control, name: 'lines' })
  const lines = useWatch({ control: form.control, name: 'lines' })
  const warehouseId = useWatch({ control: form.control, name: 'warehouse_id' })
  const reason = useWatch({ control: form.control, name: 'adjustment_reason' })

  const productIds = useMemo(() => [...new Set(lines.map((l) => l.product_id).filter((v) => v > 0))], [lines])
  const { data: availability } = useStockAvailability(warehouseId || undefined, productIds)
  const stockOf = (productId: number) => availability?.find((a) => a.product_id === productId)

  // Requested quantity per product (a product may appear in several lines).
  const requestedByProduct = useMemo(() => {
    const totals = new Map<number, number>()
    for (const l of lines) {
      if (!l.product_id) continue
      totals.set(l.product_id, (totals.get(l.product_id) ?? 0) + toNumber(l.quantity))
    }
    return totals
  }, [lines])

  const estimatedTotal = lines.reduce((sum, l) => {
    const qty = toNumber(isAdjustment ? l.counted_quantity : l.quantity)
    if (isEntry) return sum + qty * toNumber(l.unit_cost)
    const stock = stockOf(l.product_id)
    if (!stock) return sum
    const units = isAdjustment ? Math.abs(qty - Number(stock.quantity)) : qty
    return sum + units * Number(stock.avg_cost)
  }, 0)

  return {
    form,
    fieldArray,
    lines,
    warehouseId,
    reason,
    productIds,
    stockOf,
    requestedByProduct,
    estimatedTotal,
  }
}

export type DocumentEditorState = ReturnType<typeof useDocumentEditorForm>
export type DocumentEditorForm = DocumentEditorState['form']
