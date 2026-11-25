import { useEffect, useRef } from 'react'

export interface PosShortcutHandlers {
  search: () => void
  customer: () => void
  checkout: () => void
  increment: () => void
  decrement: () => void
  remove: () => void
  cancel: () => void
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * F2 search · F3 customer · F4 checkout · +/− quantity of the selected line ·
 * Supr remove line · Esc cancel. +/−/Supr only act when not typing in a field.
 * Disabled while a dialog owns the keyboard (checkout, authorization…).
 */
export function usePosShortcuts(handlers: PosShortcutHandlers, enabled = true) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      const h = ref.current
      const typing = isTyping(e.target)
      const map: Record<string, (() => void) | undefined> = {
        F2: h.search,
        F3: h.customer,
        F4: h.checkout,
        Escape: h.cancel,
        '+': typing ? undefined : h.increment,
        '-': typing ? undefined : h.decrement,
        Delete: typing ? undefined : h.remove,
      }
      const action = map[e.key]
      if (!action) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
