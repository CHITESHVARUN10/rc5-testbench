import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { Label, Meta } from './Text'

/**
 * Surfaces.
 *
 * The interface has three surfaces — paper (the canvas), sheet (a raised document), and well (a
 * recessed readout) — and they separate by lightness and hairlines. There are no floating cards:
 * related sections share one border and are divided by rules, the way a datasheet or a form is
 * divided, because a stack of separate boxes signals that no layout decision was made.
 */

export function Rule({ className }: { className?: string }) {
  return <hr className={cn('border-t border-rule', className)} />
}

/** One bordered document. Use Stack and StackRow for sections inside it. */
export function Panel({
  children,
  className,
  tone = 'sheet',
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  tone?: 'sheet' | 'well' | 'paper'
  as?: 'section' | 'div' | 'aside' | 'article'
}) {
  const tones = {
    sheet: 'bg-sheet',
    well: 'bg-well',
    paper: 'bg-paper',
  } as const
  return <Tag className={cn('rounded-hair border border-rule', tones[tone], className)}>{children}</Tag>
}

/** A bordered document whose sections are separated by rules rather than gaps. */
export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('divide-y divide-rule rounded-hair border border-rule bg-sheet', className)}>
      {children}
    </div>
  )
}

export function StackRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-4 sm:p-5', className)}>{children}</div>
}

export function StackHead({
  index,
  title,
  note,
  actions,
  className,
}: {
  index?: string
  title: ReactNode
  note?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-rule px-4 py-3 sm:px-5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        {index ? <Meta className="text-ink-4">{index}</Meta> : null}
        <h2 className="text-lg font-medium text-ink">{title}</h2>
        {note ? <span className="text-sm text-ink-3">{note}</span> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/**
 * The journal section header: an index, a heading, and a rule that runs to the edge of the measure.
 * This is the shape that gives the pages their document character rather than a dashboard one.
 */
export function SectionHead({
  index,
  title,
  note,
  actions,
  level = 2,
  className,
}: {
  index?: string
  title: ReactNode
  note?: ReactNode
  actions?: ReactNode
  level?: 2 | 3
  className?: string
}) {
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {index ? <Meta className="shrink-0 text-ink-4">{index}</Meta> : null}
      <Heading
        className={cn(
          'shrink-0 font-medium text-ink',
          level === 3 ? 'text-base' : 'text-xl',
        )}
      >
        {title}
      </Heading>
      <span className="h-px min-w-4 flex-1 bg-rule" aria-hidden="true" />
      {note ? <span className="shrink-0 text-sm text-ink-3">{note}</span> : null}
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** A recessed area for machine output: hex, round keys, logs. */
export function Well({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-hair border border-rule bg-well', className)}>{children}</div>
  )
}

/** Key and value on one line, for dense metadata. */
export function MetaList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]', className)}>{children}</dl>
}

export function MetaListItem({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt className="sm:pt-px">
        <Label>{term}</Label>
      </dt>
      <dd className="font-mono text-sm tabular-nums text-ink">{children}</dd>
    </>
  )
}

/** A value that has not been established yet. Used instead of showing a zero or an em dash alone. */
export function NotMeasured({ children = 'Not measured' }: { children?: ReactNode }) {
  return <span className="font-mono text-label uppercase text-ink-4">{children}</span>
}
