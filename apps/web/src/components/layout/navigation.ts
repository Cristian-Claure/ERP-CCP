import {
  BrainCircuit,
  Boxes,
  ChartLine,
  FileStack,
  HandCoins,
  History,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  /** Permission required to see the item (from /auth/me). */
  permission?: string
  /** Extra words for the command palette search. */
  keywords?: string[]
  /** Sub-pages (rendered as an expandable group in the sidebar). */
  children?: NavItem[]
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: 'General',
    items: [
      {
        title: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
        permission: 'dashboard.view',
        keywords: ['inicio', 'resumen'],
      },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      {
        title: 'Inventario',
        href: '/inventario',
        icon: Boxes,
        permission: 'inventory.view',
        keywords: ['stock', 'kardex', 'productos'],
        children: [
          {
            title: 'Productos',
            href: '/inventario/productos',
            icon: Package,
            keywords: ['catálogo', 'stock', 'sku'],
          },
          {
            title: 'Documentos',
            href: '/inventario/documentos',
            icon: FileStack,
            keywords: ['entrada', 'salida', 'transferencia', 'ajuste'],
          },
          {
            title: 'Kardex',
            href: '/inventario/kardex',
            icon: History,
            keywords: ['movimientos', 'costo promedio'],
          },
          {
            title: 'Almacenes',
            href: '/inventario/almacenes',
            icon: Warehouse,
            keywords: ['sucursal', 'depósito'],
          },
        ],
      },
      {
        title: 'Ventas',
        href: '/ventas',
        icon: ShoppingCart,
        permission: 'sales.view',
        keywords: ['facturas', 'clientes'],
      },
      {
        title: 'Compras',
        href: '/compras',
        icon: Truck,
        permission: 'purchases.view',
        keywords: ['proveedores', 'órdenes'],
      },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      {
        title: 'Caja y bancos',
        href: '/finanzas/caja-bancos',
        icon: Landmark,
        permission: 'finance.view',
        keywords: ['tesorería'],
      },
      {
        title: 'Cuentas',
        href: '/finanzas/cuentas',
        icon: HandCoins,
        permission: 'finance.view',
        keywords: ['cobrar', 'pagar'],
      },
    ],
  },
  {
    title: 'Inteligencia',
    items: [
      {
        title: 'Asistente IA',
        href: '/ia/asistente',
        icon: BrainCircuit,
        permission: 'ai.use',
        keywords: ['chat', 'ia'],
      },
      {
        title: 'Pronósticos',
        href: '/ia/pronosticos',
        icon: ChartLine,
        permission: 'forecasts.view',
        keywords: ['demanda', 'forecast'],
      },
    ],
  },
  {
    title: 'Sistema',
    items: [
      {
        title: 'Usuarios',
        href: '/sistema/usuarios',
        icon: Users,
        permission: 'users.manage',
        keywords: ['roles', 'permisos'],
      },
      {
        title: 'Configuración',
        href: '/sistema/configuracion',
        icon: Settings,
        permission: 'settings.manage',
        keywords: ['empresa', 'ajustes'],
      },
    ],
  },
]

/** Sections filtered by the user's permissions (empty sections are dropped). */
export function visibleNavigation(can: (permission: string) => boolean): NavSection[] {
  return navigation
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !item.permission || can(item.permission))
        .map((item) => ({
          ...item,
          children: item.children?.filter((c) => !c.permission || can(c.permission)),
        })),
    }))
    .filter((section) => section.items.length > 0)
}

export interface NavMatch {
  section: NavSection
  item: NavItem
  /** Matched sub-page, when the item has children. */
  child?: NavItem
}

export function isNavActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export function findNavMatch(pathname: string): NavMatch | null {
  for (const section of navigation) {
    for (const item of section.items) {
      if (!isNavActive(item.href, pathname)) continue
      const child = item.children?.find((c) => isNavActive(c.href, pathname))
      return { section, item, child }
    }
  }
  return null
}
