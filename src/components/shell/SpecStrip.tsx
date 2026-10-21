import { cn } from '@/lib/cn'

/**
 * The spec strip.
 *
 * Every page carries the same readout of the parameters currently in force: word size, rounds, key
 * length, block size. It is the interface's signature and its discipline — a benchmark result or a
 * ciphertext is only meaningful next to the configuration that produced it, so the configuration is
 * always on screen rather than buried in a form.
 */

export interface SpecItem {
  readonly label: string
  readonly value: string
  readonly tone?: 'default' | 'signal' | 'muted'
}

export function SpecStrip({
  items,
  className,
  label = 'Current configuration',
}: {
  items: readonly SpecItem[]
  className?: string
  label?: string
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <dl
        aria-label={label}
        className="flex min-w-max divide-x divide-rule rounded-hair border border-rule bg-sheet"
      >
        {items.map((item) => (
          <div key={item.label} className="flex min-w-[86px] flex-1 flex-col gap-1.5 px-3 py-2.5">
            <dt className="font-mono text-label uppercase text-ink-3">{item.label}</dt>
            <dd
              className={cn(
                'font-mono text-sm tabular-nums',
                item.tone === 'signal'
                  ? 'text-signal-ink'
                  : item.tone === 'muted'
                    ? 'text-ink-3'
                    : 'text-ink',
              )}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
