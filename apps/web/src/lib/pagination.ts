/** Laravel paginated resource collection (the shared list contract of the API). */
export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

/** Query params of every list endpoint: ?page&per_page&sort&filter[key]=value */
export type ListParams = Record<string, string | number | undefined>
