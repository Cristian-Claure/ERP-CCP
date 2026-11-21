import { api } from '@/lib/api'
import type { ListParams, Paginated } from '@/lib/pagination'

import type {
  Aging,
  Customer,
  CustomerPayload,
  Payment,
  PaymentPayload,
  PostingAuthorizationPayload,
  ReceivablesSummary,
  SalesDashboard,
  SalesDocument,
  SalesDocumentPayload,
  SalesSettings,
  StatementResponse,
} from './types'

export const salesApi = {
  // Customers
  customers: async (params: ListParams) => (await api.get<Paginated<Customer>>('/api/v1/customers', { params })).data,
  customer: async (id: number) =>
    (await api.get<Customer & { aging?: Aging }>(`/api/v1/customers/${id}`)).data,
  cities: async () => (await api.get<{ data: string[] }>('/api/v1/customers/cities')).data.data,
  saveCustomer: async (payload: CustomerPayload, id?: number) =>
    id
      ? (await api.put<Customer>(`/api/v1/customers/${id}`, payload)).data
      : (await api.post<Customer>('/api/v1/customers', payload)).data,
  statement: async (id: number, params: ListParams) =>
    (await api.get<StatementResponse>(`/api/v1/customers/${id}/statement`, { params })).data,

  // Sales documents
  documents: async (params: ListParams) =>
    (await api.get<Paginated<SalesDocument>>('/api/v1/sales/documents', { params })).data,
  document: async (id: number) => (await api.get<SalesDocument>(`/api/v1/sales/documents/${id}`)).data,
  createDocument: async (payload: SalesDocumentPayload, idempotencyKey: string) =>
    (
      await api.post<SalesDocument>('/api/v1/sales/documents', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
    ).data,
  updateDocument: async (id: number, payload: SalesDocumentPayload) =>
    (await api.put<SalesDocument>(`/api/v1/sales/documents/${id}`, payload)).data,
  deleteDocument: async (id: number) => {
    await api.delete(`/api/v1/sales/documents/${id}`)
  },
  postDocument: async (id: number, authorization: PostingAuthorizationPayload = {}) =>
    (await api.post<SalesDocument>(`/api/v1/sales/documents/${id}/post`, authorization)).data,
  voidDocument: async (id: number, reason: string) =>
    (await api.post<SalesDocument>(`/api/v1/sales/documents/${id}/void`, { reason })).data,
  convertQuote: async (id: number, type: 'invoice' | 'sales_note') =>
    (await api.post<SalesDocument>(`/api/v1/sales/documents/${id}/convert`, { type })).data,

  // Receivables
  payments: async (params: ListParams) =>
    (await api.get<Paginated<Payment>>('/api/v1/receivables/payments', { params })).data,
  registerPayment: async (payload: PaymentPayload, idempotencyKey: string) =>
    (
      await api.post<Payment>('/api/v1/receivables/payments', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
    ).data,
  voidPayment: async (id: number, reason: string) =>
    (await api.post<Payment>(`/api/v1/receivables/payments/${id}/void`, { reason })).data,
  receivablesSummary: async () => (await api.get<ReceivablesSummary>('/api/v1/receivables/summary')).data,

  // Overview
  dashboard: async () => (await api.get<SalesDashboard>('/api/v1/dashboard/sales')).data,
  settings: async () => (await api.get<SalesSettings>('/api/v1/settings/sales')).data,
  updateSettings: async (payload: Partial<Omit<SalesSettings, 'vat_rate'>>) =>
    (await api.patch<SalesSettings>('/api/v1/settings/sales', payload)).data,
}
