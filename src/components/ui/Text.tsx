import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * The typographic vocabulary.
 *
 * The interface is built from two type roles and nothing else:
 *
 *   - Uppercase mono at 11px with 0.08em tracking for every label, unit, table header, status word
 *     and parameter name. This is the instrument-label layer, and it is always the same object.
 *   - Sans for prose, headings, and anything a person reads as a sentence.
 *
 * Numbers are mono and tabular so that a column of results lines up digit for digit. That is the
 * whole reason the label layer is mono: it makes the readouts scannable the way a datasheet is.
 */

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-label uppercase text-ink-3', className)}>{children}</span>
}

export function LabelStrong({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono text-label uppercase font-medium text-ink-2', className)}>
      {children}
    </span>
  )
}

/** A measured or computed value. Always mono and tabular. */
export function Value({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono tabular-nums text-ink', className)}>{children}</span>
  )
}

/** The unit that belongs to a value. Never omitted: a number without its unit is a bug. */
export function Unit({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-label text-ink-3', className)}>{children}</span>
}

/** Supporting explanation under a control or a value. */
export function Hint({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <p id={id} className={cn('text-sm text-ink-3', className)}>
      {children}
    </p>
  )
}

/** Small metadata line: timestamps, ids, versions. */
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-label text-ink-3', className)}>{children}</span>
}

/** Standfirst under a page title. One or two sentences, never a paragraph. */
export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('max-w-[68ch] text-read text-ink-2', className)}>{children}</p>
  )
}

/** Prose block for the Learn page. Measure stays between 60 and 76 characters. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-[68ch] space-y-4 text-read text-ink-2 [&_a]:text-signal-ink [&_a]:underline [&_a]:underline-offset-4',
        '[&_code]:rounded-hair [&_code]:bg-well [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-ink',
        '[&_h3]:pt-2 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-ink',
        '[&_li]:pl-4 [&_li]:relative',
        '[&_ol]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_strong]:font-medium [&_strong]:text-ink',
        '[&_ul]:space-y-2 [&_ul]:list-none',
        className,
      )}
    >
      {children}
    </div>
  )
}
