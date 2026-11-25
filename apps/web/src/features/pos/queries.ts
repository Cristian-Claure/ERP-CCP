import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { authKeys } from '@/features/auth/hooks'
import type { AuthUser } from '@/features/auth/types'
import { inventoryKeys } from '@/features/inventory/hooks'
import { salesKeys } from '@/features/sales/hooks'

import { posApi } from './api'
import { buildProductIndex } from './lib/search'
import type { PosCheckoutPayload } from './types'

export const posKeys = {
  catalog: (warehouseId: number) => ['pos', 'catalog', warehouseId] as const,
  customer: (document: string) => ['pos', 'customer', document] as const,
}

/**
 * The whole catalog of the warehouse, cached: search and scans resolve locally
 * and instantly. Refreshed in the background and after every sale (stock).
 */
export function usePosCatalog(warehouseId: number | undefined) {
  const query = useQuery({
    queryKey: posKeys.catalog(warehouseId ?? 0),
    queryFn: () => posApi.catalog(warehouseId!),
    enabled: !!warehouseId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })
  const index = useMemo(() => buildProductIndex(query.data ?? []), [query.data])
  return { ...query, index }
}

export const useCustomerLookup = (document: string) =>
  useQuery({
    queryKey: posKeys.customer(document),
    queryFn: () => posApi.lookupCustomer(document),
    enabled: document.trim().length >= 3,
    staleTime: 60_000,
  })

export function usePosCheckout(warehouseId: number | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ payload, key }: { payload: PosCheckoutPayload; key: string }) =>
      posApi.checkout(payload, key),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: posKeys.catalog(warehouseId ?? 0) })
      void queryClient.invalidateQueries({ queryKey: salesKeys.all })
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })
}

export function useSavePosWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: posApi.savePreferences,
    onSuccess: ({ pos_warehouse_id }) =>
      queryClient.setQueryData<AuthUser | null>(authKeys.me, (u) => (u ? { ...u, pos_warehouse_id } : u)),
  })
}
