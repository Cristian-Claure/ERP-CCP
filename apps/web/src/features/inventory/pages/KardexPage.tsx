import { History } from 'lucide-react'
import { useSearchParams } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'

import { KardexView } from '../components/KardexView'
import { ProductCombobox } from '../components/ProductCombobox'
import { useProduct } from '../hooks'

export function KardexPage() {
  const [params, setParams] = useSearchParams()
  const productId = Number(params.get('producto')) || undefined
  const { data: product } = useProduct(productId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kardex"
        description="Movimientos valorizados por producto y almacén, con saldo y costo promedio en cada línea."
      />

      <Card className="flex-row flex-wrap items-center gap-3 p-4">
        <span className="text-sm text-muted-foreground">Producto</span>
        <div className="w-full sm:w-[420px]">
          <ProductCombobox
            value={productId ?? null}
            selectedLabel={product ? `${product.sku} · ${product.name}` : undefined}
            onChange={(p) => setParams({ producto: String(p.id) })}
          />
        </div>
      </Card>

      {product ? (
        <KardexView key={product.id} product={product} />
      ) : (
        <EmptyState
          icon={History}
          title="Selecciona un producto"
          description="Busca por código, nombre o código de barras para ver su kardex."
        />
      )}
    </div>
  )
}
