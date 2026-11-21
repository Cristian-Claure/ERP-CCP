import { Wordmark } from '@/components/brand/Logo'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { env } from '@/lib/env'
import { useUiStore } from '@/stores/ui-store'

import { SidebarNav } from './SidebarNav'

/** Drawer navigation for screens below lg. */
export function MobileSidebar() {
  const open = useUiStore((s) => s.mobileNavOpen)
  const setOpen = useUiStore((s) => s.setMobileNavOpen)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[280px] bg-sidebar p-0 sm:max-w-[280px]">
        <SheetHeader className="h-16 justify-center border-b px-5">
          <SheetTitle asChild>
            <div>
              <Wordmark />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Menú de navegación</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <SidebarNav layoutId="sidebar-active-mobile" onNavigate={() => setOpen(false)} />
        </div>
        <div className="flex items-center gap-2 border-t p-4">
          <Badge className="border-0 bg-linear-to-r from-brand to-brand-accent text-[10px] font-bold text-white">
            BETA
          </Badge>
          <span className="num text-[11px] text-muted-foreground">
            v{env.appVersion.replace(/-beta$/, '')}
          </span>
        </div>
      </SheetContent>
    </Sheet>
  )
}
