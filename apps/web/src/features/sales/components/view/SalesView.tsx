import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ApiError } from '@/lib/api-error'

import { useConvertQuote, useVoidSalesDocument } from '../../hooks'
import type { SalesDocument } from '../../types'
import { PaymentDialog } from '../PaymentDialog'
import { VoidReasonDialog } from '../VoidReasonDialog'
import { SalesViewDetails } from './SalesViewDetails'
import { SalesViewHeader } from './SalesViewHeader'
import { SalesViewLines } from './SalesViewLines'

/** Read-only view of a posted or voided sales document, with its follow-up actions. */
export function SalesView({ document: doc }: { document: SalesDocument }) {
  const navigate = useNavigate()
  const voidDoc = useVoidSalesDocument()
  const convert = useConvertQuote()
  const [voidOpen, setVoidOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const isSale = doc.type !== 'quote'

  const onVoid = async (reason: string) => {
    try {
      await voidDoc.mutateAsync({ id: doc.id, reason })
      toast.success(`${doc.type_label} ${doc.number} anulada`, {
        description: isSale ? 'Se revirtieron la salida de inventario y la cuenta por cobrar.' : undefined,
      })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo anular.', { duration: 12_000 })
      throw error
    }
  }

  const onConvert = async (type: 'invoice' | 'sales_note') => {
    try {
      const sale = await convert.mutateAsync({ id: doc.id, type })
      toast.success('Borrador de venta creado desde la cotización')
      navigate(`/ventas/documentos/${sale.id}`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo convertir.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SalesViewHeader
        doc={doc}
        converting={convert.isPending}
        onCollect={() => setPayOpen(true)}
        onConvert={onConvert}
        onVoid={() => setVoidOpen(true)}
      />
      <SalesViewDetails doc={doc} />
      <SalesViewLines doc={doc} />

      <VoidReasonDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title={`Anular ${doc.number}`}
        description={
          isSale
            ? 'Se anulará también su salida de inventario (al costo original), su cobro automático si fue al contado, y se revertirá la cuenta por cobrar. Si tiene cobros aplicados, primero anúlalos.'
            : 'La cotización dejará de poder convertirse en venta.'
        }
        confirmLabel="Anular documento"
        onConfirm={onVoid}
      />
      {isSale && doc.customer && (
        <PaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          customer={doc.customer}
          maxAmount={Number(doc.open_amount ?? 0)}
          sale={{ id: doc.id, number: doc.number }}
        />
      )}
    </div>
  )
}
