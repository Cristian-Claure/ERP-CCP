import { api } from '@/lib/api'
import type { ListParams, Paginated } from '@/lib/pagination'

import type {
  PayablesSummary,
  PurchaseOrder,
  PurchaseOrderPayload,
  PurchaseReceipt,
  PurchaseSettings,
  PurchaseSuggestion,
  PurchasesDashboard,
  ReceiptPayload,
  Supplier,
  SupplierPayload,
  SupplierPayment,
  SupplierPaymentPayload,
} from './types'

const key = (idempotencyKey?: string) =>
  idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}

export const purchasesApi = {
  suppliers: async (params: ListParams) =>
    (await api.get<Paginated<Supplier>>('/api/v1/purchases/suppliers', { params })).data,
  supplier: async (id: number) => (await api.get<Supplier>(`/api/v1/purchases/suppliers/${id}`)).data,
  saveSupplier: async (payload: SupplierPayload, id?: number) =>
    id
      ? (await api.put<Supplier>(`/api/v1/purchases/suppliers/${id}`, payload)).data
      : (await api.post<Supplier>('/api/v1/purchases/suppliers', payload)).data,

  orders: async (params: ListParams) =>
    (await api.get<Paginated<PurchaseOrder>>('/api/v1/purchases/orders', { params })).data,
  order: async (id: number) => (await api.get<PurchaseOrder>(`/api/v1/purchases/orders/${id}`)).data,
  saveOrder: async (payload: PurchaseOrderPayload, id?: number, idempotencyKey?: string) =>
    id
      ? (await api.put<PurchaseOrder>(`/api/v1/purchases/orders/${id}`, payload)).data
      : (await api.post<PurchaseOrder>('/api/v1/purchases/orders', payload, key(idempotencyKey))).data,
  approveOrder: async (id: number) =>
    (await api.post<PurchaseOrder>(`/api/v1/purchases/orders/${id}/approve`)).data,
  cancelOrder: async (id: number, reason: string) =>
    (await api.post<PurchaseOrder>(`/api/v1/purchases/orders/${id}/cancel`, { reason })).data,
  receive: async (orderId: number, payload: ReceiptPayload, idempotencyKey: string) =>
    (
      await api.post<PurchaseReceipt>(
        `/api/v1/purchases/orders/${orderId}/receipts`,
        payload,
        key(idempotencyKey),
      )
    ).data,

  receipts: async (params: ListParams) =>
    (await api.get<Paginated<PurchaseReceipt>>('/api/v1/purchases/receipts', { params })).data,
  receipt: async (id: number) => (await api.get<PurchaseReceipt>(`/api/v1/purchases/receipts/${id}`)).data,
  voidReceipt: async (id: number, reason: string) =>
    (await api.post<PurchaseReceipt>(`/api/v1/purchases/receipts/${id}/void`, { reason })).data,

  payables: async () => (await api.get<PayablesSummary>('/api/v1/payables/summary')).data,
  payments: async (params: ListParams) =>
    (await api.get<Paginated<SupplierPayment>>('/api/v1/payables/payments', { params })).data,
  pay: async (payload: SupplierPaymentPayload, idempotencyKey: string) =>
    (await api.post<SupplierPayment>('/api/v1/payables/payments', payload, key(idempotencyKey))).data,
  voidPayment: async (id: number, reason: string) =>
    (await api.post<SupplierPayment>(`/api/v1/payables/payments/${id}/void`, { reason })).data,

  suggestions: async (warehouseId?: number) =>
    (
      await api.get<{ data: PurchaseSuggestion[] }>('/api/v1/purchases/suggestions', {
        params: warehouseId ? { warehouse_id: warehouseId } : {},
      })
    ).data.data,
  orderFromSuggestion: async (payload: Omit<PurchaseOrderPayload, 'order_date'>) =>
    (await api.post<PurchaseOrder>('/api/v1/purchases/suggestions/orders', payload)).data,

  dashboard: async () => (await api.get<PurchasesDashboard>('/api/v1/dashboard/purchases')).data,
  settings: async () => (await api.get<PurchaseSettings>('/api/v1/settings/purchases')).data,
  saveSettings: async (payload: Partial<PurchaseSettings>) =>
    (await api.patch<PurchaseSettings>('/api/v1/settings/purchases', payload)).data,
}
