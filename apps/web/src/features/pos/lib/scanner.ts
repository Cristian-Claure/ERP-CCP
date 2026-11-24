/**
 * Barcode readers behave as keyboards: they "type" the code in a burst of
 * keystrokes a few ms apart and finish with Enter. A human types far slower.
 * The detector keeps the recent printable keys and, on Enter, reports the
 * buffer as a scan when it is long enough and every gap was below the limit.
 */
export interface ScannerOptions {
  /** Max ms between two keystrokes of the same scan (readers: ~5–30 ms). */
  maxInterval?: number
  minLength?: number
}

export interface ScannerDetector {
  /** Feeds a key; returns the scanned code on the Enter that closes a burst, else null. */
  feed: (key: string, at: number) => string | null
  reset: () => void
}

export function createScannerDetector({ maxInterval = 35, minLength = 4 }: ScannerOptions = {}): ScannerDetector {
  let buffer = ''
  let last = -Infinity

  const reset = () => {
    buffer = ''
    last = -Infinity
  }

  return {
    reset,
    feed(key, at) {
      const gap = at - last
      if (key === 'Enter') {
        const code = buffer
        const burst = gap <= maxInterval
        reset()
        return burst && code.length >= minLength ? code : null
      }
      if (key.length !== 1) {
        reset()
        return null
      }
      // A slow keystroke starts a new candidate burst.
      buffer = gap <= maxInterval ? buffer + key : key
      last = at
      return null
    },
  }
}
