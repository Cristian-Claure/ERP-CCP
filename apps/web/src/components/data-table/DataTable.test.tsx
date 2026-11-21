import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'

import type { PaginationMeta } from '@/lib/pagination'

import { DataTable } from './DataTable'
import { DataTableColumnHeader } from './DataTableColumnHeader'
import { DataTableToolbar } from './DataTableToolbar'
import { dataTableColumns } from './features'
import { useDataTableState } from './use-data-table-state'

interface Row {
  id: number
  name: string
  qty: string
}

const col = dataTableColumns<Row>()
const columns = [
  col.accessor('name', {
    id: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
    meta: { label: 'Nombre' },
    enableHiding: false,
  }),
  col.accessor('qty', { id: 'qty', header: 'Cantidad', meta: { label: 'Cantidad', align: 'right' } }),
]

const meta: PaginationMeta = { current_page: 1, last_page: 3, per_page: 2, total: 5, from: 1, to: 2 }

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="search">{location.search}</output>
}

function Harness({ rows, loading = false }: { rows: Row[]; loading?: boolean }) {
  const state = useDataTableState({ defaultSort: 'name', defaultPerPage: 2 })
  return (
    <>
      <DataTable
        id="test-table"
        columns={columns}
        data={rows}
        meta={loading ? undefined : meta}
        state={state}
        isLoading={loading}
        toolbar={(table) => <DataTableToolbar table={table} state={state} />}
      />
      <LocationProbe />
    </>
  )
}

const renderTable = (props: { rows: Row[]; loading?: boolean }, url = '/') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Harness {...props} />
    </MemoryRouter>,
  )

describe('DataTable', () => {
  const rows = [
    { id: 1, name: 'Arroz', qty: '10' },
    { id: 2, name: 'Azúcar', qty: '5' },
  ]

  it('renders server rows and the pagination summary', () => {
    renderTable({ rows })

    expect(screen.getByText('Arroz')).toBeInTheDocument()
    expect(screen.getByText('Azúcar')).toBeInTheDocument()
    expect(screen.getByText('1–2')).toBeInTheDocument()
    expect(screen.getByText('1–2').parentElement).toHaveTextContent('1–2 de 5')
  })

  it('shows the empty state when there are no rows', () => {
    renderTable({ rows: [] })
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })

  it('shows skeleton rows while loading', () => {
    const { container } = renderTable({ rows: [], loading: true })
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })

  it('toggles server sorting through the URL', async () => {
    renderTable({ rows })

    await userEvent.click(screen.getByRole('button', { name: 'Ordenar por Nombre' }))
    expect(screen.getByTestId('search').textContent).toContain('sort=-name')
  })

  it('moves to the next page through the URL', async () => {
    renderTable({ rows })

    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(screen.getByTestId('search').textContent).toContain('page=2')
  })

  it('hides columns from the column selector and remembers the choice', async () => {
    renderTable({ rows })
    expect(screen.getByRole('columnheader', { name: 'Cantidad' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /columnas/i }))
    const menu = await screen.findByRole('menu')
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Cantidad' }))

    expect(screen.queryByRole('columnheader', { name: 'Cantidad' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('ccp-table:test-table') ?? '{}')).toEqual({ qty: false })
  })
})
