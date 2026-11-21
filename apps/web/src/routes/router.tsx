import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { navigation } from '@/components/layout/navigation'
import { FullScreenLoader } from '@/components/feedback/FullScreenLoader'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { RouteErrorPage } from '@/features/common/pages/RouteErrorPage'

import { GuestRoute, ProtectedRoute } from './guards'

/** Route-level code splitting: each page (and heavy deps like Recharts) loads on demand. */
function page<T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType }))
}

const LoginPage = page(() => import('@/features/auth/pages/LoginPage'), 'LoginPage')
const DashboardPage = page(() => import('@/features/dashboard/pages/DashboardPage'), 'DashboardPage')
const ComingSoonPage = page(() => import('@/features/common/pages/ComingSoonPage'), 'ComingSoonPage')
const NotFoundPage = page(() => import('@/features/common/pages/NotFoundPage'), 'NotFoundPage')

const withSuspense = (node: ReactNode, fallback: ReactNode = <PageSkeleton />) => (
  <Suspense fallback={fallback}>{node}</Suspense>
)

// Modules without a page yet render the "coming soon" placeholder.
const placeholderRoutes = navigation
  .flatMap((section) => section.items)
  .filter((item) => item.href !== '/')
  .map((item) => ({ path: item.href.slice(1), element: withSuspense(<ComingSoonPage />) }))

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    errorElement: <RouteErrorPage />,
    children: [{ path: '/login', element: withSuspense(<LoginPage />, <FullScreenLoader />) }],
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: withSuspense(<DashboardPage />) },
          ...placeholderRoutes,
          { path: '*', element: withSuspense(<NotFoundPage />) },
        ],
      },
    ],
  },
])
