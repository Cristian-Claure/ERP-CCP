import { Badge } from '@/components/ui/badge'
import { cn } from 'cn'

import { DEBT_STATUS } from '../format'
import type { DebtStatus, SalesDocumentType } from '../types'

export function DebtStatusBadge({
  status,
  className,
}: {
  status: DebtStatus | null | undefined
  className?: string
}) {
  if (!status) return null
  const s = DEBT_STATUS[status]
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', s.className, className)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </Badge>
  )
}

const TYPE_STYLES: Record<SalesDocumentType, string> = {
  invoice: 'border-brand/30 bg-brand/10 text-brand',
  sales_note: 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent',
  quote: 'border-border bg-muted text-muted-foreground',
}

export function SalesTypeBadge({ type, label }: { type: SalesDocumentType; label: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', TYPE_STYLES[type])}>
      {label}
    </Badge>
  )
}
