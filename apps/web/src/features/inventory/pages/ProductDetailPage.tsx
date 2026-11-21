import { ArrowLeft, Boxes, Pencil, Warehouse as WarehouseIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/hooks'
import { formatCurrency } from '@/lib/format'

import { KardexView } from '../components/KardexView'
import { ProductFormSheet } from '../components/ProductFormSheet'
import { formatCost, formatQty } from '../format'
import { useProduct, useProductStock } from '../hooks'
import type { Product } from '../types'

export function ProductDetailPage() {
  const id = Number(useParams().id)
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'info'
  const { data: product, isPending, isError } = useProduct(id)
  const [editing, setEditing] = useState(false)
  const { can } = useAuth()

  if (isPending) return <PageSkeleton />
  if (isError || !product)
    return (
      <EmptyState
        icon={Boxes}
        title="Producto no encontrado"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/inventario/productos">Volver a productos</Link>
          </Button>
        }
      />
    )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/inventario/productos"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Productos
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
            {!product.is_active && <Badge variant="outline">Inactivo</Badge>}
            {product.stock?.below_min && (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                Bajo mínimo
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="num">{product.sku}</span> · {product.category?.name ?? 'Sin categoría'} ·{' '}
            {product.unit?.name}
          </p>
        </div>
        {can('products.manage') && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            Editar
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Stock total" value={formatQty(product.stock?.quantity, product.unit?.code)} />
        <Stat label="Stock mínimo" value={formatQty(product.min_stock, product.unit?.code)} />
        <Stat label="Valorizado" value={formatCurrency(Number(product.stock?.value ?? 0))} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams((p) => (p.set('tab', v), p), { replace: true })}>
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="stock">Stock por almacén</TabsTrigger>
          <TabsTrigger value="kardex">Kardex</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-4">
          <ProductInfo product={product} />
        </TabsContent>
        <TabsContent value="stock" className="mt-4">
          <StockByWarehouse
            productId={product.id}
            unit={product.unit?.code}
            onKardex={() => setParams({ tab: 'kardex' })}
          />
        </TabsContent>
        <TabsContent value="kardex" className="mt-4">
          <KardexView product={product} />
        </TabsContent>
      </Tabs>

      <ProductFormSheet open={editing} onOpenChange={setEditing} product={product} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num text-xl font-semibold">{value}</p>
    </Card>
  )
}

function ProductInfo({ product }: { product: Product }) {
  const rows: [string, string][] = [
    ['Código (SKU)', product.sku],
    ['Código de barras', product.barcode ?? '—'],
    ['Categoría', product.category?.name ?? '—'],
    [
      'Unidad',
      `${product.unit?.name} (${product.unit?.code})${product.unit?.allows_decimals ? ' · fraccionable' : ''}`,
    ],
    ['Stock mínimo', formatQty(product.min_stock, product.unit?.code)],
    ['Estado', product.is_active ? 'Activo' : 'Inactivo'],
  ]
  return (
    <Card>
      <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">{value}</p>
          </div>
        ))}
        <div className="space-y-0.5 sm:col-span-2">
          <p className="text-xs text-muted-foreground">Descripción</p>
          <p className="text-sm">{product.description || 'Sin descripción.'}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function StockByWarehouse({
  productId,
  unit,
  onKardex,
}: {
  productId: number
  unit?: string
  onKardex: () => void
}) {
  const { data, isPending } = useProductStock(productId)
  const totalQty = data?.reduce((s, r) => s + Number(r.quantity), 0) ?? 0
  const totalValue = data?.reduce((s, r) => s + Number(r.total_value), 0) ?? 0

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Existencias por almacén</CardTitle>
        <CardDescription>El costo promedio es independiente en cada almacén.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Almacén</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Costo promedio</TableHead>
              <TableHead className="pr-6 text-right">Valorizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending
              ? Array.from({ length: 3 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4} className="px-6">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : data?.map((row) => (
                  <TableRow key={row.warehouse.id}>
                    <TableCell className="pl-6">
                      <span className="flex items-center gap-2">
                        <WarehouseIcon className="size-4 text-muted-foreground" />
                        {row.warehouse.name}
                      </span>
                    </TableCell>
                    <TableCell className="num text-right font-medium">
                      {formatQty(row.quantity, unit)}
                    </TableCell>
                    <TableCell className="num text-right">{formatCost(row.avg_cost)}</TableCell>
                    <TableCell className="num pr-6 text-right">
                      {formatCurrency(Number(row.total_value))}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
          {data && (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="pl-6 font-medium">Total</TableCell>
                <TableCell className="num text-right font-semibold">{formatQty(totalQty, unit)}</TableCell>
                <TableCell />
                <TableCell className="num pr-6 text-right font-semibold">
                  {formatCurrency(totalValue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
        <div className="px-6 pt-3">
          <Button variant="link" size="sm" className="px-0" onClick={onKardex}>
            Ver kardex →
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
