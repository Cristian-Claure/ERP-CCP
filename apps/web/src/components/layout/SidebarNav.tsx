import { ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/features/auth/hooks'
import { cn } from 'cn'

import { isNavActive, type NavItem, visibleNavigation } from './navigation'

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
                {item.children?.length ? (
                  <SidebarGroup
                    item={item}
                    collapsed={collapsed}
                    layoutId={layoutId}
                    onNavigate={onNavigate}
                  />
                ) : (
                  <SidebarLink
                    item={item}
                    collapsed={collapsed}
                    layoutId={layoutId}
                    onNavigate={onNavigate}
                  />
                )}
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
  /** Group parents link to their first child and never show the pill when expanded. */
  href?: string
  showIndicator?: boolean
  trailing?: React.ReactNode
}

function ActivePill({ layoutId }: { layoutId: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      className="absolute inset-0 rounded-lg bg-sidebar-accent ring-1 ring-brand/20 ring-inset"
      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
    >
      <span className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-linear-to-b from-brand to-brand-accent shadow-[0_0_12px_var(--brand)]" />
    </motion.span>
  )
}

function SidebarLink({
  item,
  collapsed,
  layoutId,
  onNavigate,
  href,
  showIndicator = true,
  trailing,
}: SidebarLinkProps) {
  const { pathname } = useLocation()
  const isActive = isNavActive(item.href, pathname)
  const Icon = item.icon

  const link = (
    <NavLink
      to={href ?? item.href}
      end={item.href === '/'}
      onClick={onNavigate}
      aria-label={collapsed ? item.title : undefined}
      aria-current={isActive && showIndicator ? 'page' : undefined}
      className={cn(
        'group/link relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium outline-none',
        'text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring/60',
        isActive && 'text-sidebar-accent-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      {isActive && showIndicator && <ActivePill layoutId={layoutId} />}
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
          'relative z-10 flex-1 truncate transition-[opacity,width] duration-200',
          collapsed ? 'w-0 opacity-0' : 'opacity-100',
        )}
      >
        {item.title}
      </span>
      {!collapsed && trailing}
      {!(isActive && showIndicator) && (
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

/** Expandable module (e.g. Inventario → Productos, Documentos, Kardex, Almacenes). */
function SidebarGroup({ item, collapsed, layoutId, onNavigate }: Omit<SidebarLinkProps, 'href'>) {
  const { pathname } = useLocation()
  const isActive = isNavActive(item.href, pathname)
  const [open, setOpen] = useState(isActive)
  const expanded = !collapsed && (open || isActive)
  const children = item.children ?? []

  return (
    <div>
      <div className="relative">
        <SidebarLink
          item={item}
          href={children[0]?.href}
          collapsed={collapsed}
          layoutId={layoutId}
          onNavigate={onNavigate}
          showIndicator={collapsed}
          trailing={
            <button
              type="button"
              aria-label={expanded ? `Contraer ${item.title}` : `Expandir ${item.title}`}
              aria-expanded={expanded}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setOpen(!expanded)
              }}
              className="relative z-10 -mr-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className={cn('size-3.5 transition-transform', expanded && 'rotate-90')} />
            </button>
          }
        />
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="ml-[22px] flex flex-col gap-0.5 overflow-hidden border-l border-sidebar-border py-1 pl-2.5"
          >
            {children.map((child) => {
              const childActive = isNavActive(child.href, pathname)
              return (
                <li key={child.href}>
                  <NavLink
                    to={child.href}
                    onClick={onNavigate}
                    aria-current={childActive ? 'page' : undefined}
                    className={cn(
                      'group/link relative flex h-8 items-center rounded-lg px-3 text-[13px] transition-colors outline-none',
                      'focus-visible:ring-2 focus-visible:ring-sidebar-ring/60',
                      childActive
                        ? 'font-medium text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:text-sidebar-accent-foreground',
                    )}
                  >
                    {childActive && <ActivePill layoutId={layoutId} />}
                    <span className="relative z-10 truncate">{child.title}</span>
                  </NavLink>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
