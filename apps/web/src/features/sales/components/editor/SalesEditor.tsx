import { useState } from 'react'

import { useAuth } from '@/features/auth/hooks'
import { StockShortageAlert } from '@/features/inventory/components/StockShortageAlert'

import { salesTypeMeta } from '../../format'
import type { SalesDocument, SalesDocumentType } from '../../types'
import { AuthorizationDialog } from '../AuthorizationDialog'
import { CustomerFormSheet } from '../CustomerFormSheet'
import { CustomerSummary } from './CustomerSummary'
import { SalesEditorHeader } from './SalesEditorHeader'
import { SalesHeaderFields } from './SalesHeaderFields'
import { SalesLinesEditor } from './SalesLinesEditor'
import { useSalesDocumentFlow } from './useSalesDocumentFlow'
import { useSalesEditorForm } from './useSalesEditorForm'
import { useSalesEditorTotals } from './useSalesEditorTotals'

/** Editor of a new or draft sales document (quote, invoice or sales note). */
export function SalesEditor({
  type,
  document,
  initialCustomerId,
}: {
  type: SalesDocumentType
  document?: SalesDocument
  initialCustomerId?: number
}) {
  const { user, can } = useAuth()
  const [customerSheet, setCustomerSheet] = useState(false)
  const meta = salesTypeMeta(type)
  const isQuote = type === 'quote'
  const breakDownVat = type !== 'sales_note' || (user?.company.sales_note_vat_breakdown ?? false)

  const { form, fieldArray, lines, warehouseId, terms, globalDiscount, customer } = useSalesEditorForm({
    type,
    document,
    initialCustomerId,
  })
  const calc = useSalesEditorTotals({ lines, globalDiscount, breakDownVat, warehouseId, isQuote })
  const flow = useSalesDocumentFlow({ form, document, isQuote })

  const creditAvailable = customer?.receivables ? Number(customer.receivables.available_credit) : null
  const overCredit =
    !isQuote && terms === 'credit' && creditAvailable !== null && calc.totals.total > creditAvailable

  return (
    <form onSubmit={flow.saveDraft} className="flex flex-col gap-6" noValidate>
      <SalesEditorHeader
        meta={meta}
        draftId={flow.draftId}
        isQuote={isQuote}
        canPost={can('sales.post')}
        busy={flow.busy}
        saving={flow.saving}
        posting={flow.posting}
        onDelete={flow.deleteDraft}
        onPost={flow.postDraft}
      />

      {flow.shortages.length > 0 && (
        <StockShortageAlert lines={flow.shortages} title="No se puede confirmar: stock insuficiente" />
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <SalesHeaderFields
          form={form}
          isQuote={isQuote}
          terms={terms}
          customer={customer}
          fallbackCustomerName={document?.customer?.name}
          onCreateCustomer={can('customers.manage') ? () => setCustomerSheet(true) : undefined}
        />
        <CustomerSummary customer={customer} overCredit={overCredit} isQuote={isQuote} terms={terms} />
      </div>

      <SalesLinesEditor
        form={form}
        fieldArray={fieldArray}
        lines={lines}
        document={document}
        calc={calc}
        shortages={flow.shortages}
        isQuote={isQuote}
        canSeeMargin={can('sales.view_margin')}
        allowNegativeStock={user?.company.allow_negative_stock ?? false}
        breakDownVat={breakDownVat}
      />

      <AuthorizationDialog
        request={flow.authRequest}
        canAuthorize={
          flow.authRequest?.kind === 'credit'
            ? can('sales.override_credit_limit')
            : can('sales.authorize_below_cost')
        }
        onClose={flow.closeAuthorization}
        onAuthorize={flow.authorize}
      />
      <CustomerFormSheet
        open={customerSheet}
        onOpenChange={setCustomerSheet}
        onSaved={(c) => {
          form.setValue('customer_id', c.id, { shouldDirty: true, shouldValidate: true })
          form.setValue('payment_terms', c.payment_terms, { shouldDirty: true })
        }}
      />
    </form>
  )
}
