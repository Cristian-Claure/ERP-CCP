import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { inventoryKeys } from '@/features/inventory/hooks'
import type { ListParams } from '@/lib/pagination'

import { salesApi } from './api'
import type {
  CustomerPayload,
  PaymentPayload,
  PostingAuthorizationPayload,
  SalesDocumentPayload,
  SalesSettings,
} from './types'

export const salesKeys = {
  all: ['sales'] as const,
  customers: (params: ListParams) => ['sales', 'customers', params] as const,
  customer: (id: number) => ['sales', 'customer', id] as const,
  cities: ['sales', 'cities'] as const,
  statement: (id: number, params: ListParams) => ['sales', 'customer', id, 'statement', params] as const,
  documents: (params: ListParams) => ['sales', 'documents', params] as const,
  document: (id: number) => ['sales', 'document', id] as const,
  payments: (params: ListParams) => ['sales', 'payments', params] as const,
  receivables: ['sales', 'receivables'] as const,
  dashboard: ['sales', 'dashboard'] as const,
  settings: ['sales', 'settings'] as const,
}

export const useCustomers = (params: ListParams, enabled = true) =>
  useQuery({
    queryKey: salesKeys.customers(params),
    queryFn: () => salesApi.customers(params),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useCustomer = (id: number | undefined) =>
  useQuery({ queryKey: salesKeys.customer(id ?? 0), queryFn: () => salesApi.customer(id!), enabled: !!id })

export const useCustomerCities = () =>
  useQuery({ queryKey: salesKeys.cities, queryFn: salesApi.cities, staleTime: 5 * 60_000 })

export const useStatement = (id: number, params: ListParams, enabled = true) =>
  useQuery({
    queryKey: salesKeys.statement(id, params),
    queryFn: () => salesApi.statement(id, params),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useSalesDocuments = (params: ListParams, enabled = true) =>
  useQuery({
    queryKey: salesKeys.documents(params),
    queryFn: () => salesApi.documents(params),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useSalesDocument = (id: number | undefined) =>
  useQuery({ queryKey: salesKeys.document(id ?? 0), queryFn: () => salesApi.document(id!), enabled: !!id })

export const usePayments = (params: ListParams, enabled = true) =>
  useQuery({
    queryKey: salesKeys.payments(params),
    queryFn: () => salesApi.payments(params),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useSalesDashboard = (enabled = true) =>
  useQuery({ queryKey: salesKeys.dashboard, queryFn: salesApi.dashboard, enabled })

export const useSalesSettings = () => useQuery({ queryKey: salesKeys.settings, queryFn: salesApi.settings })

/** Sales move stock and receivables: invalidate both caches after any write. */
function useInvalidateSales() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: salesKeys.all }),
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
    ])
}

export function useSaveCustomer() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: ({ payload, id }: { payload: CustomerPayload; id?: number }) =>
      salesApi.saveCustomer(payload, id),
    onSuccess: invalidate,
  })
}

export function useSaveSalesDocument() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: ({
      payload,
      id,
      idempotencyKey,
    }: {
      payload: SalesDocumentPayload
      id?: number
      idempotencyKey: string
    }) => (id ? salesApi.updateDocument(id, payload) : salesApi.createDocument(payload, idempotencyKey)),
    onSuccess: invalidate,
  })
}

export function usePostSalesDocument() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: ({ id, authorization }: { id: number; authorization?: PostingAuthorizationPayload }) =>
      salesApi.postDocument(id, authorization),
    onSuccess: invalidate,
  })
}

export function useVoidSalesDocument() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => salesApi.voidDocument(id, reason),
    onSuccess: invalidate,
  })
}

export function useDeleteSalesDocument() {
  const invalidate = useInvalidateSales()
  return useMutation({ mutationFn: salesApi.deleteDocument, onSuccess: invalidate })
}

export function useConvertQuote() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: ({ id, type }: { id: number; type: 'invoice' | 'sales_note' }) =>
      salesApi.convertQuote(id, type),
    onSuccess: invalidate,
  })
}

export function useRegisterPayment() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: PaymentPayload; idempotencyKey: string }) =>
      salesApi.registerPayment(payload, idempotencyKey),
    onSuccess: invalidate,
  })
}

export function useVoidPayment() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => salesApi.voidPayment(id, reason),
    onSuccess: invalidate,
  })
}

export function useUpdateSalesSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<Omit<SalesSettings, 'vat_rate'>>) => salesApi.updateSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(salesKeys.settings, data)
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}
