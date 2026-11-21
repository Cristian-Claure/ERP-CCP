import { Link } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-6 text-center">
      <Logo className="size-14 opacity-90" />
      <div className="space-y-2">
        <p className="num text-gradient-brand text-6xl font-bold">404</p>
        <h1 className="text-xl font-semibold">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">La dirección que buscas no existe o fue movida.</p>
      </div>
      <Button asChild>
        <Link to="/">Ir al dashboard</Link>
      </Button>
    </div>
  )
}
