import { CircleCheckBig, Printer, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { SalesDocument } from '@/features/sales/types'
import { formatCurrency } from '@/lib/format'

import { ticketUrl } from '../lib/ticket'

/** Confirmation after a sale: number, change to give back, print ticket (Enter) or start a new sale. */
export function SaleDoneDialog({ sale, onClose }: { sale: SalesDocument | null; onClose: () => void }) {
  const print = () => {
    if (sale) window.open(ticketUrl(sale.id), '_blank', 'noopener,width=420,height=720')
  }
  const change = Number(sale?.change_amount ?? 0)

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <CircleCheckBig className="size-10 text-success" />
          <DialogTitle className="num">{sale?.number}</DialogTitle>
          <DialogDescription>
            {sale?.type_label} registrada por {formatCurrency(Number(sale?.total ?? 0))}
          </DialogDescription>
        </DialogHeader>
        {change > 0 && (
          <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-center">
            <p className="text-sm text-muted-foreground">Cambio a entregar</p>
            <p className="num text-3xl font-semibold text-success" data-testid="pos-done-change">
              {formatCurrency(change)}
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onClose}>
            <RotateCcw /> Nueva venta
          </Button>
          <Button autoFocus onClick={print}>
            <Printer /> Ticket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
