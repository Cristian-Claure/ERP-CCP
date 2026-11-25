import { FileWarning } from 'lucide-react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks'

import { DocumentEditor } from '../components/document-editor/DocumentEditor'
import { DocumentView } from '../components/document-view/DocumentView'
import { DOCUMENT_TYPES } from '../format'
import { useDocument } from '../hooks'
import type { DocumentType } from '../types'

/**
 * /inventario/documentos/nuevo?tipo= and /inventario/documentos/:id — routes to
 * the editor (new or draft document) or to the read-only view (posted/voided).
 */
export function DocumentFormPage() {
  const params = useParams()
  const [search] = useSearchParams()
  const id = params.id ? Number(params.id) : undefined
  const { data: document, isPending, isError } = useDocument(id)
  const { can } = useAuth()

  if (!id) {
    const type = search.get('tipo') as DocumentType | null
    if (!type || !DOCUMENT_TYPES.some((t) => t.value === type))
      return <Navigate to="/inventario/documentos" replace />
    if (!can('movements.create')) return <Navigate to="/inventario/documentos" replace />
    return <DocumentEditor key={`new-${type}`} type={type} />
  }

  if (isPending) return <PageSkeleton />
  if (isError || !document)
    return (
      <EmptyState
        icon={FileWarning}
        title="Documento no encontrado"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/inventario/documentos">Volver</Link>
          </Button>
        }
      />
    )

  return document.status === 'draft' && can('movements.create') ? (
    <DocumentEditor key={document.id} type={document.type} document={document} />
  ) : (
    <DocumentView document={document} />
  )
}
