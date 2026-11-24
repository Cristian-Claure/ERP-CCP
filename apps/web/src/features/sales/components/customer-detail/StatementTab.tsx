import { HandCoins } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { AgingBar } from '../AgingBar'
import { daysFromToday, formatBizDate } from '../../format'
import { useStatement } from '../../hooks'
import type { Customer } from '../../types'

export function StatementTab({ customer, onCollect }: { customer: Customer; onCollect?: () => void }) {
  const [page, setPage] = useState(1)
  const { data, isPending } = useStatement(customer.id, { page, per_page: 50 })
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-3">
        <CardHeader>
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
