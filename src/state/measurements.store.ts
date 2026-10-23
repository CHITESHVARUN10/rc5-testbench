import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Measurement } from '@/lib/measurement'
import { measurementKey } from '@/lib/measurement'

/**
 * Measured configurations, kept in this browser.
 *
 * A comparison is only meaningful between things measured the same way, so measuring the same
 * configuration and message size twice replaces the earlier row rather than adding a duplicate.
 * Nothing here is a secret: no key, no plaintext, no round keys.
 */

const MAX_MEASUREMENTS = 12

export interface SaveOutcome {
  readonly ok: boolean
  readonly message: string
}

interface MeasurementsState {
  readonly measurements: readonly Measurement[]
  add: (measurement: Measurement) => SaveOutcome
  remove: (id: string) => void
  clear: () => void
}

export const useMeasurements = create<MeasurementsState>()(
  persist(
    (set, get) => ({
      measurements: [],
      add: (measurement) => {
        const key = measurementKey(measurement.config, measurement.payloadBytes)
        const existing = get().measurements
        const filtered = existing.filter(
          (row) => measurementKey(row.config, row.payloadBytes) !== key,
        )
        const replaced = filtered.length !== existing.length
        const trimmed = filtered.slice(0, MAX_MEASUREMENTS - 1)
        const dropped = filtered.length > MAX_MEASUREMENTS - 1
        set({ measurements: [measurement, ...trimmed] })

        const label = `RC5-${measurement.config.w}/${measurement.config.r}/${measurement.config.b}`
        if (replaced) return { ok: true, message: `Replaced the earlier measurement of ${label}.` }
        if (dropped) {
          return {
            ok: true,
            message: `Added ${label}. The oldest measurement was dropped to keep the comparison readable.`,
          }
        }
        return { ok: true, message: `Added ${label} to the comparison.` }
      },
      remove: (id) =>
        set((state) => ({ measurements: state.measurements.filter((row) => row.id !== id) })),
      clear: () => set({ measurements: [] }),
    }),
    {
      name: 'rc5cipherlab.v1.measurements',
      version: 1,
    },
  ),
)
