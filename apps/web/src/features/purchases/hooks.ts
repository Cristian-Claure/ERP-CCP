import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { inventoryKeys } from '@/features/inventory/hooks'
import type { ListParams } from '@/lib/pagination'

import { purchasesApi } from './api'
import type { PurchaseOrderPayload, ReceiptPayload, SupplierPayload, SupplierPaymentPayload } from './types'

export const purchasesKeys = {
  all: ['purchases'] as const,
  suppliers: (params: ListParams) => ['purchases', 'suppliers', params] as const,
  supplier: (id: number) => ['purchases', 'supplier', id] as const,
  orders: (params: ListParams) => ['purchases', 'orders', params] as const,
  order: (id: number) => ['purchases', 'order', id] as const,
  receipts: (params: ListParams) => ['purchases', 'receipts', params] as const,
  receipt: (id: number) => ['purchases', 'receipt', id] as const,
  payments: (params: ListParams) => ['purchases', 'payments', params] as const,
  payables: ['purchases', 'payables'] as const,
  suggestions: (warehouseId?: number) => ['purchases', 'suggestions', warehouseId ?? 0] as const,
  dashboard: ['purchases', 'dashboard'] as const,
  settings: ['purchases', 'settings'] as const,
}

const list = <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>, enabled = true) => ({
  queryKey,
  queryFn,
  placeholderData: keepPreviousData,
  enabled,
})

export const useSuppliers = (params: ListParams, enabled = true) =>
  useQuery(list(purchasesKeys.suppliers(params), () => purchasesApi.suppliers(params), enabled))
export const useSupplier = (id: number | undefined) =>
  useQuery({
    queryKey: purchasesKeys.supplier(id ?? 0),
    queryFn: () => purchasesApi.supplier(id!),
    enabled: !!id,
  })
export const usePurchaseOrders = (params: ListParams) =>
  useQuery(list(purchasesKeys.orders(params), () => purchasesApi.orders(params)))
export const usePurchaseOrder = (id: number | undefined) =>
  useQuery({ queryKey: purchasesKeys.order(id ?? 0), queryFn: () => purchasesApi.order(id!), enabled: !!id })
export const useReceipts = (params: ListParams) =>
  useQuery(list(purchasesKeys.receipts(params), () => purchasesApi.receipts(params)))
export const useReceipt = (id: number | undefined) =>
  useQuery({
    queryKey: purchasesKeys.receipt(id ?? 0),
    queryFn: () => purchasesApi.receipt(id!),
    enabled: !!id,
  })
export const useSupplierPayments = (params: ListParams) =>
  useQuery(list(purchasesKeys.payments(params), () => purchasesApi.payments(params)))
export const usePayables = (enabled = true) =>
  useQuery({ queryKey: purchasesKeys.payables, queryFn: purchasesApi.payables, enabled })
export const useSuggestions = (warehouseId?: number) =>
  useQuery({
    queryKey: purchasesKeys.suggestions(warehouseId),
    queryFn: () => purchasesApi.suggestions(warehouseId),
  })
export const usePurchasesDashboard = (enabled = true) =>
  useQuery({ queryKey: purchasesKeys.dashboard, queryFn: purchasesApi.dashboard, enabled })
export const usePurchaseSettings = () =>
  useQuery({ queryKey: purchasesKeys.settings, queryFn: purchasesApi.settings })

/** Purchases touch stock (ENT-) and the Atlas supplier layer: refresh all of it. */
function useInvalidatePurchases() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: purchasesKeys.all })
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['atlas'] })
  }
}

export function useSaveSupplier() {
  const onSuccess = useInvalidatePurchases()
  return useMutation({
    mutationFn: ({ payload, id }: { payload: SupplierPayload; id?: number }) =>
      purchasesApi.saveSupplier(payload, id),
    onSuccess,
  })
}

export function useSaveOrder() {
  const onSuccess = useInvalidatePurchases()
  return useMutation({
    mutationFn: ({
      payload,
      id,
      idempotencyKey,
    }: {
      payload: PurchaseOrderPayload
      id?: number
      idempotencyKey?: string
    }) => purchasesApi.saveOrder(payload, id, idempotencyKey),
    onSuccess,
  })
}

export function useApproveOrder() {
  const onSuccess = useInvalidatePurchases()
  return useMutation({ mutationFn: purchasesApi.approveOrder, onSuccess })
}

export function useCancelOrder() {
  const onSuccess = useInvalidatePurchases()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => purchasesApi.cancelOrder(id, reason),
    onSuccess,
  })
}

export function useReceiveOrder() {
  const onSuccess = useInvalidatePurchases()
  return useMutation({
    mutationFn: ({ orderId, payload, key }: { orderId: number; payload: ReceiptPayload; key: string }) =>
      purchasesApi.receive(orderId, payload, key),
    onSuccess,
  })
}

export function useVoidReceipt() {
  const onSuccess = useInvalidatePurchases()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => purchasesApi.voidReceipt(id, reason),
    onSuccess,
  })
}

export function usePaySupplier() {
  const onSuccess = useInvalidatePurchases()
  return useMutation({
    mutationFn: ({ payload, key }: { payload: SupplierPaymentPayload; key: string }) =>
      purchasesApi.pay(payload, key),
    onSuccess,
  })
}

export function useVoidSupplierPayment() {
  const onSuccess = useInvalidatePurchases()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => purchasesApi.voidPayment(id, reason),
    onSuccess,
  })
}

export function useOrderFromSuggestion() {
  const onSuccess = useInvalidatePurchases()
  return useMutation({ mutationFn: purchasesApi.orderFromSuggestion, onSuccess })
}

export function useSavePurchaseSettings() {
  const onSuccess = useInvalidatePurchases()
  return useMutation({ mutationFn: purchasesApi.saveSettings, onSuccess })
}
