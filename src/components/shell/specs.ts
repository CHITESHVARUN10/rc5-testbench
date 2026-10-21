import { blockSizeBytes } from '@/lib/rc5/constants'
import { useSettings } from '@/state/settings.store'
import type { SpecItem } from './SpecStrip'

/**
 * The configuration readout shared by every page.
 *
 * One hook, so that the same strip appears everywhere with the same labels and the same units. A page
 * never builds its own: a result shown under a differently-worded specification is how a measurement
 * ends up being misread.
 */
export function useSpecItems(extra: readonly SpecItem[] = []): SpecItem[] {
  const config = useSettings((state) => state.config)
  return [
    { label: 'w', value: `${config.w} bit` },
    { label: 'r', value: String(config.r) },
    { label: 'b', value: `${config.b} B` },
    { label: 'block', value: `${blockSizeBytes(config.w)} B` },
    ...extra,
  ]
}
