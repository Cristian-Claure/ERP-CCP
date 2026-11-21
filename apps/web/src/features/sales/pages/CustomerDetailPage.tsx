import { ArrowLeft, FilePlus2, HandCoins, Mail, MapPin, Pencil, Phone, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { LeafletMap } from '@/components/map/LeafletMap'
import { pinIcon } from '@/components/map/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentStatusBadge } from '@/features/inventory/components/DocumentStatusBadge'
import { useAuth } from '@/features/auth/hooks'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'
import L from 'leaflet'

import { AgingBar } from '../components/AgingBar'
import { DebtStatusBadge, SalesTypeBadge } from '../components/Badges'
import { CustomerFormSheet } from '../components/CustomerFormSheet'
import { PaymentDialog } from '../components/PaymentDialog'
import { daysFromToday, formatBizDate } from '../format'
import { useCustomer, useSalesDocuments, useStatement } from '../hooks'
import type { Customer } from '../types'

export function CustomerDetailPage() {
  const id = Number(useParams().id)
  const [search, setSearch] = useSearchParams()
  const { can } = useAuth()
  const { data: customer, isPending, isError } = useCustomer(id)
  const [editOpen, setEditOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const navigate = useNavigate()
  const canReceivables = can('receivables.view')
  const tab = search.get('tab') ?? 'info'

  if (isPending) return <PageSkeleton />
  if (isError || !customer)
    return (
      <EmptyState
        icon={UserX}
        title="Cliente no encontrado"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/ventas/clientes">Volver</Link>
          </Button>
        }
      />
    )

  const balance = Number(customer.receivables?.balance ?? 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/ventas/clientes"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Clientes
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
            {!customer.is_active && <Badge variant="outline">Inactivo</Badge>}
            <DebtStatusBadge status={customer.receivables?.debt_status} />
          </div>
          <p className="num text-sm text-muted-foreground">
            {customer.document_label} · {customer.segment_label} · {customer.payment_terms_label}
            {customer.payment_terms === 'credit' && ` ${customer.credit_days} días`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('customers.manage') && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Editar
            </Button>
          )}
          {can('receivables.collect') && balance > 0 && (
            <Button variant="outline" onClick={() => setPayOpen(true)}>
              <HandCoins /> Registrar cobro
            </Button>
          )}
          {can('sales.create') && customer.is_active && (
            <Button onClick={() => navigate(`/ventas/documentos/nuevo?tipo=invoice&cliente=${customer.id}`)}>
              <FilePlus2 /> Nueva venta
            </Button>
          )}
        </div>
      </div>

      <Kpis customer={customer} />

      <Tabs value={tab} onValueChange={(v) => setSearch({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          {canReceivables && <TabsTrigger value="statement">Estado de cuenta</TabsTrigger>}
        </TabsList>
        <TabsContent value="info" className="mt-4">
          <InfoTab customer={customer} />
        </TabsContent>
        <TabsContent value="sales" className="mt-4">
          <SalesTab customerId={customer.id} />
        </TabsContent>
        {canReceivables && (
          <TabsContent value="statement" className="mt-4">
            <StatementTab
              customer={customer}
              onCollect={can('receivables.collect') ? () => setPayOpen(true) : undefined}
            />
          </TabsContent>
        )}
      </Tabs>

      <CustomerFormSheet open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} customer={customer} maxAmount={balance} />
    </div>
  )
}

function Kpis({ customer }: { customer: Customer }) {
  const r = customer.receivables
  const items: { label: string; value: string; hint?: string; tone?: string }[] = [
    {
      label: 'Ventas acumuladas',
      value: formatCurrency(Number(customer.stats?.sales_total ?? 0)),
      hint: `${customer.stats?.sales_count ?? 0} documentos`,
    },
    { label: 'Última compra', value: formatBizDate(customer.stats?.last_sale_at) },
  ]
  if (r) {
    items.push(
      { label: 'Saldo por cobrar', value: formatCurrency(Number(r.balance)) },
      {
        label: 'Deuda vencida',
        value: formatCurrency(Number(r.overdue_amount ?? 0)),
        tone: Number(r.overdue_amount ?? 0) > 0 ? 'text-destructive' : undefined,
      },
    )
    if (customer.payment_terms === 'credit') {
      items.push({
        label: 'Crédito disponible',
        value: formatCurrency(Number(r.available_credit)),
        hint: `de ${formatCurrency(Number(customer.credit_limit))}`,
      })
    }
  }
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Indicadores del cliente">
      {items.map((i) => (
        <Card key={i.label} className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">{i.label}</p>
            <p className={cn('num text-lg font-semibold', i.tone)}>{i.value}</p>
            {i.hint && <p className="num text-xs text-muted-foreground">{i.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </section>
  )
}

function InfoTab({ customer }: { customer: Customer }) {
  const hasLocation = customer.latitude !== null && customer.longitude !== null
  const rows: [string, React.ReactNode][] = [
    ['Documento', customer.document_label],
    [
      'Correo',
      customer.email ? (
        <a className="hover:underline" href={`mailto:${customer.email}`}>
          <Mail className="mr-1 inline size-3.5" />
          {customer.email}
        </a>
      ) : (
        '—'
      ),
    ],
    [
      'Teléfono',
      customer.phone ? (
        <span className="num">
          <Phone className="mr-1 inline size-3.5" />
          {customer.phone}
        </span>
      ) : (
        '—'
      ),
    ],
    ['Dirección', customer.address ?? '—'],
    ['Ciudad', [customer.city, customer.department, customer.country].filter(Boolean).join(', ') || '—'],
    ['Segmento', customer.segment_label],
    ['Condición', customer.payment_terms === 'credit' ? `Crédito a ${customer.credit_days} días` : 'Contado'],
    ...(customer.payment_terms === 'credit'
      ? ([['Límite de crédito', formatCurrency(Number(customer.credit_limit))]] as [string, string][])
      : []),
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium break-words">{value}</p>
            </div>
          ))}
          {customer.notes && (
            <div className="space-y-0.5 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Notas</p>
              <p className="text-sm">{customer.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-brand-accent" /> Ubicación
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasLocation ? (
            <LeafletMap
              center={[Number(customer.latitude), Number(customer.longitude)]}
              zoom={15}
              className="h-72 w-full"
              onReady={(map) => {
                L.marker([Number(customer.latitude), Number(customer.longitude)], { icon: pinIcon() })
                  .addTo(map)
                  .bindTooltip(customer.name)
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin ubicación registrada. Edita el cliente para fijarla en el mapa.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SalesTab({ customerId }: { customerId: number }) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const { data, isPending } = useSalesDocuments({
    'filter[customer_id]': customerId,
    sort: '-document_date',
    per_page: 15,
    page,
  })

  if (isPending) return <PageSkeleton />
  if (!data?.data.length)
    return <p className="text-sm text-muted-foreground">El cliente aún no tiene documentos.</p>

  return (
    <Card className="gap-0 py-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="pr-4">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((d) => (
              <TableRow
                key={d.id}
                className="cursor-pointer"
                onClick={() => navigate(`/ventas/documentos/${d.id}`)}
              >
                <TableCell className="num pl-4 text-xs font-semibold">{d.number ?? 'Borrador'}</TableCell>
                <TableCell>
                  <SalesTypeBadge type={d.type} label={d.type_label} />
                </TableCell>
                <TableCell className="num text-xs">{formatBizDate(d.document_date)}</TableCell>
                <TableCell className="num text-xs">{formatBizDate(d.due_date)}</TableCell>
                <TableCell className="num text-right">{formatCurrency(Number(d.total))}</TableCell>
                <TableCell className="num text-right">
                  {d.open_amount && Number(d.open_amount) > 0 && d.status === 'posted'
                    ? formatCurrency(Number(d.open_amount))
                    : '—'}
                </TableCell>
                <TableCell className="pr-4">
                  <DocumentStatusBadge status={d.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.meta.last_page > 1 && (
        <div className="flex items-center justify-end gap-2 border-t p-3 text-xs text-muted-foreground">
          Página {data.meta.current_page} de {data.meta.last_page}
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= data.meta.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </Card>
  )
}

function StatementTab({ customer, onCollect }: { customer: Customer; onCollect?: () => void }) {
  const [page, setPage] = useState(1)
  const { data, isPending } = useStatement(customer.id, { page, per_page: 50 })
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-3">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Antigüedad de la deuda</CardTitle>
          {onCollect && Number(customer.receivables?.balance ?? 0) > 0 && (
            <CardAction>
              <Button size="sm" variant="outline" onClick={onCollect}>
                <HandCoins /> Registrar cobro
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>{data ? <AgingBar aging={data.aging} /> : <div className="h-10" />}</CardContent>
      </Card>

      <Card className="gap-0 py-0">
        {isPending ? (
          <div className="p-6">
            <PageSkeleton />
          </div>
        ) : !data?.data.length ? (
          <p className="p-6 text-sm text-muted-foreground">Sin movimientos en la cuenta.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Fecha</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Cargo</TableHead>
                  <TableHead className="text-right">Abono</TableHead>
                  <TableHead className="pr-4 text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page === 1 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="pl-4 text-xs text-muted-foreground" colSpan={5}>
                      Saldo inicial
                    </TableCell>
                    <TableCell className="num pr-4 text-right text-muted-foreground">
                      {formatCurrency(Number(data.opening_balance))}
                    </TableCell>
                  </TableRow>
                )}
                {data.data.map((e) => {
                  const overdue = e.kind === 'charge' && e.due_date && daysFromToday(e.due_date) < 0
                  return (
                    <TableRow
                      key={e.id}
                      className={cn(e.source_type === 'sales_document' && 'cursor-pointer')}
                      onClick={() =>
                        e.source_type === 'sales_document' && navigate(`/ventas/documentos/${e.source_id}`)
                      }
                    >
                      <TableCell className="num pl-4 text-xs">{formatBizDate(e.entry_date)}</TableCell>
                      <TableCell>
                        <span className="flex flex-col">
                          <span className="text-sm">{e.description}</span>
                          <span className="text-xs text-muted-foreground">{e.kind_label}</span>
                        </span>
                      </TableCell>
                      <TableCell className={cn('num text-xs', overdue && 'text-destructive')}>
                        {formatBizDate(e.due_date)}
                      </TableCell>
                      <TableCell className="num text-right">
                        {e.debit ? formatCurrency(Number(e.debit)) : ''}
                      </TableCell>
                      <TableCell className="num text-right text-success">
                        {e.credit ? formatCurrency(Number(e.credit)) : ''}
                      </TableCell>
                      <TableCell className="num pr-4 text-right font-medium">
                        {formatCurrency(Number(e.balance_after))}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {data && data.meta.last_page > 1 && (
          <div className="flex items-center justify-end gap-2 border-t p-3 text-xs text-muted-foreground">
            Página {data.meta.current_page} de {data.meta.last_page}
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
