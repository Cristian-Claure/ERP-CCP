import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { navigation } from '@/components/layout/navigation'
import { FullScreenLoader } from '@/components/feedback/FullScreenLoader'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { RouteErrorPage } from '@/features/common/pages/RouteErrorPage'

import { GuestRoute, ProtectedRoute, RequirePermission } from './guards'

/** Route-level code splitting: each page (and heavy deps like Recharts) loads on demand. */
function page<T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType }))
}

const LoginPage = page(() => import('@/features/auth/pages/LoginPage'), 'LoginPage')
const DashboardPage = page(() => import('@/features/dashboard/pages/DashboardPage'), 'DashboardPage')
const ComingSoonPage = page(() => import('@/features/common/pages/ComingSoonPage'), 'ComingSoonPage')
const NotFoundPage = page(() => import('@/features/common/pages/NotFoundPage'), 'NotFoundPage')
const ProductsPage = page(() => import('@/features/inventory/pages/ProductsPage'), 'ProductsPage')
const ProductDetailPage = page(
  () => import('@/features/inventory/pages/ProductDetailPage'),
  'ProductDetailPage',
)
const DocumentsPage = page(() => import('@/features/inventory/pages/DocumentsPage'), 'DocumentsPage')
const DocumentFormPage = page(() => import('@/features/inventory/pages/DocumentFormPage'), 'DocumentFormPage')
const KardexPage = page(() => import('@/features/inventory/pages/KardexPage'), 'KardexPage')
const WarehousesPage = page(() => import('@/features/inventory/pages/WarehousesPage'), 'WarehousesPage')
const CustomersPage = page(() => import('@/features/sales/pages/CustomersPage'), 'CustomersPage')
const CustomerDetailPage = page(
  () => import('@/features/sales/pages/CustomerDetailPage'),
  'CustomerDetailPage',
)
const SalesDocumentsPage = page(
  () => import('@/features/sales/pages/SalesDocumentsPage'),
  'SalesDocumentsPage',
)
const SalesDocumentPage = page(() => import('@/features/sales/pages/SalesDocumentPage'), 'SalesDocumentPage')
const SalesPrintPage = page(() => import('@/features/sales/pages/SalesPrintPage'), 'SalesPrintPage')
const PaymentsPage = page(() => import('@/features/sales/pages/PaymentsPage'), 'PaymentsPage')
const PosPage = page(() => import('@/features/pos/pages/PosPage'), 'PosPage')
const PosTicketPage = page(() => import('@/features/pos/pages/PosTicketPage'), 'PosTicketPage')
const SuppliersPage = page(() => import('@/features/purchases/pages/SuppliersPage'), 'SuppliersPage')
const PurchaseOrdersPage = page(
  () => import('@/features/purchases/pages/PurchaseOrdersPage'),
  'PurchaseOrdersPage',
)
const PurchaseOrderPage = page(
  () => import('@/features/purchases/pages/PurchaseOrderPage'),
  'PurchaseOrderPage',
)
const ReceiveOrderPage = page(() => import('@/features/purchases/pages/ReceiveOrderPage'), 'ReceiveOrderPage')
const ReceiptsPage = page(() => import('@/features/purchases/pages/ReceiptsPage'), 'ReceiptsPage')
const ReceiptPage = page(() => import('@/features/purchases/pages/ReceiptPage'), 'ReceiptPage')
const SupplierPaymentsPage = page(
  () => import('@/features/purchases/pages/SupplierPaymentsPage'),
  'SupplierPaymentsPage',
)
const SuggestionsPage = page(() => import('@/features/purchases/pages/SuggestionsPage'), 'SuggestionsPage')
const AtlasPage = page(() => import('@/features/atlas/pages/AtlasPage'), 'AtlasPage')
const SettingsPage = page(() => import('@/features/settings/pages/SettingsPage'), 'SettingsPage')

const withSuspense = (node: ReactNode, fallback: ReactNode = <PageSkeleton />) => (
  <Suspense fallback={fallback}>{node}</Suspense>
)

/** Paths with a real page; every other navigation entry shows "coming soon". */
const IMPLEMENTED = ['/', '/inventario', '/ventas', '/compras', '/atlas', '/sistema/configuracion']

