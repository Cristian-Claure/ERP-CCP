import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

import type { AtlasCustomersResponse, AtlasPeriod, AtlasSupplier, AtlasWarehouse } from './types'

export interface AtlasFilters {
  period: AtlasPeriod
  segments: string[]
  status: string | null
}

export const atlasApi = {
  customers: async (f: AtlasFilters) =>
    (
      await api.get<AtlasCustomersResponse>('/api/v1/atlas/customers', {
        params: {
          period: f.period,
          segment: f.segments.length ? f.segments.join(',') : undefined,
          status: f.status ?? undefined,
        },
      })
    ).data,
  suppliers: async (period: AtlasPeriod) =>
    (await api.get<{ data: AtlasSupplier[] }>('/api/v1/atlas/suppliers', { params: { period } })).data.data,
  warehouses: async () => (await api.get<{ data: AtlasWarehouse[] }>('/api/v1/atlas/warehouses')).data.data,
}

export const useAtlasCustomers = (filters: AtlasFilters) =>
  useQuery({
    queryKey: ['atlas', 'customers', filters],
    queryFn: () => atlasApi.customers(filters),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

export const useAtlasWarehouses = () =>
  useQuery({ queryKey: ['atlas', 'warehouses'], queryFn: atlasApi.warehouses, staleTime: 10 * 60_000 })

export const useAtlasSuppliers = (period: AtlasPeriod, enabled: boolean) =>
  useQuery({
    queryKey: ['atlas', 'suppliers', period],
    queryFn: () => atlasApi.suppliers(period),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
