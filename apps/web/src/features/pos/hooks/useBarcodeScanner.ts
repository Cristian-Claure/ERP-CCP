import { useEffect, useRef } from 'react'

import { createScannerDetector } from '../lib/scanner'

/**
 * Listens to the whole window (capture phase) for barcode-reader bursts, even
 * while the search box has focus. A detected scan is swallowed (its Enter
 * does not submit anything) and reported through `onScan`.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const callback = useRef(onScan)
  useEffect(() => {
    callback.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!enabled) return
    const detector = createScannerDetector()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return detector.reset()
      const code = detector.feed(e.key, e.timeStamp)
      if (code) {
        e.preventDefault()
        e.stopPropagation()
        callback.current(code)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [enabled])
}
