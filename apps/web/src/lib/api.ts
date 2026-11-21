import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { toApiError } from '@/lib/api-error'
import { env } from '@/lib/env'

/**
 * Axios instance for the Laravel API (Sanctum SPA, cookie based).
 *
 * - withCredentials: sends the session cookie cross-port (localhost:5173 -> :8000).
 * - withXSRFToken: copies the XSRF-TOKEN cookie into the X-XSRF-TOKEN header,
 *   required because the API origin differs from the SPA origin.
 */
export const api = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

/** Fetches the CSRF cookie. Must run before the first state-changing request. */
export async function ensureCsrfCookie(): Promise<void> {
  await api.get('/sanctum/csrf-cookie')
}

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

/** Registered by the auth layer so a 401 anywhere clears the session in the UI. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _csrfRetried?: boolean
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined
    const status = error.response?.status

    // Expired CSRF token: refresh it once and replay the request.
    if (status === 419 && config && !config._csrfRetried) {
      config._csrfRetried = true
      await ensureCsrfCookie()
      return api.request(config)
    }

    if (status === 401 && !config?.url?.includes('/auth/me')) {
      onUnauthorized?.()
    }

    return Promise.reject(toApiError(error))
  },
)
