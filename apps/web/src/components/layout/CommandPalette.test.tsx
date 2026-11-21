import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { authKeys } from '@/features/auth/hooks'
import type { AuthUser } from '@/features/auth/types'
import { useUiStore } from '@/stores/ui-store'

import { CommandPalette } from './CommandPalette'

const user: AuthUser = {
  id: 1,
  name: 'Administrador CCP',
  email: 'admin@ccp.test',
  company: {
    id: 1,
    name: 'Demo',
    legal_name: 'Demo S.R.L.',
    tax_id: '1',
    currency: 'BOB',
    timezone: 'America/La_Paz',
  },
  roles: ['vendedor'],
  permissions: ['dashboard.view', 'inventory.view', 'sales.view'],
  last_login_at: null,
}

function renderPalette() {
  const client = new QueryClient()
  client.setQueryData(authKeys.me, user)
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CommandPalette', () => {
  beforeEach(() => useUiStore.setState({ commandOpen: false }))

  it('opens with Ctrl+K and lists only permitted modules', async () => {
    renderPalette()

    await userEvent.keyboard('{Control>}k{/Control}')

    expect(await screen.findByPlaceholderText('Buscar módulos, acciones…')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /inventario/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /usuarios/i })).not.toBeInTheDocument()
  })
})