const placeholderRoutes = navigation
  .flatMap((section) => section.items)
  .filter((item) => !IMPLEMENTED.includes(item.href))
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
        // Counter sale: full screen, outside the app shell. Needs sales.create + sales.post.
        path: 'pos',
        element: <RequirePermission permission="sales.create" />,
        children: [
          {
            element: <RequirePermission permission="sales.post" />,
            children: [{ index: true, element: withSuspense(<PosPage />, <FullScreenLoader />) }],
          },
        ],
      },
      {
        path: 'pos/ticket/:id',
        element: <RequirePermission permission="sales.view" />,
        children: [{ index: true, element: withSuspense(<PosTicketPage />, <FullScreenLoader />) }],
      },
      {
        path: 'ventas/documentos/:id/imprimir',
        element: <RequirePermission permission="sales.view" />,
        children: [{ index: true, element: withSuspense(<SalesPrintPage />, <FullScreenLoader />) }],
      },
      {
        element: <AppShell />,
        children: [
          { index: true, element: withSuspense(<DashboardPage />) },
          {
            path: 'inventario',
            element: <RequirePermission permission="inventory.view" />,
            children: [
              { index: true, element: <Navigate to="productos" replace /> },
              { path: 'productos', element: withSuspense(<ProductsPage />) },
              { path: 'productos/:id', element: withSuspense(<ProductDetailPage />) },
              { path: 'documentos', element: withSuspense(<DocumentsPage />) },
              { path: 'documentos/nuevo', element: withSuspense(<DocumentFormPage />) },
              { path: 'documentos/:id', element: withSuspense(<DocumentFormPage />) },
              { path: 'kardex', element: withSuspense(<KardexPage />) },
              { path: 'almacenes', element: withSuspense(<WarehousesPage />) },
            ],
          },
          {
            path: 'ventas',
            element: <RequirePermission permission="sales.view" />,
            children: [
              { index: true, element: <Navigate to="documentos" replace /> },
              { path: 'documentos', element: withSuspense(<SalesDocumentsPage />) },
              { path: 'documentos/nuevo', element: withSuspense(<SalesDocumentPage />) },
              { path: 'documentos/:id', element: withSuspense(<SalesDocumentPage />) },
              {
                element: <RequirePermission permission="customers.view" />,
                children: [
                  { path: 'clientes', element: withSuspense(<CustomersPage />) },
                  { path: 'clientes/:id', element: withSuspense(<CustomerDetailPage />) },
                ],
              },
              {
                element: <RequirePermission permission="receivables.view" />,
                children: [{ path: 'cobros', element: withSuspense(<PaymentsPage />) }],
              },
            ],
          },
          {
            path: 'compras',
            element: <RequirePermission permission="purchases.view" />,
            children: [
              { index: true, element: <Navigate to="ordenes" replace /> },
              { path: 'ordenes', element: withSuspense(<PurchaseOrdersPage />) },
              { path: 'ordenes/nueva', element: withSuspense(<PurchaseOrderPage />) },
              { path: 'ordenes/:id', element: withSuspense(<PurchaseOrderPage />) },
              { path: 'ordenes/:id/recibir', element: withSuspense(<ReceiveOrderPage />) },
              { path: 'recepciones', element: withSuspense(<ReceiptsPage />) },
              { path: 'recepciones/:id', element: withSuspense(<ReceiptPage />) },
              { path: 'sugerencias', element: withSuspense(<SuggestionsPage />) },
              {
                element: <RequirePermission permission="suppliers.view" />,
                children: [{ path: 'proveedores', element: withSuspense(<SuppliersPage />) }],
              },
              {
                element: <RequirePermission permission="payables.view" />,
                children: [{ path: 'pagos', element: withSuspense(<SupplierPaymentsPage />) }],
              },
            ],
          },
          {
            path: 'atlas',
            element: <RequirePermission permission="customers.view" />,
            children: [{ index: true, element: withSuspense(<AtlasPage />) }],
          },
          { path: 'sistema/configuracion', element: withSuspense(<SettingsPage />) },
          ...placeholderRoutes,
          { path: '*', element: withSuspense(<NotFoundPage />) },
        ],
      },
    ],
  },
])
