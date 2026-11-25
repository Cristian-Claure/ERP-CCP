import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Card, CardContent } from '@/components/ui/card'

import { formatBizDate, formatDateTime, PAYMENT_METHODS } from '../../format'
import type { SalesDocument } from '../../types'

const linkClass = 'num text-sm font-medium hover:text-brand-accent hover:underline'

function infoRows(doc: SalesDocument): [string, ReactNode][] {
  const isSale = doc.type !== 'quote'
  const method = doc.payment_method
    ? ` · ${PAYMENT_METHODS.find((m) => m.value === doc.payment_method)?.label}`
    : ''
  return [
    [
      'Cliente',
      <Link
        key="c"
        to={`/ventas/clientes/${doc.customer_id}`}
        className="hover:text-brand-accent hover:underline"
      >
        {doc.customer?.name}
      </Link>,
    ],
    [
      'Documento del cliente',
      <span key="d" className="num">
        {doc.customer?.document_label}
      </span>,
    ],
    ['Fecha', formatBizDate(doc.document_date)],
    isSale ? ['Vencimiento', formatBizDate(doc.due_date)] : ['Válida hasta', formatBizDate(doc.valid_until)],
    ['Condición', doc.payment_terms_label + method],
    ['Almacén', doc.warehouse?.name ?? '—'],
    ['Referencia', doc.reference ?? '—'],
    ['Creado por', `${doc.created_by?.name ?? '—'} · ${formatDateTime(doc.created_at)}`],
    ['Confirmado por', doc.posted_at ? `${doc.posted_by?.name} · ${formatDateTime(doc.posted_at)}` : '—'],
  ]
}

function AuthorizationNote({
  title,
  auth,
}: {
  title: string
  auth: NonNullable<SalesDocument['credit_override']>
}) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-warning">
        <ShieldCheck className="size-4" /> {title}
      </p>
      <p className="mt-1">
        {auth.by?.name ?? '—'} · {auth.at && formatDateTime(auth.at)}
      </p>
      <p className="mt-0.5 text-muted-foreground">Motivo: {auth.reason}</p>
    </div>
  )
}

/** Void banner, granted authorizations and the header data card of a read-only document. */
export function SalesViewDetails({ doc }: { doc: SalesDocument }) {
  return (
    <>
      {doc.status === 'voided' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">Documento anulado</p>
          <p className="mt-1">
            {doc.voided_by?.name} · {doc.voided_at && formatDateTime(doc.voided_at)}
          </p>
          <p className="mt-1 text-muted-foreground">Motivo: {doc.void_reason}</p>
        </div>
      )}

      {(doc.below_cost_authorization || doc.credit_override) && (
        <div className="grid gap-3 md:grid-cols-2">
          {doc.below_cost_authorization && (
            <AuthorizationNote
              title="Venta bajo costo / precio mínimo autorizada"
              auth={doc.below_cost_authorization}
            />
          )}
          {doc.credit_override && (
            <AuthorizationNote title="Exceso de límite de crédito autorizado" auth={doc.credit_override} />
          )}
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
          {doc.inventory_document && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Salida de inventario</p>
              <Link to={`/inventario/documentos/${doc.inventory_document.id}`} className={linkClass}>
                {doc.inventory_document.number}
              </Link>
            </div>
          )}
          {doc.quote && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Cotización de origen</p>
              <Link to={`/ventas/documentos/${doc.quote.id}`} className={linkClass}>
                {doc.quote.number}
              </Link>
            </div>
          )}
          {doc.conversions && doc.conversions.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Convertida en</p>
              <p className="flex flex-wrap gap-2">
                {doc.conversions.map((c) => (
                  <Link key={c.id} to={`/ventas/documentos/${c.id}`} className={linkClass}>
                    {c.number ?? `Borrador #${c.id}`}
                  </Link>
                ))}
              </p>
            </div>
          )}
          {doc.notes && (
            <div className="space-y-0.5 sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Notas</p>
              <p className="text-sm">{doc.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
