import { create } from 'zustand'

import type { AtlasMode, AtlasPeriod, FlyTarget } from './types'

/** UI state of CCP Atlas (server data lives in TanStack Query). */
interface AtlasState {
  period: AtlasPeriod
  segments: string[]
  status: string | null
  mode: AtlasMode
  showArcs: boolean
  /** Optional supplier layer (markers + inbound arcs supplier -> warehouse). */
  showSuppliers: boolean
  showBorders: boolean
  showClouds: boolean
  /** Hours added to "now" for the sun position (time control). */
  timeOffsetHours: number
  selectedId: number | null
  flyTarget: FlyTarget | null
  touring: boolean
  /** Camera distance from the globe center (drives clustering and LOD). */
  cameraDistance: number
  /** Last pointer interaction (pauses auto-rotation). */
  lastInteraction: number
  /** 0..1 real texture loading progress (LoadingManager). */
  loadProgress: number
  /** Pointer over columns/hexbins: screen position and the customers under it. */
  hover: { x: number; y: number; customerIds: number[] } | null
  /** Country under the pointer (borders layer). */
  hoverCountry: string | null
  /** ?perf=1 metrics, updated once per second. */
  perf: { fps: number; calls: number; triangles: number } | null

  set: (patch: Partial<AtlasState>) => void
  toggleSegment: (segment: string) => void
  select: (id: number | null, fly?: FlyTarget) => void
  interact: () => void
}

export const useAtlasStore = create<AtlasState>((set) => ({
  period: '90d',
  segments: [],
  status: null,
  mode: 'columns',
  showArcs: true,
  showSuppliers: false,
  showBorders: true,
  showClouds: true,
  timeOffsetHours: 0,
  selectedId: null,
  flyTarget: null,
  touring: false,
  cameraDistance: 3,
  lastInteraction: 0,
  loadProgress: 0,
  hover: null,
  hoverCountry: null,
  perf: null,

  set: (patch) => set(patch),
  toggleSegment: (segment) =>
    set((s) => ({
      segments: s.segments.includes(segment)
        ? s.segments.filter((x) => x !== segment)
        : [...s.segments, segment],
    })),
  select: (id, fly) => set({ selectedId: id, flyTarget: fly ?? null, touring: false }),
  interact: () => set({ lastInteraction: performance.now() }),
}))
