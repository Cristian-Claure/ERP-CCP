import { ArrowLeft, FilePlus2, HandCoins, Pencil, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/hooks'

import { CustomerFormSheet } from '../components/CustomerFormSheet'
import { CustomerKpis } from '../components/customer-detail/CustomerKpis'
import { DebtStatusBadge } from '../components/Badges'
import { InfoTab } from '../components/customer-detail/InfoTab'
import { PaymentDialog } from '../components/PaymentDialog'
import { SalesTab } from '../components/customer-detail/SalesTab'
import { StatementTab } from '../components/customer-detail/StatementTab'
import { useCustomer } from '../hooks'

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

      <CustomerKpis customer={customer} />

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
