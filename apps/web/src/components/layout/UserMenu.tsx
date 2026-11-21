import { CircleUser, LogOut, Settings } from 'lucide-react'
import { useNavigate } from 'react-router'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/hooks'
import { useSignOut } from '@/features/auth/use-sign-out'
import { initials } from '@/lib/format'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
  almacenero: 'Almacenero',
}

export function UserMenu() {
  const { user } = useAuth()
  const signOut = useSignOut()
  const navigate = useNavigate()

  if (!user) return null

  const role = user.roles[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2.5 rounded-full pr-1 pl-1 sm:pr-3"
          aria-label="Menú de usuario"
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-linear-to-br from-brand to-brand-accent text-[11px] font-semibold text-white">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden flex-col items-start leading-tight sm:flex">
            <span className="text-[13px] font-medium">{user.name.split(' ')[0]}</span>
            {role && <span className="text-[11px] text-muted-foreground">{ROLE_LABELS[role] ?? role}</span>}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          <span className="mt-1 truncate text-xs text-muted-foreground">{user.company.legal_name}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled>
            <CircleUser />
            Mi perfil
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/sistema/configuracion')}>
            <Settings />
            Configuración
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={signOut}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
