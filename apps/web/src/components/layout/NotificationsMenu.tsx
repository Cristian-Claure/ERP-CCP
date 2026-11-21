import { Bell, PackageX, Receipt, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Mock until the notifications module exists.
const NOTIFICATIONS = [
  {
    id: 1,
    icon: PackageX,
    tone: 'text-warning',
    title: '12 productos bajo stock mínimo',
    time: 'Hace 5 min',
  },
  { id: 2, icon: Receipt, tone: 'text-brand-accent', title: 'Factura VTA-000128 cobrada', time: 'Hace 1 h' },
  {
    id: 3,
    icon: Sparkles,
    tone: 'text-brand',
    title: 'Nuevo pronóstico de demanda disponible',
    time: 'Ayer',
  },
]

export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notificaciones (${NOTIFICATIONS.length} nuevas)`}
          className="relative"
        >
          <Bell className="size-[18px]" />
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand-accent ring-2 ring-background" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificaciones</span>
          <span className="num text-xs text-muted-foreground">{NOTIFICATIONS.length} nuevas</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {NOTIFICATIONS.map(({ id, icon: Icon, tone, title, time }) => (
          <DropdownMenuItem key={id} className="items-start gap-3 py-2.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-surface-2">
              <Icon className={`size-4 ${tone}`} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] leading-snug font-medium">{title}</span>
              <span className="text-xs text-muted-foreground">{time}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
