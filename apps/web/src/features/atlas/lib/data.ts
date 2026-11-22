import type { AtlasCustomer } from '../types'
import { clusterPoints } from './cluster'

export interface AtlasPoint {
  id: number
  lat: number
  lng: number
  weight: number
  customer: AtlasCustomer
}

export function toPoints(customers: AtlasCustomer[]): AtlasPoint[] {
  return customers.map((c) => ({
    id: c.id,
    lat: c.lat,
    lng: c.lng,
    weight: Number(c.sales_total),
    customer: c,
  }))
}

/** Column height (scene units): square-root scale so small customers stay visible. */
export function columnHeight(weight: number, max: number): number {
  return 0.015 + 0.32 * Math.sqrt(Math.max(weight, 0) / Math.max(max, 1))
}

export interface AtlasKpis {
  customers: number
  sales: number
  salesCount: number
  debt: number | null
  overdue: number | null
}

export function computeKpis(customers: AtlasCustomer[], withReceivables: boolean): AtlasKpis {
  let sales = 0
  let salesCount = 0
  let debt = 0
  let overdue = 0
  for (const c of customers) {
    sales += Number(c.sales_total)
    salesCount += c.sales_count
    debt += Number(c.receivables?.balance ?? 0)
    overdue += Number(c.receivables?.overdue ?? 0)
  }
  return {
    customers: customers.length,
    sales,
    salesCount,
    debt: withReceivables ? debt : null,
    overdue: withReceivables ? overdue : null,
  }
}

export interface CityRank {
  key: string
  city: string
  country: string
  sales: number
  customers: number
  lat: number
  lng: number
}

/** Sales by city (with a centroid to fly to), best first. */
export function cityRanking(customers: AtlasCustomer[], limit = 5): CityRank[] {
  const map = new Map<string, CityRank & { latSum: number; lngSum: number }>()
  for (const c of customers) {
    const key = `${c.city ?? '—'}|${c.country}`
    const row = map.get(key) ?? {
      key,
      city: c.city ?? '—',
      country: c.country,
      sales: 0,
      customers: 0,
      lat: 0,
      lng: 0,
      latSum: 0,
      lngSum: 0,
    }
    row.sales += Number(c.sales_total)
    row.customers += 1
    row.latSum += c.lat
    row.lngSum += c.lng
    map.set(key, row)
  }
  return [...map.values()]
    .map(({ latSum, lngSum, ...r }) => ({ ...r, lat: latSum / r.customers, lng: lngSum / r.customers }))
    .filter((r) => r.sales > 0)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, limit)
}

/** Tour: the main sales zones (clusters of ~1.5°), largest first. */
export function tourStops(customers: AtlasCustomer[], limit = 6) {
  return clusterPoints(toPoints(customers), 1.5)
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((c) => ({ lat: c.lat, lng: c.lng, label: c.members[0].customer.city ?? '' }))
}
