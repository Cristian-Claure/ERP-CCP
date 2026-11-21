import { BrainCircuit, Boxes, ChartLine, ShieldCheck, TrendingUp } from 'lucide-react'

import { Logo } from '@/components/brand/Logo'

const FEATURES = [
  { icon: Boxes, text: 'Inventario en tiempo real con kardex por movimiento' },
  { icon: ChartLine, text: 'Ventas, compras y finanzas en un solo lugar' },
  { icon: BrainCircuit, text: 'IA que anticipa la demanda de tus productos' },
  { icon: ShieldCheck, text: 'Roles, permisos y auditoría de cada acción' },
]

/** Right-hand marketing panel of the login screen (always dark, brand gradient + animated grid). */
export function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#070B18] text-white lg:flex lg:flex-col">
      {/* Glows */}
      <div
        aria-hidden
        className="absolute -top-1/4 -left-1/4 size-[70%] animate-glow rounded-full bg-[#6366F1]/35 blur-[120px]"
      />
      <div
        aria-hidden
        className="absolute -right-1/4 -bottom-1/4 size-[65%] animate-glow rounded-full bg-[#22D3EE]/25 blur-[120px] [animation-delay:-5s]"
      />
      {/* Animated grid, faded at the edges */}
      <div
        aria-hidden
        className="bg-grid absolute inset-0 animate-grid-pan [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent)] opacity-70"
      />

      <div className="relative z-10 flex flex-1 flex-col justify-between p-12 xl:p-16">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <span className="size-1.5 rounded-full bg-[#22D3EE] shadow-[0_0_10px_#22D3EE]" />
          Control Central de Procesos
        </div>

        <div className="max-w-lg space-y-10">
          <div className="relative w-fit">
            <div aria-hidden className="absolute inset-0 scale-150 rounded-full bg-[#6366F1]/40 blur-3xl" />
            <Logo className="relative size-20 animate-float drop-shadow-[0_10px_40px_rgba(34,211,238,0.35)]" />
          </div>
          <div className="space-y-4">
            <h2 className="text-5xl leading-[1.05] font-bold tracking-tight xl:text-6xl">
              Tu empresa,
              <br />
              <span className="bg-linear-to-r from-[#818CF8] to-[#22D3EE] bg-clip-text text-transparent">
                bajo control.
              </span>
            </h2>
            <p className="max-w-md text-base leading-relaxed text-white/60">
              El ERP que conecta inventario, ventas, compras y finanzas — con inteligencia que te ayuda a
              decidir antes.
            </p>
          </div>
          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/75">
                <span className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 backdrop-blur">
                  <Icon className="size-4 text-[#22D3EE]" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-end justify-between gap-6">
          <p className="text-xs text-white/40">© {new Date().getFullYear()} CCP · Hecho en Bolivia</p>
          <div className="w-60 animate-float rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl [animation-delay:-3s]">
            <div className="flex items-center justify-between text-xs text-white/50">
              Ventas del mes
              <TrendingUp className="size-3.5 text-emerald-400" />
            </div>
            <div className="num mt-1.5 text-xl font-semibold">Bs 248.930,50</div>
            <div className="mt-3 flex h-8 items-end gap-1">
              {[40, 55, 35, 62, 48, 70, 58, 82, 66, 90].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm bg-linear-to-t from-[#6366F1]/60 to-[#22D3EE]/80"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
