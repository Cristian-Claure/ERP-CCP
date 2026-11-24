import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DocumentStatusBadge } from '@/features/inventory/components/DocumentStatusBadge'
import { formatCurrency } from '@/lib/format'

import { SalesTypeBadge } from '../Badges'
import { formatBizDate } from '../../format'
import { useSalesDocuments } from '../../hooks'

export function SalesTab({ customerId }: { customerId: number }) {
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
