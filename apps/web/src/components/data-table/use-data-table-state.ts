import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import type { ListParams } from '@/lib/pagination'

export interface DataTableStateOptions {
  /** Default server sort, e.g. "-created_at". */
  defaultSort?: string
  defaultPerPage?: number
  /** Filters applied when the URL has none (e.g. { status: 'draft' }). */
  defaultFilters?: Record<string, string>
  /** Prefix for URL keys when a page hosts more than one table. */
  prefix?: string
}

export interface DataTableState {
  page: number
  perPage: number
  sort: string | undefined
  search: string
  filters: Record<string, string>
  /** Params ready for the API: { page, per_page, sort, 'filter[x]': v } */
  params: ListParams
  setPage: (page: number) => void
  setPerPage: (perPage: number) => void
  setSort: (sort: string | undefined) => void
  setSearch: (search: string) => void
  setFilter: (key: string, value: string | undefined) => void
  reset: () => void
}

/**
 * Server-side table state stored in the URL (shareable links, back button works).
 * Any change to sort/filters/search resets to page 1.
 */
export function useDataTableState({
  defaultSort,
  defaultPerPage = 25,
  defaultFilters = {},
  prefix = '',
}: DataTableStateOptions = {}): DataTableState {
  const [searchParams, setSearchParams] = useSearchParams()
  const key = useCallback((name: string) => `${prefix}${name}`, [prefix])

  const page = Math.max(1, Number(searchParams.get(key('page'))) || 1)
  const perPage = Number(searchParams.get(key('per_page'))) || defaultPerPage
  const sort = searchParams.get(key('sort')) ?? defaultSort
  const search = searchParams.get(key('q')) ?? ''

  const filterKey = searchParams.toString()
  const filters = useMemo(() => {
    const result: Record<string, string> = { ...defaultFilters }
    const params = new URLSearchParams(filterKey)
    for (const [k, v] of params.entries()) {
      const match = k.match(new RegExp(`^${prefix}f_(.+)$`))
      if (match?.[1]) {
        if (v === '') delete result[match[1]]
        else result[match[1]] = v
      }
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, prefix])

  const update = useCallback(
    (changes: Record<string, string | undefined>, resetPage = true) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(changes)) {
            if (v === undefined) next.delete(k)
            else next.set(k, v)
          }
          if (resetPage) next.delete(key('page'))
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams, key],
  )

  const params = useMemo<ListParams>(() => {
    const p: ListParams = { page, per_page: perPage }
    if (sort) p.sort = sort
    if (search) p['filter[search]'] = search
    for (const [k, v] of Object.entries(filters)) p[`filter[${k}]`] = v
    return p
  }, [page, perPage, sort, search, filters])

  return {
    page,
    perPage,
    sort,
    search,
    filters,
    params,
    setPage: (value) => update({ [key('page')]: value > 1 ? String(value) : undefined }, false),
    setPerPage: (value) => update({ [key('per_page')]: String(value) }),
    setSort: (value) => update({ [key('sort')]: value }),
    setSearch: (value) => update({ [key('q')]: value || undefined }),
    // An explicit empty value overrides a default filter ("Todos").
    setFilter: (name, value) =>
      update({ [key(`f_${name}`)]: value ?? (defaultFilters[name] !== undefined ? '' : undefined) }),
    reset: () =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const k of [...next.keys()]) if (k.startsWith(prefix)) next.delete(k)
          return next
        },
        { replace: true },
      ),
  }
}
