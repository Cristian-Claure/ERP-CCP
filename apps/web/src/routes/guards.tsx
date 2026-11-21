import { ShieldOff } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { FullScreenLoader } from '@/components/feedback/FullScreenLoader'
import { useAuth } from '@/features/auth/hooks'

/** Only authenticated users. Guests are sent to /login?redirect=<current path>. */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullScreenLoader />

  if (!isAuthenticated) {
    const redirect = `${location.pathname}${location.search}`
    const search = redirect === '/' ? '' : `?redirect=${encodeURIComponent(redirect)}`
    return <Navigate to={`/login${search}`} replace />
  }

  return <Outlet />
}

/** Hides a whole route subtree when the user lacks a permission (the API enforces it anyway). */
export function RequirePermission({ permission }: { permission: string }) {
  const { can } = useAuth()

  if (!can(permission)) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Sin acceso"
        description="Tu rol no tiene permiso para ver este módulo. Pide acceso a un administrador."
      />
    )
  }

  return <Outlet />
}

/** Only guests (login page). Authenticated users go to the dashboard. */
export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <FullScreenLoader />
  if (isAuthenticated) return <Navigate to="/" replace />

  return <Outlet />
}
