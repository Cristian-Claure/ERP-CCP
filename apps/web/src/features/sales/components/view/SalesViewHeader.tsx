import { ArrowLeft, ArrowRightLeft, Ban, HandCoins, LoaderCircle, Printer } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/hooks'
import { DocumentStatusBadge } from '@/features/inventory/components/DocumentStatusBadge'

import { daysFromToday, salesTypeMeta } from '../../format'
import type { SalesDocument } from '../../types'
import { SalesTypeBadge } from '../Badges'

/** Number, badges and the actions of a posted/voided document: print, collect, convert, void. */
export function SalesViewHeader({
  doc,
  converting,
  onCollect,
  onConvert,
  onVoid,
}: {
  doc: SalesDocument
  converting: boolean
  onCollect: () => void
  onConvert: (type: 'invoice' | 'sales_note') => void
  onVoid: () => void
}) {
  const { can } = useAuth()
  const meta = salesTypeMeta(doc.type)
  const isSale = doc.type !== 'quote'
  const open = Number(doc.open_amount ?? 0)
  const activeConversion = doc.conversions?.find((c) => c.status !== 'voided')
  const quoteValid =
    doc.type === 'quote' &&
    doc.status === 'posted' &&
    (!doc.valid_until || daysFromToday(doc.valid_until) >= 0)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1.5">
        <Link
          to="/ventas/documentos"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Ventas
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border bg-surface-2">
            <meta.icon className="size-5 text-brand-accent" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="num text-2xl font-semibold tracking-tight">{doc.number ?? 'Borrador'}</h1>
              <SalesTypeBadge type={doc.type} label={doc.type_label} />
              <DocumentStatusBadge status={doc.status} />
            </div>
            <p className="text-sm text-muted-foreground">{doc.customer?.name}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {doc.status !== 'draft' && (
          <Button variant="outline" asChild>
            <a href={`/ventas/documentos/${doc.id}/imprimir`} target="_blank" rel="noreferrer">
              <Printer /> Imprimir / PDF
            </a>
          </Button>
        )}
        {isSale && doc.status === 'posted' && open > 0 && can('receivables.collect') && (
          <Button variant="outline" onClick={onCollect}>
            <HandCoins /> Registrar cobro
          </Button>
        )}
        {quoteValid && !activeConversion && can('sales.create') && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={converting}>
                {converting ? <LoaderCircle className="animate-spin" /> : <ArrowRightLeft />}
                Convertir en venta
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onConvert('invoice')}>Factura (VTA)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onConvert('sales_note')}>Nota de venta (NV)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {doc.status === 'posted' && can('sales.void') && (
          <Button variant="destructive" onClick={onVoid}>
            <Ban /> Anular
          </Button>
        )}
      </div>
    </div>
  )
}
