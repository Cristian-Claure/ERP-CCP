import { Download, History, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { EmptyState } from '@/components/feedback/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { formatCost, formatQty } from '../format'
import { useKardex, useWarehouses } from '../hooks'
import type { Product } from '../types'

const dateFmt = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit' })

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString('en-CA')
}

interface KardexViewProps {
  product: Pick<Product, 'id' | 'sku' | 'name'> & { unit?: { code: string } }
  /** Initial warehouse; defaults to the first one. */
  warehouseId?: number
}

/**
 * Kardex per product + warehouse: running balance and average cost per line,
 * both dates (posting and document), date filters and CSV export.
 */
export function KardexView({ product, warehouseId: initialWarehouse }: KardexViewProps) {
  const { data: warehouses } = useWarehouses()
  const [warehouseId, setWarehouseId] = useState<number | undefined>(initialWarehouse)
  const [from, setFrom] = useState(isoDaysAgo(90))
  const [to, setTo] = useState(isoDaysAgo(0))
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const effectiveWarehouse = warehouseId ?? warehouses?.[0]?.id
  const params = effectiveWarehouse
    ? { warehouse_id: effectiveWarehouse, from, to, page, per_page: 100 }
    : undefined
  const { data, isPending, isFetching } = useKardex(product.id, params)
  const unit = product.unit?.code

  const exportCsv = async () => {
    if (!params) return
    setExporting(true)
    try {
      const response = await api.get<Blob>(`/api/v1/inventory/products/${product.id}/kardex/export`, {
        params: { warehouse_id: params.warehouse_id, from, to },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `kardex_${product.sku}_${from}_${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo exportar el kardex.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Almacén</span>
          <Select
            value={effectiveWarehouse ? String(effectiveWarehouse) : ''}
            onValueChange={(v) => {
              setWarehouseId(Number(v))
              setPage(1)
            }}
          >
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {warehouses?.map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Desde</span>
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(e) => (setFrom(e.target.value), setPage(1))}
            className="num h-9 w-40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Hasta</span>
          <Input
            type="date"
            value={to}
            min={from}
            onChange={(e) => (setTo(e.target.value), setPage(1))}
            className="num h-9 w-40"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          {isFetching && !isPending && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={exportCsv}
            disabled={!params || exporting}
          >
            {exporting ? <LoaderCircle className="animate-spin" /> : <Download />}
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-surface-2/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-xs">Confirmado</TableHead>
                <TableHead className="text-xs">Fecha doc.</TableHead>
                <TableHead className="text-xs">Documento</TableHead>
                <TableHead className="text-xs">Movimiento</TableHead>
                <TableHead className="text-right text-xs">Entrada</TableHead>
                <TableHead className="text-right text-xs">Salida</TableHead>
                <TableHead className="text-right text-xs">Costo unit.</TableHead>
                <TableHead className="text-right text-xs">Costo total</TableHead>
                <TableHead className="text-right text-xs">Saldo</TableHead>
                <TableHead className="text-right text-xs">Costo prom.</TableHead>
                <TableHead className="pr-4 text-right text-xs">Valorizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data && (
                <TableRow className="bg-surface-2/30 hover:bg-surface-2/30">
                  <TableCell colSpan={8} className="pl-4 text-xs font-medium text-muted-foreground">
                    Saldo inicial al {dateFmt.format(new Date(`${from}T00:00:00`))}
                  </TableCell>
                  <TableCell className="num text-right text-[13px] font-medium">
                    {formatQty(data.meta.opening.quantity)}
                  </TableCell>
                  <TableCell className="num text-right text-[13px]">
                    {formatCost(data.meta.opening.avg_cost)}
                  </TableCell>
                  <TableCell className="num pr-4 text-right text-[13px]">
                    {formatCurrency(Number(data.meta.opening.value))}
                  </TableCell>
                </TableRow>
              )}
              {isPending
                ? Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 11 }, (_, j) => (
                        <TableCell key={j} className="first:pl-4 last:pr-4">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data?.data.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={11} className="p-6">
                        <EmptyState
                          icon={History}
                          title="Sin movimientos en el período"
                          description="Cambia el rango de fechas o el almacén."
                          className="border-0"
                        />
                      </TableCell>
                    </TableRow>
                  )}
              {data?.data.map((m) => {
                const posted = new Date(m.posted_at)
                const differentDates = posted.toLocaleDateString('en-CA') !== m.document_date
                return (
                  <TableRow key={m.id} className={cn(m.is_reversal && 'bg-destructive/[0.04]')}>
                    <TableCell className="num pl-4 text-[12px] whitespace-nowrap">
                      {dateFmt.format(posted)}{' '}
                      <span className="text-muted-foreground">{timeFmt.format(posted)}</span>
                    </TableCell>
                    <TableCell className="num text-[12px] whitespace-nowrap">
                      {differentDates ? (
                        <Tooltip>
                          <TooltipTrigger className="underline decoration-warning decoration-dotted underline-offset-4">
                            {dateFmt.format(new Date(`${m.document_date}T00:00:00`))}
                          </TooltipTrigger>
                          <TooltipContent>
                            La fecha del documento difiere de la fecha de confirmación
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">
                          {dateFmt.format(new Date(`${m.document_date}T00:00:00`))}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {m.document ? (
                        <Link
                          to={`/inventario/documentos/${m.document.id}`}
                          className="num font-medium hover:text-brand-accent hover:underline"
                        >
                          {m.document.number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] whitespace-nowrap">
                      {m.is_reversal ? (
                        <Badge variant="outline" className="border-destructive/30 text-destructive">
                          {m.kind_label}
                        </Badge>
                      ) : (
                        m.kind_label
                      )}
                    </TableCell>
                    <TableCell className="num text-right text-[13px] text-success">
                      {m.quantity_in ? formatQty(m.quantity_in) : ''}
                    </TableCell>
                    <TableCell className="num text-right text-[13px] text-destructive">
                      {m.quantity_out ? formatQty(m.quantity_out) : ''}
                    </TableCell>
                    <TableCell className="num text-right text-[13px]">{formatCost(m.unit_cost)}</TableCell>
                    <TableCell className="num text-right text-[13px]">
                      {formatCurrency(Number(m.total_cost))}
                    </TableCell>
                    <TableCell className="num text-right text-[13px] font-semibold">
                      {formatQty(m.quantity_after, unit)}
                    </TableCell>
                    <TableCell className="num text-right text-[13px]">
                      {formatCost(m.avg_cost_after)}
                    </TableCell>
                    <TableCell className="num pr-4 text-right text-[13px]">
                      {formatCurrency(Number(m.value_after))}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {data && data.meta.last_page > 1 && (
          <div className="flex items-center justify-end gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
            <span className="num">
              {page} / {data.meta.last_page}
            </span>
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= data.meta.last_page}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
