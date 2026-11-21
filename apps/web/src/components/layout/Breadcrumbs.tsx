import { Fragment } from 'react'
import { Link, useLocation } from 'react-router'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

import { findNavMatch } from './navigation'

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const match = findNavMatch(pathname)

  const crumbs: { label: string; href?: string }[] = [{ label: 'CCP', href: '/' }]
  if (match && match.item.href !== '/') {
    crumbs.push({ label: match.section.title })
  }
  if (match?.child) {
    crumbs.push({ label: match.item.title, href: match.item.children?.[0]?.href })
    const isDetail = pathname !== match.child.href
    crumbs.push({ label: match.child.title, href: isDetail ? match.child.href : undefined })
    if (isDetail) crumbs.push({ label: pathname.endsWith('/nuevo') ? 'Nuevo' : 'Detalle' })
  } else {
    crumbs.push({ label: match?.item.title ?? 'Página no encontrada' })
  }

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-[13px]">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem className={index > 0 && !isLast ? 'hidden sm:inline-flex' : undefined}>
                {isLast ? (
                  <BreadcrumbPage className="font-medium">{crumb.label}</BreadcrumbPage>
                ) : crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="text-muted-foreground">{crumb.label}</span>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className={index > 0 ? 'hidden sm:block' : undefined} />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
