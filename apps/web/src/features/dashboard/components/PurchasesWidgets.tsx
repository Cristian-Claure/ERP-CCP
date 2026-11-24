import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AgingBar } from '@/features/sales/components/AgingBar'
import type { Aging } from '@/features/sales/types'
import { formatCurrency } from '@/lib/format'

/** Accounts payable by age (same buckets as receivables). */
export function PayablesCard({ aging }: { aging: Aging }) {
  return (
    <Card className="gap-3">
      <CardHeader className="flex-row items-baseline justify-between">
        <CardTitle className="text-base">Cuentas por pagar</CardTitle>
        <span className="num text-lg font-semibold">{formatCurrency(Number(aging.total))}</span>
      </CardHeader>
      <CardContent className="space-y-3">
        <AgingBar aging={aging} compact />
        <Link
          to="/compras/pagos"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Ver pagos a proveedores <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
