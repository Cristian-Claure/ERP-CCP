import { api } from '@/lib/api'
import { env } from '@/lib/env'
import type { ListParams, Paginated } from '@/lib/pagination'

import type {
  AdjustmentReasonOption,
  Category,
  DocumentPayload,
  InventoryDashboard,
  InventoryDocument,
  InventorySettings,
  KardexEntry,
  KardexMeta,
  Product,
  StockAvailability,
  Unit,
  Warehouse,
  WarehouseStock,
} from './types'

const base = '/api/v1/inventory'

export interface ProductPayload {
  sku: string
  name: string
  barcode?: string | null
  description?: string | null
  category_id?: number | null
  unit_id: number
  min_stock?: string | null
  sale_price?: string | null
  min_price?: string | null
  is_active?: boolean
}

export interface KardexParams {
  warehouse_id: number
  from?: string
  to?: string
  page?: number
  per_page?: number
}

export const inventoryApi = {
  // Catalogs
  warehouses: async () => (await api.get<{ data: Warehouse[] }>(`${base}/warehouses`)).data.data,
  saveWarehouse: async (payload: Omit<Warehouse, 'id'>, id?: number) =>
    id
      ? (await api.put<Warehouse>(`${base}/warehouses/${id}`, payload)).data
      : (await api.post<Warehouse>(`${base}/warehouses`, payload)).data,
  categories: async () => (await api.get<{ data: Category[] }>(`${base}/categories`)).data.data,
  createCategory: async (name: string) => (await api.post<Category>(`${base}/categories`, { name })).data,
  units: async () => (await api.get<{ data: Unit[] }>(`${base}/units`)).data.data,
  adjustmentReasons: async () =>
    (await api.get<{ data: AdjustmentReasonOption[] }>(`${base}/adjustment-reasons`)).data.data,
  stock: async (warehouseId: number, productIds: number[]) =>
    (
      await api.get<{ data: StockAvailability[] }>(`${base}/stock`, {
        params: { warehouse_id: warehouseId, product_ids: productIds },
      })
    ).data.data,

  // Products
  products: async (params: ListParams) =>
    (await api.get<Paginated<Product>>(`${base}/products`, { params })).data,
  product: async (id: number) => (await api.get<Product>(`${base}/products/${id}`)).data,
  saveProduct: async (payload: ProductPayload, id?: number) =>
    id
      ? (await api.put<Product>(`${base}/products/${id}`, payload)).data
      : (await api.post<Product>(`${base}/products`, payload)).data,
  productStock: async (id: number) =>
    (await api.get<{ data: WarehouseStock[] }>(`${base}/products/${id}/stock`)).data.data,
  kardex: async (productId: number, params: KardexParams) =>
    (
      await api.get<{ data: KardexEntry[]; meta: KardexMeta }>(`${base}/products/${productId}/kardex`, {
        params,
      })
    ).data,
  kardexExportUrl: (productId: number, params: KardexParams) => {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    )
    return `${env.apiUrl}${base}/products/${productId}/kardex/export?${query.toString()}`
  },

  // Documents
  documents: async (params: ListParams) =>
    (await api.get<Paginated<InventoryDocument>>(`${base}/documents`, { params })).data,
  document: async (id: number) => (await api.get<InventoryDocument>(`${base}/documents/${id}`)).data,
  createDocument: async (payload: DocumentPayload, idempotencyKey: string) =>
    (
      await api.post<InventoryDocument>(`${base}/documents`, payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
    ).data,
  updateDocument: async (id: number, payload: DocumentPayload) =>
    (await api.put<InventoryDocument>(`${base}/documents/${id}`, payload)).data,
  deleteDocument: async (id: number) => {
    await api.delete(`${base}/documents/${id}`)
  },
  postDocument: async (id: number) =>
    (await api.post<InventoryDocument>(`${base}/documents/${id}/post`)).data,
  voidDocument: async (id: number, reason: string) =>
    (await api.post<InventoryDocument>(`${base}/documents/${id}/void`, { reason })).data,

  // Overview
  dashboard: async () => (await api.get<InventoryDashboard>('/api/v1/dashboard/inventory')).data,
  settings: async () => (await api.get<InventorySettings>('/api/v1/settings/inventory')).data,
  updateSettings: async (
    payload: Partial<Pick<InventorySettings, 'allow_negative_stock' | 'document_backdate_days'>>,
  ) => (await api.patch<InventorySettings>('/api/v1/settings/inventory', payload)).data,
}
