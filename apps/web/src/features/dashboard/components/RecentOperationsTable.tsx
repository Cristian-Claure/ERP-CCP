import { Inbox } from 'lucide-react'

import { EmptyState } from '@/components/feedback/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from 'cn'

import type { Operation, OperationStatus, OperationType } from '../types'

const TYPE_LABELS: Record<OperationType, string> = {
  venta: 'Venta',
  compra: 'Compra',
  cobro: 'Cobro',
  pago: 'Pago',
  ajuste: 'Ajuste',
}

const STATUS_STYLES: Record<OperationStatus, { label: string; className: string }> = {
  completada: { label: 'Completada', className: 'bg-success/12 text-success border-success/25' },
  pendiente: { label: 'Pendiente', className: 'bg-warning/12 text-warning border-warning/25' },
  anulada: { label: 'Anulada', className: 'bg-muted text-muted-foreground border-border line-through' },
}

/** Incoming money is shown positive, outgoing negative. */
const SIGN: Record<OperationType, 1 | -1 | 0> = { venta: 1, cobro: 1, compra: -1, pago: -1, ajuste: 0 }

interface RecentOperationsTableProps {
  operations: Operation[]
  currency: string
}

export function RecentOperationsTable({ operations, currency }: RecentOperationsTableProps) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">Últimas operaciones</CardTitle>
        <CardDescription>Movimientos registrados en los últimos días</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {operations.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={Inbox}
              title="Aún no hay operaciones"
              description="Cuando registres ventas, compras o pagos aparecerán aquí."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Contraparte</TableHead>
                <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="pr-6 text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.map((op) => {
                const sign = SIGN[op.type]
                const status = STATUS_STYLES[op.status]
                return (
                  <TableRow key={op.id}>
                    <TableCell className="num pl-6 text-[13px] font-medium">{op.code}</TableCell>
                    <TableCell className="text-[13px]">{TYPE_LABELS[op.type]}</TableCell>
                    <TableCell className="hidden max-w-56 truncate text-[13px] text-muted-foreground md:table-cell">
                      {op.counterparty}
                    </TableCell>
                    <TableCell className="hidden text-[13px] text-muted-foreground sm:table-cell">
                      {formatDate(op.date)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'num text-right text-[13px] font-medium',
                        op.status === 'anulada' && 'text-muted-foreground line-through',
                        op.status !== 'anulada' && sign === 1 && 'text-success',
                      )}
                    >
                      {sign === -1 ? '−' : ''}
                      {formatCurrency(op.amount, currency)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Badge variant="outline" className={cn('font-medium', status.className)}>
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function RecentOperationsTableSkeleton() {
  return (
    <Card className="gap-4">
      <CardHeader>
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3.5 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="hidden h-4 flex-1 md:block" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
