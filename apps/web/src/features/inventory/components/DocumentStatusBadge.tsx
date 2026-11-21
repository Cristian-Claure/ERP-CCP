import { Badge } from '@/components/ui/badge'
import { cn } from 'cn'

import type { DocumentStatus } from '../types'

const STYLES: Record<DocumentStatus, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'border-border bg-muted text-muted-foreground' },
  posted: { label: 'Confirmado', className: 'border-success/25 bg-success/12 text-success' },
  voided: {
    label: 'Anulado',
    className: 'border-destructive/25 bg-destructive/10 text-destructive line-through',
  },
}

export function DocumentStatusBadge({ status, className }: { status: DocumentStatus; className?: string }) {
  const style = STYLES[status]
  return (
    <Badge variant="outline" className={cn('font-medium', style.className, className)}>
      {style.label}
    </Badge>
  )
}
