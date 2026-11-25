import { ArrowLeft, Keyboard } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/features/auth/hooks'
import { AuthorizationDialog } from '@/features/sales/components/AuthorizationDialog'

import { CartPanel } from '../components/CartPanel'
import { CheckoutDialog } from '../components/CheckoutDialog'
import { CustomerBar } from '../components/CustomerBar'
import { ProductPanel } from '../components/ProductPanel'
import { SaleDoneDialog } from '../components/SaleDoneDialog'
import { WarehouseSelect } from '../components/WarehouseSelect'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import { usePosCheckoutFlow } from '../hooks/usePosCheckoutFlow'
import { usePosShortcuts } from '../hooks/usePosShortcuts'
import { cartTotals, overStock } from '../lib/cart'
import { usePosCatalog } from '../queries'
import { usePosStore } from '../store'

const SHORTCUTS = 'F2 buscar · F3 cliente · F4 cobrar · +/− cantidad · Supr quitar · Esc cancelar'

/** /pos — counter sale: keyboard, barcode reader and touch friendly. Same engine as any sale. */
export function PosPage() {
  const { user, can } = useAuth()
  const warehouseId = user?.pos_warehouse_id ?? undefined
  const catalog = usePosCatalog(warehouseId)
  const flow = usePosCheckoutFlow(warehouseId)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [term, setTerm] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const customerRef = useRef<HTMLInputElement>(null)
  const { lines, selected, docType, globalDiscount, add, step, remove, clear } = usePosStore()

  const breakDownVat = docType === 'invoice' || (user?.company.sales_note_vat_breakdown ?? false)
  const totals = useMemo(
    () => cartTotals(lines, globalDiscount, breakDownVat),
    [lines, globalDiscount, breakDownVat],
  )
  const stockMap = useMemo(() => new Map(catalog.data?.map((p) => [p.id, p.stock])), [catalog.data])
  const short = useMemo(
    () =>
      user?.company.allow_negative_stock ? new Set<number>() : overStock(lines, (id) => stockMap.get(id)),
    [lines, stockMap, user?.company.allow_negative_stock],
  )
  const dialogOpen = checkoutOpen || !!flow.authRequest || !!flow.done

  const onScan = useCallback(
    (code: string) => {
      // A lag spike can split a burst: the detector then reports only its tail, but every
      // keystroke also reached the focused search box, which holds the whole code.
      const typed = searchRef.current?.value.trim() ?? ''
      const product =
        catalog.index.byCode(code) ?? (typed.endsWith(code) ? catalog.index.byCode(typed) : undefined)
      if (product) add(product)
      else toast.error(`Código ${typed.endsWith(code) ? typed : code} no encontrado`)
      setTerm('')
    },
    [catalog.index, add],
  )
  useBarcodeScanner(onScan, !!warehouseId && !dialogOpen)

  const openCheckout = () => {
    if (lines.length === 0) return
    if (totals.total <= 0) return toast.error('El total debe ser mayor a cero.')
    setCheckoutOpen(true)
  }
  usePosShortcuts(
    {
      search: () => searchRef.current?.focus(),
      customer: () => customerRef.current?.focus(),
      checkout: openCheckout,
      increment: () => selected >= 0 && step(selected, 1),
      decrement: () => selected >= 0 && step(selected, -1),
      remove: () => selected >= 0 && remove(selected),
      cancel: () => {
        if (lines.length && window.confirm('¿Vaciar el carrito?')) clear()
        searchRef.current?.focus()
      },
    },
    !dialogOpen,
  )

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> <Logo className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold">Punto de venta</h1>
        <WarehouseSelect value={warehouseId} />
        <p className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
          <Keyboard className="size-3.5" /> {SHORTCUTS}
        </p>
        <span className="text-sm text-muted-foreground">{user?.name}</span>
      </header>

      {!warehouseId ? (
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
          Elige el almacén de este punto de venta para empezar.
        </div>
      ) : (
        <main className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[1fr_420px]">
          <ProductPanel
            ref={searchRef}
            term={term}
            onTermChange={setTerm}
            products={catalog.data ?? []}
            index={catalog.index}
            loading={catalog.isPending}
            onPick={(p) => add(p)}
          />
          <div className="flex min-h-0 flex-col gap-3">
            <CustomerBar ref={customerRef} />
            <CartPanel
              totals={totals}
              breakDownVat={breakDownVat}
              overStock={short}
              canDiscount={can('sales.authorize_below_cost')}
              onCheckout={openCheckout}
            />
          </div>
        </main>
      )}

      <CheckoutDialog
        open={checkoutOpen}
        total={totals.total}
        pending={flow.pending}
        onOpenChange={setCheckoutOpen}
        onConfirm={async (tenders) => {
          // Below cost keeps the payment open under the authorization dialog; anything else closes it.
          if ((await flow.submit(tenders)) !== 'auth') setCheckoutOpen(false)
        }}
      />
      <AuthorizationDialog
        request={flow.authRequest}
        canAuthorize={can('sales.authorize_below_cost')}
        onClose={flow.closeAuthorization}
        onAuthorize={async (reason) => {
          if ((await flow.authorize(reason)) === 'ok') setCheckoutOpen(false)
        }}
      />
      <SaleDoneDialog
        sale={flow.done}
        onClose={() => {
          flow.closeDone()
          searchRef.current?.focus()
        }}
      />
    </div>
  )
}
