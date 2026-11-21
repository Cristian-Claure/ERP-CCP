import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ApiError } from '@/lib/api-error'

import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  it('shows validation errors without calling submit', async () => {
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByText('Ingresa tu correo.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the typed credentials', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<LoginForm onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'admin@ccp.test')
    await userEvent.type(screen.getByLabelText(/^contraseña$/i), 'password')
    await userEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(onSubmit).toHaveBeenCalledWith({ email: 'admin@ccp.test', password: 'password', remember: true })
  })

  it('maps server validation errors to the fields', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(422, 'validation_failed', 'Datos inválidos', {
        email: ['Las credenciales no son correctas.'],
      }),
    )
    render(<LoginForm onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'admin@ccp.test')
    await userEvent.type(screen.getByLabelText(/^contraseña$/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByText('Las credenciales no son correctas.')).toBeInTheDocument()
  })
})
