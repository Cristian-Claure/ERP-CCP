import { ArrowLeft, CheckCheck, LoaderCircle, Save, Trash2 } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

import type { salesTypeMeta } from '../../format'

/** Title of the editor and its actions: delete draft, save draft and post. */
export function SalesEditorHeader({
  meta,
  draftId,
  isQuote,
  canPost,
  busy,
  saving,
  posting,
  onDelete,
  onPost,
}: {
  meta: ReturnType<typeof salesTypeMeta>
  draftId: number | undefined
  isQuote: boolean
  canPost: boolean
  busy: boolean
  saving: boolean
  posting: boolean
  onDelete: () => void
  onPost: () => void
}) {
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
            <h1 className="text-2xl font-semibold tracking-tight">
              {draftId ? `Borrador de ${meta.label.toLowerCase()}` : meta.newTitle}
            </h1>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {draftId && (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            disabled={busy}
            className="text-destructive"
          >
            <Trash2 /> Eliminar
          </Button>
        )}
        <Button type="submit" variant="outline" disabled={busy}>
          {saving && !posting ? <LoaderCircle className="animate-spin" /> : <Save />}
          Guardar borrador
        </Button>
        {canPost && (
          <Button type="button" onClick={onPost} disabled={busy}>
            {posting ? <LoaderCircle className="animate-spin" /> : <CheckCheck />}
            {isQuote ? 'Emitir cotización' : 'Confirmar venta'}
          </Button>
        )}
      </div>
    </div>
  )
}
