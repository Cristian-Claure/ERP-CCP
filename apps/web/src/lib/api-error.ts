import { isAxiosError } from 'axios'

/** Uniform error envelope returned by the Laravel API. */
export interface ApiErrorBody {
  error: {
    status: number
    code: string
    message: string
    details?: Record<string, string[]>
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, string[]>

  constructor(status: number, code: string, message: string, details: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  get isValidation(): boolean {
    return this.status === 422
  }
}

function isApiErrorBody(data: unknown): data is ApiErrorBody {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as ApiErrorBody).error?.code === 'string'
  )
}

/** Normalizes any thrown value (axios error, network error, ...) into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (isAxiosError(error)) {
    const data: unknown = error.response?.data
    if (isApiErrorBody(data)) {
      const { status, code, message, details } = data.error
      return new ApiError(status, code, message, details)
    }
    if (!error.response) {
      return new ApiError(0, 'network_error', 'No se pudo conectar con el servidor. Revisa tu conexión.')
    }
    return new ApiError(error.response.status, 'http_error', 'Error inesperado del servidor.')
  }

  return new ApiError(0, 'unknown_error', 'Ocurrió un error inesperado.')
}
