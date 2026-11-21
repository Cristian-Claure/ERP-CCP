import { Construction } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { findNavMatch } from '@/components/layout/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'

/** Placeholder for modules scheduled in later phases. */
export function ComingSoonPage() {
  const { pathname } = useLocation()
  const match = findNavMatch(pathname)
  const title = match?.item.title ?? 'Módulo'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={match ? `${match.section.title} · Próximamente` : undefined} />
      <EmptyState
        icon={match?.item.icon ?? Construction}
        title={`${title} está en construcción`}
        description="Este módulo llegará en las próximas fases del roadmap de CCP."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/">Volver al dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}
