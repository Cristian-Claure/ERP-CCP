import { api, ensureCsrfCookie } from '@/lib/api'
import { ApiError } from '@/lib/api-error'

import type { AuthUser, LoginPayload } from './types'

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthUser> {
    await ensureCsrfCookie()
    const { data } = await api.post<AuthUser>('/api/v1/auth/login', payload)
    return data
  },

  async logout(): Promise<void> {
    await api.post('/api/v1/auth/logout')
  },

  /** Returns null when there is no active session (401). */
  async me(): Promise<AuthUser | null> {
    try {
      const { data } = await api.get<AuthUser>('/api/v1/auth/me')
      return data
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
}
