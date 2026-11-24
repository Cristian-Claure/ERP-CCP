import { CircleCheck, UserPlus, UserRound } from 'lucide-react'
import { forwardRef, useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from 'cn'

import { useCustomerLookup } from '../queries'
import { usePosStore } from '../store'
import type { PosDocumentType } from '../types'

/**
 * Quick NIT/CI + razón social (F3). An existing customer is found by its NIT/CI;
 * an unknown one is created on the fly at checkout with just these two fields.
 * Empty NIT/CI = walk-in customer "Sin nombre / S/N".
 */
export const CustomerBar = forwardRef<HTMLInputElement>(function CustomerBar(_, ref) {
  const { customer, docType, setCustomer, setDocType } = usePosStore()
  const [document, setDocument] = useState(customer?.document_number ?? '')
  const [name, setName] = useState(customer?.name ?? '')
  const lookup = useCustomerLookup(document)
  const found = document.trim().length >= 3 ? lookup.data : null

  // Cart cleared after a sale: reset the inputs too.
  useEffect(() => {
    if (customer === null) {
      setDocument('')
      setName('')
    }
  }, [customer])

  // A NIT/CI usually means the customer wants an invoice; S/N defaults to a sales note.
  const hasDocument = document.trim() !== ''
  useEffect(() => setDocType(hasDocument ? 'invoice' : 'sales_note'), [hasDocument, setDocType])

  useEffect(() => {
    const number = document.trim()
    if (!number) return setCustomer(null)
    if (found) return setCustomer({ id: found.id })
    setCustomer({
      document_type: /^\d{7,}$/.test(number) ? 'nit' : 'ci',
      document_number: number,
      name: name.trim(),
    })
  }, [document, name, found, setCustomer])

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
      <UserRound className="ml-1 size-4 text-muted-foreground" />
      <Input
        ref={ref}
        value={document}
        onChange={(e) => setDocument(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
        placeholder="NIT / CI (F3)"
        aria-label="NIT o CI del cliente"
        className="num h-9 w-40"
      />
      {found ? (
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          <CircleCheck className="size-4 shrink-0 text-success" />
          <span className="truncate font-medium">{found.name}</span>
        </span>
      ) : (
        <div className="relative min-w-48 flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!document.trim()}
            placeholder={document.trim() ? 'Razón social (cliente nuevo)' : 'Sin nombre / S/N'}
            aria-label="Razón social"
            className={cn('h-9', document.trim() && !lookup.isFetching && 'pl-8')}
          />
          {document.trim() && !lookup.isFetching && (
            <UserPlus className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-warning" />
          )}
        </div>
      )}
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={docType}
        onValueChange={(v) => v && setDocType(v as PosDocumentType)}
        aria-label="Tipo de documento"
      >
        <ToggleGroupItem
          value="sales_note"
          className="data-[state=on]:border-brand data-[state=on]:bg-brand/20 data-[state=on]:text-foreground"
        >
          Nota de venta
        </ToggleGroupItem>
        <ToggleGroupItem
          value="invoice"
          className="data-[state=on]:border-brand data-[state=on]:bg-brand/20 data-[state=on]:text-foreground"
        >
          Factura
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
})
