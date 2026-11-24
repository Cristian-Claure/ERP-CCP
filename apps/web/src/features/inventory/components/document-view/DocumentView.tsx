import { ArrowLeft, Ban } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/features/auth/hooks'
import { ApiError } from '@/lib/api-error'

import { TYPE_ICONS } from '../../format'
import { useVoidDocument } from '../../hooks'
import type { InventoryDocument } from '../../types'
import { VoidDialog } from '../DocumentActionDialogs'
import { DocumentStatusBadge } from '../DocumentStatusBadge'
import { DocumentViewLines } from './DocumentViewLines'

const dateTimeFmt = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
const dateFmt = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' })

function infoRows(doc: InventoryDocument): [string, ReactNode][] {
  return [
    ['Fecha del documento', dateFmt.format(new Date(`${doc.document_date}T00:00:00`))],
    [
      doc.type === 'transfer' ? 'Origen → destino' : 'Almacén',
      `${doc.warehouse?.name}${doc.destination_warehouse ? ` → ${doc.destination_warehouse.name}` : ''}`,
    ],
    ['Referencia', doc.reference ?? '—'],
    ...(doc.type === 'adjustment'
      ? ([['Motivo', doc.adjustment_reason_label ?? '—']] as [string, string][])
      : []),
    ['Creado por', `${doc.created_by?.name ?? '—'} · ${dateTimeFmt.format(new Date(doc.created_at))}`],
    [
      'Confirmado por',
      doc.posted_at ? `${doc.posted_by?.name} · ${dateTimeFmt.format(new Date(doc.posted_at))}` : '—',
    ],
  ]
}

/** Read-only view of a posted or voided inventory document, with the void action. */
export function DocumentView({ document: doc }: { document: InventoryDocument }) {
  const { can } = useAuth()
  const voidDoc = useVoidDocument()
  const [voidOpen, setVoidOpen] = useState(false)
  const TypeIcon = TYPE_ICONS[doc.type]

  const onVoid = async (reason: string) => {
    try {
      await voidDoc.mutateAsync({ id: doc.id, reason })
      toast.success(`Documento ${doc.number} anulado`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo anular.', { duration: 10_000 })
      throw error
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/inventario/documentos"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Documentos
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border bg-surface-2">
              <TypeIcon className="size-5 text-brand-accent" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="num text-2xl font-semibold tracking-tight">{doc.number ?? 'Borrador'}</h1>
                <DocumentStatusBadge status={doc.status} />
              </div>
              <p className="text-sm text-muted-foreground">{doc.type_label}</p>
            </div>
          </div>
        </div>
        {doc.status === 'posted' && can('movements.void') && (
          <Button variant="destructive" onClick={() => setVoidOpen(true)}>
            <Ban />
            Anular
          </Button>
        )}
      </div>

      {doc.status === 'voided' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">Documento anulado</p>
          <p className="mt-1">
            {doc.voided_by?.name} · {doc.voided_at && dateTimeFmt.format(new Date(doc.voided_at))}
          </p>
          <p className="mt-1 text-muted-foreground">Motivo: {doc.void_reason}</p>
        </div>
      )}

      <Card>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {infoRows(doc).map(([label, value]) => (
            <div key={label} className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium">{value}</p>
            </div>
          ))}
          {doc.notes && (
            <div className="space-y-0.5 sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Notas</p>
              <p className="text-sm">{doc.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <DocumentViewLines doc={doc} />

      <VoidDialog open={voidOpen} onOpenChange={setVoidOpen} documentNumber={doc.number} onConfirm={onVoid} />
    </div>
  )
}
