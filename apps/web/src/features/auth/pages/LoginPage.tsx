import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { Wordmark } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

import { BrandPanel } from '../components/BrandPanel'
import { LoginForm } from '../components/LoginForm'
import { useLogin } from '../hooks'
import type { LoginFormValues } from '../schemas'

/** Only allow internal redirects ("/ventas"), never absolute URLs. */
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export function LoginPage() {
  const login = useLogin()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const handleSubmit = async (values: LoginFormValues) => {
    const user = await login.mutateAsync(values)
    toast.success(`¡Hola, ${user.name.split(' ')[0]}!`, { description: user.company.legal_name })
    navigate(safeRedirect(params.get('redirect')), { replace: true })
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Wordmark showTagline />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[380px] space-y-8">
            <div className="space-y-2">
              <h1 className="text-[28px] font-semibold tracking-tight">Inicia sesión</h1>
              <p className="text-sm text-muted-foreground">
                Ingresa con tu cuenta para continuar a tu panel.
              </p>
            </div>
            <LoginForm onSubmit={handleSubmit} />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground lg:text-left">
          Protegido con sesiones seguras y auditoría de accesos.
        </p>
      </div>

      <BrandPanel />
    </div>
  )
}
