import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, LoaderCircle, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { ApiError } from '@/lib/api-error'
import { env } from '@/lib/env'

import { type LoginFormValues, loginSchema } from '../schemas'

interface LoginFormProps {
  onSubmit: (values: LoginFormValues) => Promise<unknown>
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
    mode: 'onTouched',
  })

  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        const emailError = error.details.email?.[0]
        const passwordError = error.details.password?.[0]
        if (emailError) form.setError('email', { message: emailError })
        if (passwordError) form.setError('password', { message: passwordError })
        if (!emailError && !passwordError) setFormError(error.message)
        return
      }
      setFormError(error instanceof ApiError ? error.message : 'No se pudo iniciar sesión.')
    }
  })

  const fillDemo = () => {
    form.setValue('email', 'admin@ccp.test', { shouldValidate: true })
    form.setValue('password', 'password', { shouldValidate: true })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
          <InputGroup className="h-11">
            <InputGroupAddon>
              <Mail />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="tu@empresa.com"
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
          </InputGroup>
          <FieldError errors={[errors.email]} />
        </Field>

        <Field data-invalid={!!errors.password}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setFormError('Contacta a tu administrador para restablecer tu contraseña.')}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <InputGroup className="h-11">
            <InputGroupAddon>
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              {...form.register('password')}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldError errors={[errors.password]} />
        </Field>

        <Controller
          control={form.control}
          name="remember"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id="remember"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              <FieldLabel htmlFor="remember" className="font-normal">
                Mantener sesión iniciada
              </FieldLabel>
            </Field>
          )}
        />
      </FieldGroup>

      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {formError}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="group h-11 bg-linear-to-r from-brand to-[#4F46E5] text-[14px] font-semibold shadow-[0_8px_24px_-8px_rgba(99,102,241,0.7)] hover:brightness-110"
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="animate-spin" />
            Ingresando…
          </>
        ) : (
          <>
            Iniciar sesión
            <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>

      {env.isDev && (
        <button
          type="button"
          onClick={fillDemo}
          className="group flex items-center justify-between rounded-lg border border-dashed bg-surface-2/60 px-3 py-2.5 text-left text-xs transition-colors hover:border-brand/40"
        >
          <span className="text-muted-foreground">
            Demo: <span className="num text-foreground">admin@ccp.test</span> /{' '}
            <span className="num text-foreground">password</span>
          </span>
          <span className="font-medium text-brand-accent group-hover:underline">Autocompletar</span>
        </button>
      )}
    </form>
  )
}
