import { loginSchema } from './schemas'

describe('loginSchema', () => {
  it('accepts valid credentials and trims the email', () => {
    const result = loginSchema.safeParse({ email: '  admin@ccp.test ', password: 'password', remember: true })

    expect(result.success).toBe(true)
    expect(result.data?.email).toBe('admin@ccp.test')
  })

  it('rejects an invalid email with a Spanish message', () => {
    const result = loginSchema.safeParse({ email: 'no-es-correo', password: 'x', remember: false })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Ingresa un correo válido.')
  })

  it('requires the password', () => {
    const result = loginSchema.safeParse({ email: 'admin@ccp.test', password: '', remember: false })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Ingresa tu contraseña.')
  })
})
