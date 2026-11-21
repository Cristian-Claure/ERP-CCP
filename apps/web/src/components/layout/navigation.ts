import {
  BrainCircuit,
  Boxes,
  ChartLine,
  HandCoins,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  /** Permission required to see the item (from /auth/me). */
  permission?: string
  /** Extra words for the command palette search. */
  keywords?: string[]
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
      items: section.items.filter((item) => !item.permission || can(item.permission)),
    }))
    .filter((section) => section.items.length > 0)
}

export function findNavMatch(pathname: string): { section: NavSection; item: NavItem } | null {
  for (const section of navigation) {
    for (const item of section.items) {
      const matches = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
      if (matches) return { section, item }
    }
  }
  return null
}
