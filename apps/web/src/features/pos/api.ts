import { api } from '@/lib/api'
import type { Customer, SalesDocument } from '@/features/sales/types'

import type { PosCheckoutPayload, PosProduct } from './types'

export const posApi = {
  catalog: async (warehouseId: number) =>
    (await api.get<{ data: PosProduct[] }>('/api/v1/pos/catalog', { params: { warehouse_id: warehouseId } }))
      .data.data,
  lookupCustomer: async (document: string) =>
    (await api.get<{ data: Customer | null }>('/api/v1/pos/customers/lookup', { params: { document } })).data
      .data,
  checkout: async (payload: PosCheckoutPayload, idempotencyKey: string) =>
    (
      await api.post<SalesDocument>('/api/v1/pos/sales', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
    ).data,
  savePreferences: async (warehouseId: number) =>
    (
      await api.patch<{ data: { pos_warehouse_id: number } }>('/api/v1/pos/preferences', {
        warehouse_id: warehouseId,
      })
    ).data.data,
}
