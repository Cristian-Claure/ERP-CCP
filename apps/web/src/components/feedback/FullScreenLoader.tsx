import { Logo } from '@/components/brand/Logo'

export function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background" role="status">
      <div className="flex flex-col items-center gap-4">
        <Logo className="size-12 animate-pulse" />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-[loader_1.1s_ease-in-out_infinite] rounded-full bg-linear-to-r from-brand to-brand-accent" />
        </div>
        <span className="sr-only">Cargando…</span>
      </div>
      <style>{`@keyframes loader{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  )
}
