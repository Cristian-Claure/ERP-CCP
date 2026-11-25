import { ArrowLeft, CheckCheck, LoaderCircle, Save, Trash2 } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks'
import { formatCurrency } from '@/lib/format'

import { DOCUMENT_TYPES, TYPE_ICONS } from '../../format'
import { useWarehouses } from '../../hooks'
import type { DocumentType, InventoryDocument } from '../../types'
import { ConfirmPostDialog } from '../DocumentActionDialogs'
import { StockShortageAlert } from '../StockShortageAlert'
import { DocumentHeaderFields } from './DocumentHeaderFields'
import { DocumentLinesEditor } from './DocumentLinesEditor'
import { useDocumentEditorForm } from './useDocumentEditorForm'
import { useDocumentFlow } from './useDocumentFlow'

/** Editor of a new or draft inventory document (entry, exit, transfer or count adjustment). */
export function DocumentEditor({ type, document }: { type: DocumentType; document?: InventoryDocument }) {
  const { user, can } = useAuth()
  const { data: warehouses } = useWarehouses()
  const state = useDocumentEditorForm(type, document)
  const flow = useDocumentFlow(state.form, document)
  const meta = DOCUMENT_TYPES.find((t) => t.value === type)!
  const TypeIcon = TYPE_ICONS[type]
  const isEntry = type === 'entry'

  return (
    <form onSubmit={flow.saveDraft} className="flex flex-col gap-6" noValidate>
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
              <h1 className="text-2xl font-semibold tracking-tight">
                {document ? `Borrador de ${meta.label.toLowerCase()}` : meta.newTitle}
              </h1>
              <p className="text-sm text-muted-foreground">
                {meta.description}. El número se asigna al confirmar.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {document && (
            <Button
              type="button"
              variant="ghost"
              onClick={flow.deleteDraft}
              disabled={flow.busy}
              className="text-destructive"
            >
              <Trash2 />
              Eliminar
            </Button>
          )}
          <Button type="submit" variant="outline" disabled={flow.busy}>
            {flow.saving && !flow.confirmOpen ? <LoaderCircle className="animate-spin" /> : <Save />}
            Guardar borrador
          </Button>
          {can('movements.post') && (
            <Button type="button" onClick={flow.requestPost} disabled={flow.busy}>
              <CheckCheck />
              Confirmar
            </Button>
          )}
        </div>
      </div>

      {flow.shortages.length > 0 && (
        <StockShortageAlert lines={flow.shortages} title="No se puede confirmar: stock insuficiente" />
      )}

      <DocumentHeaderFields
        form={state.form}
        type={type}
        warehouseId={state.warehouseId}
        reason={state.reason}
        backdateDays={user?.company.document_backdate_days ?? 30}
      />

      <DocumentLinesEditor
        state={state}
        type={type}
        document={document}
        shortages={flow.shortages}
        allowNegative={user?.company.allow_negative_stock ?? false}
      />

      <ConfirmPostDialog
        open={flow.confirmOpen}
        onOpenChange={flow.setConfirmOpen}
        onConfirm={flow.confirmPost}
        summary={
          <dl className="grid grid-cols-2 gap-y-1.5">
            <dt className="text-muted-foreground">Tipo</dt>
            <dd className="text-right font-medium">{meta.label}</dd>
            <dt className="text-muted-foreground">Almacén</dt>
            <dd className="text-right font-medium">
              {warehouses?.find((w) => w.id === state.warehouseId)?.name}
              {type === 'transfer' &&
                ` → ${warehouses?.find((w) => w.id === state.form.getValues('destination_warehouse_id'))?.name ?? ''}`}
            </dd>
            <dt className="text-muted-foreground">Productos</dt>
            <dd className="num text-right font-medium">{state.lines.filter((l) => l.product_id).length}</dd>
            <dt className="text-muted-foreground">{isEntry ? 'Total' : 'Costo estimado'}</dt>
            <dd className="num text-right font-medium">{formatCurrency(state.estimatedTotal)}</dd>
          </dl>
        }
      />
    </form>
  )
}
