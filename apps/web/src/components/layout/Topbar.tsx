import { Menu, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useUiStore } from '@/stores/ui-store'

import { Breadcrumbs } from './Breadcrumbs'
import { NotificationsMenu } from './NotificationsMenu'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

export function Topbar() {
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)
  const setCommandOpen = useUiStore((s) => s.setCommandOpen)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/75 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Abrir menú"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="group hidden h-9 w-72 items-center gap-2 rounded-lg border bg-surface/60 px-3 text-[13px] text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground md:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="num pointer-events-none rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Ctrl K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Buscar"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="size-[18px]" />
        </Button>
        <NotificationsMenu />
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1.5 h-6 data-[orientation=vertical]:h-6" />
        <UserMenu />
      </div>
    </header>
  )
}
