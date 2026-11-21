import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Link } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { env } from '@/lib/env'
import { useUiStore } from '@/stores/ui-store'
import { cn } from 'cn'

import { SidebarNav } from './SidebarNav'

/** Desktop sidebar (lg+). On mobile the same navigation lives in MobileSidebar. */
export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex',
        'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        collapsed ? 'w-[76px]' : 'w-[264px]',
      )}
    >
      <div className={cn('flex h-16 items-center gap-2.5 px-5', collapsed && 'justify-center px-0')}>
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <Logo className="size-8 drop-shadow-[0_4px_16px_rgba(99,102,241,0.45)]" />
          <div
            className={cn(
              'flex flex-col leading-none transition-opacity duration-200',
              collapsed && 'hidden',
            )}
          >
            <span className="text-[16px] font-extrabold tracking-wide">CCP</span>
            <span className="mt-1 text-[9.5px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Control Central
            </span>
          </div>
        </Link>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className={cn('px-3 py-3', collapsed && 'px-3')}>
          <SidebarNav collapsed={collapsed} layoutId="sidebar-active-desktop" />
        </div>
      </ScrollArea>

      <div className="flex flex-col gap-3 border-t border-sidebar-border p-3">
        <div className={cn('flex items-center justify-between gap-2 px-2', collapsed && 'flex-col px-0')}>
          <div className={cn('flex items-center gap-2', collapsed && 'flex-col gap-1')}>
            <Badge className="border-0 bg-linear-to-r from-brand to-brand-accent px-1.5 text-[10px] font-bold tracking-wider text-white">
              BETA
            </Badge>
            <span className="num text-[11px] text-muted-foreground">
              v{env.appVersion.replace(/-beta$/, '')}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleSidebar}
                aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
                className="text-muted-foreground hover:text-foreground"
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Expandir menú' : 'Colapsar menú'}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  )
}
