import { Mail, MapPin, Phone } from 'lucide-react'
import { LeafletMap } from '@/components/map/LeafletMap'
import { pinIcon } from '@/components/map/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import L from 'leaflet'

import type { Customer } from '../../types'

export function InfoTab({ customer }: { customer: Customer }) {
  const hasLocation = customer.latitude !== null && customer.longitude !== null
  const rows: [string, React.ReactNode][] = [
    ['Documento', customer.document_label],
    [
      'Correo',
      customer.email ? (
        <a className="hover:underline" href={`mailto:${customer.email}`}>
          <Mail className="mr-1 inline size-3.5" />
          {customer.email}
        </a>
      ) : (
        '—'
      ),
    ],
    [
      'Teléfono',
      customer.phone ? (
        <span className="num">
          <Phone className="mr-1 inline size-3.5" />
          {customer.phone}
        </span>
      ) : (
        '—'
      ),
    ],
    ['Dirección', customer.address ?? '—'],
    ['Ciudad', [customer.city, customer.department, customer.country].filter(Boolean).join(', ') || '—'],
    ['Segmento', customer.segment_label],
    ['Condición', customer.payment_terms === 'credit' ? `Crédito a ${customer.credit_days} días` : 'Contado'],
    ...(customer.payment_terms === 'credit'
      ? ([['Límite de crédito', formatCurrency(Number(customer.credit_limit))]] as [string, string][])
      : []),
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium break-words">{value}</p>
            </div>
          ))}
          {customer.notes && (
            <div className="space-y-0.5 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Notas</p>
              <p className="text-sm">{customer.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-brand-accent" /> Ubicación
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasLocation ? (
            <LeafletMap
              center={[Number(customer.latitude), Number(customer.longitude)]}
              zoom={15}
              className="h-72 w-full"
              onReady={(map) => {
                L.marker([Number(customer.latitude), Number(customer.longitude)], { icon: pinIcon() })
                  .addTo(map)
                  .bindTooltip(customer.name)
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin ubicación registrada. Edita el cliente para fijarla en el mapa.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
