import { useSettings, type MotionPreference } from '@/state/settings.store'
import { cn } from '@/lib/cn'

/**
 * Motion preference.
 *
 * Three states rather than an on/off switch, because "reduced" and "none" are different requests: one
 * shortens transitions, the other removes them. Long or expressive transitions are not offered,
 * because nothing in this interface animates for its own sake. The setting is applied as a data
 * attribute on the document element and read by CSS, so it also governs animations that no component
 * controls.
 */

const MOTION_OPTIONS: ReadonlyArray<{ value: MotionPreference; label: string; hint: string }> = [
  { value: 'standard', label: 'Full', hint: 'Short functional transitions, 150 to 280 ms.' },
  { value: 'reduced', label: 'Reduced', hint: 'The same transitions, shortened to 100 ms.' },
  { value: 'none', label: 'None', hint: 'No transitions or animation anywhere.' },
]

export function MotionControl({ className }: { className?: string }) {
  const motion = useSettings((state) => state.motion)
  const setMotion = useSettings((state) => state.setMotion)

  return (
    <fieldset className={cn('space-y-2', className)}>
      <legend className="mb-1.5 font-mono text-label uppercase text-ink-4">Motion</legend>
      <div className="flex rounded-hair border border-rule-2 bg-sheet">
        {MOTION_OPTIONS.map((option, index) => (
          <div key={option.value} className={cn('flex-1', index > 0 && 'border-l border-rule-2')}>
            <label className="flex min-h-9 cursor-pointer items-center justify-center px-2 py-1.5">
              <input
                type="radio"
                name="motion-preference"
                value={option.value}
                checked={motion === option.value}
                onChange={() => setMotion(option.value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'pointer-events-none font-mono text-label uppercase',
                  motion === option.value ? 'text-ink' : 'text-ink-3',
                )}
              >
                {option.label}
              </span>
            </label>
          </div>
        ))}
      </div>
      <p className="text-label leading-snug text-ink-4">
        {MOTION_OPTIONS.find((option) => option.value === motion)?.hint}
      </p>
    </fieldset>
  )
}
