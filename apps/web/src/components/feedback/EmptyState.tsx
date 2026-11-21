import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from 'cn'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-brand/30 to-brand-accent/30 blur-xl" />
        <div className="relative flex size-12 items-center justify-center rounded-2xl border bg-surface-2">
          <Icon className="size-5 text-brand-accent" />
        </div>
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
