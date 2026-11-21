import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/features/auth/hooks'
import { formatQty } from '@/features/inventory/format'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { formatBizDate, PAYMENT_METHODS } from '../format'
import { useSalesDocument } from '../hooks'
import { amountInWords } from '../words'

const TITLES = { invoice: 'Factura', sales_note: 'Nota de venta', quote: 'Cotización' } as const

/**
 * Print / PDF view of a sales document (A4, light, outside the app shell).
 * "Guardar como PDF" from the browser print dialog produces the PDF: no
 * server-side PDF library is needed.
 */
export function SalesPrintPage() {
  const id = Number(useParams().id)
  const [search] = useSearchParams()
  const { user } = useAuth()
  const { data: doc, isPending } = useSalesDocument(id)
  const [mono, setMono] = useState(false)
  const company = user?.company

  useEffect(() => {
    if (doc) document.title = `${doc.number ?? 'Borrador'} · ${doc.customer?.name ?? ''}`
  }, [doc])

  useEffect(() => {
    if (doc && search.get('auto') === '1') {
      const t = setTimeout(() => window.print(), 300)
      return () => clearTimeout(t)
    }
  }, [doc, search])

  if (isPending || !doc || !company) {
    return (
      <div className="grid min-h-screen place-items-center bg-white text-sm text-zinc-500">
        Cargando documento…
      </div>
    )
  }

  const discounts = Number(doc.line_discount_total) + Number(doc.global_discount)
  const showVat = Number(doc.iva_amount) > 0
  const ink = mono ? 'text-zinc-900' : 'text-[#4f46e5]'

  return (
    <div className="min-h-screen bg-zinc-200 py-8 text-zinc-900 print:bg-white print:py-0">
      <style>
        {'@page { size: A4; margin: 14mm; } @media print { html, body { background: #fff !important; } }'}
      </style>

      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Button asChild variant="outline" size="sm" className="bg-white text-zinc-900 hover:bg-zinc-100">
          <Link to={`/ventas/documentos/${doc.id}`}>
            <ArrowLeft /> Volver
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <Switch checked={mono} onCheckedChange={setMono} /> Monocromo
          </label>
          <Button size="sm" onClick={() => window.print()}>
            <Printer /> Imprimir / Guardar PDF
          </Button>
        </div>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[12mm] shadow-xl print:max-w-none print:p-0 print:shadow-none">
        {/* Header */}
        <header className="flex items-start justify-between gap-6 border-b border-zinc-200 pb-5">
          <div className="flex items-start gap-3">
            <Logo variant={mono ? 'mono' : 'color'} className="size-14 text-zinc-900" />
            <div className="text-[11px] leading-relaxed text-zinc-600">
              <p className="text-base font-bold text-zinc-900">{company.legal_name}</p>
              <p>NIT {company.tax_id}</p>
              {company.address && <p>{company.address}</p>}
              <p>{[company.phone, company.email].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn('text-xl font-extrabold tracking-wide uppercase', ink)}>{TITLES[doc.type]}</p>
            <p className="num mt-1 text-lg font-semibold">{doc.number ?? 'BORRADOR'}</p>
            {doc.status === 'voided' && (
              <p className="mt-1 inline-block rounded border-2 border-red-600 px-2 text-sm font-bold text-red-600 uppercase">
                Anulado
              </p>
            )}
          </div>
        </header>

        {/* Parties */}
        <section className="grid grid-cols-[1.4fr_1fr] gap-6 py-5 text-[12px]">
          <div>
            <p className="mb-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Cliente</p>
            <p className="text-sm font-semibold">{doc.customer?.name}</p>
            <p className="num">{doc.customer?.document_label}</p>
            {doc.customer?.address && <p className="text-zinc-600">{doc.customer.address}</p>}
            <p className="text-zinc-600">
              {[doc.customer?.city, doc.customer?.phone].filter(Boolean).join(' · ')}
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-zinc-500">Fecha</dt>
            <dd className="num text-right font-medium">{formatBizDate(doc.document_date)}</dd>
            {doc.type === 'quote' ? (
              <>
                <dt className="text-zinc-500">Válida hasta</dt>
                <dd className="num text-right font-medium">{formatBizDate(doc.valid_until)}</dd>
              </>
            ) : (
              <>
                <dt className="text-zinc-500">Condición</dt>
                <dd className="text-right font-medium">
                  {doc.payment_terms_label}
                  {doc.payment_method &&
                    ` · ${PAYMENT_METHODS.find((m) => m.value === doc.payment_method)?.label}`}
                </dd>
                {doc.payment_terms === 'credit' && (
                  <>
                    <dt className="text-zinc-500">Vence</dt>
                    <dd className="num text-right font-medium">{formatBizDate(doc.due_date)}</dd>
                  </>
                )}
              </>
            )}
            {doc.reference && (
              <>
                <dt className="text-zinc-500">Referencia</dt>
                <dd className="num text-right">{doc.reference}</dd>
              </>
            )}
            <dt className="text-zinc-500">Atendido por</dt>
            <dd className="text-right">{doc.posted_by?.name ?? doc.created_by?.name}</dd>
          </dl>
        </section>

        {/* Lines */}
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr
              className={cn(
                'border-y-2 text-left text-[10px] tracking-wider uppercase',
                mono ? 'border-zinc-900' : 'border-[#6366f1]',
              )}
            >
              <th className="py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-2 font-semibold">Código</th>
              <th className="py-2 pr-2 font-semibold">Descripción</th>
              <th className="py-2 pr-2 text-right font-semibold">Cantidad</th>
              <th className="py-2 pr-2 text-right font-semibold">P. unitario</th>
              <th className="py-2 pr-2 text-right font-semibold">Descuento</th>
              <th className="py-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines?.map((l, i) => (
              <tr key={l.id} className="break-inside-avoid border-b border-zinc-200 align-top">
                <td className="num py-1.5 pr-2 text-zinc-500">{i + 1}</td>
                <td className="num py-1.5 pr-2">{l.product?.sku}</td>
                <td className="py-1.5 pr-2">{l.product?.name}</td>
                <td className="num py-1.5 pr-2 text-right">{formatQty(l.quantity, l.product?.unit?.code)}</td>
                <td className="num py-1.5 pr-2 text-right">{formatCurrency(Number(l.unit_price))}</td>
                <td className="num py-1.5 pr-2 text-right">
                  {Number(l.discount_amount) > 0 ? formatCurrency(Number(l.discount_amount)) : '—'}
                </td>
                <td className="num py-1.5 text-right font-medium">
                  {formatCurrency(Number(l.gross_amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <section className="mt-4 flex break-inside-avoid items-start justify-between gap-8">
          <div className="max-w-[60%] text-[11px] text-zinc-600">
            <p className="font-semibold text-zinc-900">Son: {amountInWords(Number(doc.total))}</p>
            {doc.notes && <p className="mt-2">{doc.notes}</p>}
          </div>
          <dl className="grid min-w-[62mm] grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[12px]">
            <dt className="text-zinc-500">Subtotal</dt>
            <dd className="num text-right">
              {formatCurrency(Number(doc.subtotal) - Number(doc.line_discount_total))}
            </dd>
            {Number(doc.global_discount) > 0 && (
              <>
                <dt className="text-zinc-500">Descuento global</dt>
                <dd className="num text-right">−{formatCurrency(Number(doc.global_discount))}</dd>
              </>
            )}
            <dt
              className={cn(
                'mt-1 border-t-2 pt-1.5 text-sm font-bold',
                mono ? 'border-zinc-900' : 'border-[#6366f1]',
              )}
            >
              Total Bs
            </dt>
            <dd
              className={cn(
                'num mt-1 border-t-2 pt-1.5 text-right text-sm font-bold',
                mono ? 'border-zinc-900' : 'border-[#6366f1]',
              )}
            >
              {formatCurrency(Number(doc.total))}
            </dd>
            {showVat && (
              <>
                <dt className="text-[10.5px] text-zinc-500">Importe neto</dt>
                <dd className="num text-right text-[10.5px] text-zinc-500">
                  {formatCurrency(Number(doc.net_amount))}
                </dd>
                <dt className="text-[10.5px] text-zinc-500">IVA 13 % incluido</dt>
                <dd className="num text-right text-[10.5px] text-zinc-500">
                  {formatCurrency(Number(doc.iva_amount))}
                </dd>
              </>
            )}
            {discounts > 0 && (
              <>
                <dt className="text-[10.5px] text-zinc-500">Ahorro total</dt>
                <dd className="num text-right text-[10.5px] text-zinc-500">{formatCurrency(discounts)}</dd>
              </>
            )}
          </dl>
        </section>

        <footer className="mt-12 border-t border-zinc-200 pt-3 text-center text-[9.5px] leading-relaxed text-zinc-500">
          {doc.type === 'invoice' && (
            <p>
              Documento comercial interno. La factura con validez fiscal se emitirá a través del SIAT
              (facturación electrónica, fase pendiente).
            </p>
          )}
          {doc.type === 'quote' && (
            <p>Precios en bolivianos con IVA incluido. Sujetos a disponibilidad de stock.</p>
          )}
          <p className="mt-1">Generado con CCP · Control Central de Procesos</p>
        </footer>
      </article>
    </div>
  )
}
