import type { DashboardSummary } from '../types'
import { mockDashboardSummary } from './mock-data'

/**
 * Contract consumed by the dashboard hooks/components.
 * Swap `dashboardService` for an API-backed implementation (GET /api/v1/dashboard)
 * without touching any component.
 */
export interface DashboardService {
  getSummary(): Promise<DashboardSummary>
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const mockDashboardService: DashboardService = {
  async getSummary() {
    await delay(650) // Simulated latency so skeletons are visible.
    return mockDashboardSummary
  },
}

// Future:
// export const apiDashboardService: DashboardService = {
//   async getSummary() {
//     const { data } = await api.get<DashboardSummary>('/api/v1/dashboard')
//     return data
//   },
// }

export const dashboardService: DashboardService = mockDashboardService
