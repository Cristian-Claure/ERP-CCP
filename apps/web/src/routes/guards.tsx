import { Navigate, Outlet, useLocation } from 'react-router'

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

/** Only guests (login page). Authenticated users go to the dashboard. */
export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <FullScreenLoader />
  if (isAuthenticated) return <Navigate to="/" replace />

  return <Outlet />
}
