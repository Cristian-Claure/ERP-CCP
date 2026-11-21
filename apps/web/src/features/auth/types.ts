export interface Company {
  id: number
  name: string
  legal_name: string
  tax_id: string
  currency: string
  timezone: string
}

export interface AuthUser {
  id: number
  name: string
  email: string
  company: Company
  roles: string[]
  permissions: string[]
  last_login_at: string | null
}

export interface LoginPayload {
  email: string
  password: string
  remember: boolean
}
