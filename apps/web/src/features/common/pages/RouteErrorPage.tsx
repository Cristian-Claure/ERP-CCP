import { TriangleAlert } from 'lucide-react'
import { useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'
import { env } from '@/lib/env'

/** Rendered by React Router when a route throws while rendering. */
export function RouteErrorPage() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : String(error)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10">
        <TriangleAlert className="size-5 text-destructive" />
      </span>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="text-sm text-muted-foreground">
          Ocurrió un error inesperado en esta pantalla. Recarga la página para continuar.
        </p>
        {env.isDev && (
          <pre className="num mt-3 rounded-lg border bg-muted p-3 text-left text-xs">{message}</pre>
        )}
      </div>
      <Button onClick={() => window.location.assign('/')}>Volver al inicio</Button>
    </div>
  )
}
