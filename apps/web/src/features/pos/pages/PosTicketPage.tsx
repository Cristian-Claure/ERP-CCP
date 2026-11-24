import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/features/auth/hooks'
import { formatQty } from '@/features/inventory/format'
import { formatBizDate, formatDateTime } from '@/features/sales/format'
import { useSalesDocument } from '@/features/sales/hooks'
import { amountInWords } from '@/features/sales/words'
import { formatCurrency } from '@/lib/format'

const TITLES = { invoice: 'Factura', sales_note: 'Nota de venta', quote: 'Cotización' } as const
const money = (v: string | number | null | undefined) => formatCurrency(Number(v ?? 0))

/**
 * 80 mm thermal ticket (monochrome logo, amount in words, payments and change).
 * Outside the app shell; ?auto=1 opens the print dialog once loaded.
 */
export function PosTicketPage() {
  const id = Number(useParams().id)
  const [search] = useSearchParams()
  const { user } = useAuth()
  const { data: doc } = useSalesDocument(id)
  const company = user?.company

  useEffect(() => {
    if (doc && search.get('auto') === '1') {
      const t = setTimeout(() => window.print(), 300)
      return () => clearTimeout(t)
    }
  }, [doc, search])

  if (!doc || !company) return <div className="p-6 text-center text-sm text-zinc-500">Cargando ticket…</div>

  const payments = (doc.payments ?? []).filter((p) => p.status !== 'voided')
  const discounts = Number(doc.line_discount_total) + Number(doc.global_discount)

  return (
    <div className="min-h-screen bg-zinc-200 py-6 text-zinc-950 print:bg-white print:py-0">
      <style>
        {
          '@page { size: 80mm auto; margin: 3mm; } @media print { html, body { background: #fff !important; } }'
        }
      </style>
      <article
        className="mx-auto w-[74mm] bg-white px-2 py-3 font-mono text-[11px] leading-snug shadow-lg print:shadow-none"
        aria-label="Ticket"
      >
        <header className="flex flex-col items-center gap-1 text-center">
          <Logo variant="mono" className="size-10 text-black" />
          <p className="text-[13px] font-bold">{company.legal_name}</p>
          <p>NIT {company.tax_id}</p>
          {company.address && <p>{company.address}</p>}
          {company.phone && <p>Tel. {company.phone}</p>}
        </header>

        <Rule />
        <p className="text-center text-[13px] font-bold uppercase">{TITLES[doc.type]}</p>
        <p className="text-center text-[13px] font-bold">{doc.number}</p>
        {doc.status === 'voided' && <p className="text-center font-bold">*** ANULADO ***</p>}
        <p>Fecha: {doc.posted_at ? formatDateTime(doc.posted_at) : formatBizDate(doc.document_date)}</p>
        <p>Cliente: {doc.customer?.name}</p>
        <p>{doc.customer?.document_label}</p>
        {doc.warehouse && <p>Sucursal: {doc.warehouse.name}</p>}

        <Rule />
        <table className="w-full">
          <tbody>
            {doc.lines?.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="pb-1">
                  <span className="block">{l.product?.name}</span>
                  <span>
                    {formatQty(l.quantity, l.product?.unit?.code)} × {money(l.unit_price)}
                    {Number(l.discount_amount) > 0 && ` −${money(l.discount_amount)}`}
                  </span>
                </td>
                <td className="pb-1 text-right whitespace-nowrap">{money(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Rule />
        <Row label="Subtotal" value={money(doc.subtotal)} />
        {discounts > 0 && <Row label="Descuentos" value={`−${money(discounts)}`} />}
        <Row label="TOTAL" value={money(doc.total)} strong />
        {Number(doc.iva_amount) > 0 && (
          <>
            <Row label="Neto" value={money(doc.net_amount)} />
            <Row label="IVA 13 % incluido" value={money(doc.iva_amount)} />
          </>
        )}
        <p className="mt-1">Son: {amountInWords(Number(doc.total))}</p>

        <Rule />
        {payments.map((p) => (
          <Row key={p.payment_id} label={p.method_label ?? 'Pago'} value={money(p.amount)} />
        ))}
        {doc.cash_received != null && (
          <>
            <Row label="Efectivo recibido" value={money(doc.cash_received)} />
            <Row label="Cambio" value={money(doc.change_amount)} strong />
          </>
        )}

        <Rule />
        <footer className="space-y-1 text-center text-[10px]">
          <p>Atendido por {doc.posted_by?.name ?? doc.created_by?.name}</p>
          {doc.type === 'invoice' && (
            <p>Documento comercial interno. La factura fiscal se emite por el SIAT.</p>
          )}
          <p className="font-bold">¡Gracias por su compra!</p>
        </footer>
      </article>
    </div>
  )
}

function Rule() {
  return <div className="my-1.5 border-t border-dashed border-black" aria-hidden />
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between text-[13px] font-bold' : 'flex justify-between'}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
