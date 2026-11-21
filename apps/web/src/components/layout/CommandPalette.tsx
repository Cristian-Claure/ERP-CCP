import { LogOut, Moon, PanelLeft, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useAuth } from '@/features/auth/hooks'
import { useSignOut } from '@/features/auth/use-sign-out'
import { useThemeStore } from '@/stores/theme-store'
import { useUiStore } from '@/stores/ui-store'

import { visibleNavigation } from './navigation'

/** Global command palette (Ctrl/Cmd + K). */
export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen)
  const setOpen = useUiStore((s) => s.setCommandOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const navigate = useNavigate()
  const { can } = useAuth()
  const signOut = useSignOut()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(!useUiStore.getState().commandOpen)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  const run = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Búsqueda global"
      description="Busca módulos y acciones"
    >
      <CommandInput placeholder="Buscar módulos, acciones…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        {visibleNavigation(can).map((section) => (
          <CommandGroup key={section.title} heading={section.title}>
            {section.items.map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.title} ${section.title} ${(item.keywords ?? []).join(' ')}`}
                onSelect={() => run(() => navigate(item.href))}
              >
                <item.icon />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Acciones">
          <CommandItem value="cambiar tema oscuro claro" onSelect={() => run(toggleTheme)}>
            <Sun className="hidden [.light_&]:block" />
            <Moon className="[.light_&]:hidden" />
            Cambiar tema
          </CommandItem>
          <CommandItem value="colapsar expandir menú lateral sidebar" onSelect={() => run(toggleSidebar)}>
            <PanelLeft />
            Colapsar / expandir menú
          </CommandItem>
          <CommandItem value="cerrar sesión salir logout" onSelect={() => run(signOut)}>
            <LogOut />
            Cerrar sesión
            <CommandShortcut />
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
