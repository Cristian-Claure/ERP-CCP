import { motion } from 'motion/react'
import { NavLink, useLocation } from 'react-router'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/features/auth/hooks'
import { cn } from 'cn'

import { type NavItem, visibleNavigation } from './navigation'

interface SidebarNavProps {
  collapsed?: boolean
  /** Distinct layoutId per instance so desktop and mobile indicators don't fight. */
  layoutId: string
  onNavigate?: () => void
}

export function SidebarNav({ collapsed = false, layoutId, onNavigate }: SidebarNavProps) {
  const { can } = useAuth()
  const sections = visibleNavigation(can)

  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <div className="relative flex h-5 items-center px-3">
            <span
              className={cn(
                'text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase transition-opacity duration-200',
                collapsed && 'opacity-0',
              )}
            >
              {section.title}
            </span>
            <span
              aria-hidden
              className={cn(
                'absolute inset-x-4 top-1/2 h-px bg-sidebar-border opacity-0 transition-opacity duration-200',
                collapsed && 'opacity-100',
              )}
            />
          </div>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} collapsed={collapsed} layoutId={layoutId} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

interface SidebarLinkProps {
  item: NavItem
  collapsed: boolean
  layoutId: string
  onNavigate?: () => void
}

function SidebarLink({ item, collapsed, layoutId, onNavigate }: SidebarLinkProps) {
  const { pathname } = useLocation()
  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  const Icon = item.icon

  const link = (
    <NavLink
      to={item.href}
      end={item.href === '/'}
      onClick={onNavigate}
      aria-label={collapsed ? item.title : undefined}
      className={cn(
        'group/link relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium outline-none',
        'text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring/60',
        isActive && 'text-sidebar-accent-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      {isActive && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-lg bg-sidebar-accent ring-1 ring-brand/20 ring-inset"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        >
          <span className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-linear-to-b from-brand to-brand-accent shadow-[0_0_12px_var(--brand)]" />
        </motion.span>
      )}
      <span
        className={cn(
          'relative z-10 flex size-5 items-center justify-center transition-colors',
          isActive
            ? 'text-brand-accent'
            : 'text-muted-foreground group-hover/link:text-sidebar-accent-foreground',
        )}
      >
        <Icon className="size-[18px]" strokeWidth={isActive ? 2.25 : 2} />
      </span>
      <span
        className={cn(
          'relative z-10 truncate transition-[opacity,width] duration-200',
          collapsed ? 'w-0 opacity-0' : 'opacity-100',
        )}
      >
        {item.title}
      </span>
      {!isActive && (
        <span className="absolute inset-0 rounded-lg bg-sidebar-accent/60 opacity-0 transition-opacity group-hover/link:opacity-100" />
      )}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {item.title}
      </TooltipContent>
    </Tooltip>
  )
}
