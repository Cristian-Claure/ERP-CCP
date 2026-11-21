import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ListParams } from '@/lib/pagination'

import { inventoryApi, type KardexParams, type ProductPayload } from './api'
import type { DocumentPayload, InventorySettings } from './types'

export const inventoryKeys = {
  all: ['inventory'] as const,
  warehouses: ['inventory', 'warehouses'] as const,
  categories: ['inventory', 'categories'] as const,
  units: ['inventory', 'units'] as const,
  reasons: ['inventory', 'adjustment-reasons'] as const,
  products: (params: ListParams) => ['inventory', 'products', params] as const,
  product: (id: number) => ['inventory', 'product', id] as const,
  productStock: (id: number) => ['inventory', 'product', id, 'stock'] as const,
  kardex: (id: number, params: KardexParams) => ['inventory', 'product', id, 'kardex', params] as const,
  documents: (params: ListParams) => ['inventory', 'documents', params] as const,
  document: (id: number) => ['inventory', 'document', id] as const,
  stock: (warehouseId: number, productIds: number[]) =>
    ['inventory', 'stock', warehouseId, productIds] as const,
  dashboard: ['inventory', 'dashboard'] as const,
  settings: ['inventory', 'settings'] as const,
}

const CATALOG_STALE = 5 * 60_000

export const useWarehouses = () =>
  useQuery({ queryKey: inventoryKeys.warehouses, queryFn: inventoryApi.warehouses, staleTime: CATALOG_STALE })
export const useCategories = () =>
  useQuery({ queryKey: inventoryKeys.categories, queryFn: inventoryApi.categories, staleTime: CATALOG_STALE })
export const useUnits = () =>
  useQuery({ queryKey: inventoryKeys.units, queryFn: inventoryApi.units, staleTime: CATALOG_STALE })
export const useAdjustmentReasons = () =>
  useQuery({ queryKey: inventoryKeys.reasons, queryFn: inventoryApi.adjustmentReasons, staleTime: Infinity })

export const useProducts = (params: ListParams, enabled = true) =>
  useQuery({
    queryKey: inventoryKeys.products(params),
    queryFn: () => inventoryApi.products(params),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useProduct = (id: number | undefined) =>
  useQuery({
    queryKey: inventoryKeys.product(id ?? 0),
    queryFn: () => inventoryApi.product(id!),
    enabled: !!id && id > 0,
  })

export const useProductStock = (id: number) =>
  useQuery({ queryKey: inventoryKeys.productStock(id), queryFn: () => inventoryApi.productStock(id) })

export const useKardex = (productId: number | undefined, params: KardexParams | undefined) =>
  useQuery({
    queryKey: inventoryKeys.kardex(productId ?? 0, params ?? { warehouse_id: 0 }),
    queryFn: () => inventoryApi.kardex(productId!, params!),
    enabled: !!productId && !!params?.warehouse_id,
    placeholderData: keepPreviousData,
  })

export const useDocuments = (params: ListParams) =>
  useQuery({
    queryKey: inventoryKeys.documents(params),
    queryFn: () => inventoryApi.documents(params),
    placeholderData: keepPreviousData,
  })

export const useDocument = (id: number | undefined) =>
  useQuery({
    queryKey: inventoryKeys.document(id ?? 0),
    queryFn: () => inventoryApi.document(id!),
    enabled: !!id,
  })

/** Live availability for the document form (refreshes every 15 s while open). */
export const useStockAvailability = (warehouseId: number | undefined, productIds: number[]) =>
  useQuery({
    queryKey: inventoryKeys.stock(warehouseId ?? 0, productIds),
    queryFn: () => inventoryApi.stock(warehouseId!, productIds),
    enabled: !!warehouseId && productIds.length > 0,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  })

export const useInventoryDashboard = (enabled = true) =>
  useQuery({ queryKey: inventoryKeys.dashboard, queryFn: inventoryApi.dashboard, enabled })

export const useInventorySettings = () =>
  useQuery({ queryKey: inventoryKeys.settings, queryFn: inventoryApi.settings })

/** After any stock-changing mutation, everything inventory-related is stale. */
function useInvalidateInventory() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
}

export function useSaveProduct() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: ({ payload, id }: { payload: ProductPayload; id?: number }) =>
      inventoryApi.saveProduct(payload, id),
    onSuccess: invalidate,
  })
}

export function useSaveDocument() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: ({
      payload,
      id,
      idempotencyKey,
    }: {
      payload: DocumentPayload
      id?: number
      idempotencyKey: string
    }) =>
      id ? inventoryApi.updateDocument(id, payload) : inventoryApi.createDocument(payload, idempotencyKey),
    onSuccess: invalidate,
  })
}

export function usePostDocument() {
  const invalidate = useInvalidateInventory()
  return useMutation({ mutationFn: inventoryApi.postDocument, onSuccess: invalidate })
}

export function useVoidDocument() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => inventoryApi.voidDocument(id, reason),
    onSuccess: invalidate,
  })
}

export function useDeleteDocument() {
  const invalidate = useInvalidateInventory()
  return useMutation({ mutationFn: inventoryApi.deleteDocument, onSuccess: invalidate })
}

export function useSaveWarehouse() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: ({
      payload,
      id,
    }: {
      payload: Parameters<typeof inventoryApi.saveWarehouse>[0]
      id?: number
    }) => inventoryApi.saveWarehouse(payload, id),
    onSuccess: invalidate,
  })
}

export function useUpdateInventorySettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      payload: Partial<Pick<InventorySettings, 'allow_negative_stock' | 'document_backdate_days'>>,
    ) => inventoryApi.updateSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(inventoryKeys.settings, data)
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}
