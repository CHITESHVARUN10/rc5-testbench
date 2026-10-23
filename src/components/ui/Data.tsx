import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { Glyph, type GlyphName } from './Glyph'
import { Hint, Label } from './Text'

/**
 * Data display.
 *
 * A readout is the unit of measurement in this interface: a label, a number in mono with tabular
 * figures, and a separate unit. Numbers are never shown without their unit, and never without the
 * context needed to interpret them, which is what the note line is for.
 */

export interface ReadoutProps {
  readonly label: ReactNode
  readonly value: string
  readonly unit?: string
  readonly note?: ReactNode
  readonly size?: 'md' | 'lg'
  readonly className?: string
  readonly tone?: 'default' | 'muted' | 'signal'
}

export function Readout({ label, value, unit, note, size = 'md', className, tone = 'default' }: ReadoutProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>{label}</Label>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'font-mono tabular-nums',
            size === 'lg' ? 'text-2xl' : 'text-base',
            tone === 'signal' ? 'text-signal-ink' : tone === 'muted' ? 'text-ink-3' : 'text-ink',
          )}
        >
          {value}
        </span>
        {unit ? <span className="font-mono text-label text-ink-3">{unit}</span> : null}
      </div>
      {note ? <Hint className="leading-snug">{note}</Hint> : null}
    </div>
  )
}

/** A grid of readouts divided by hairlines. Edges are drawn by the container. */
export function ReadoutGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 border-t border-l border-rule bg-sheet sm:grid-cols-3 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ReadoutCell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('border-r border-b border-rule p-3 sm:p-4', className)}>{children}</div>
}

export type FlagStatus =
  | 'verified'
  | 'mismatch'
  | 'not-checked'
  | 'running'
  | 'cancelled'
  | 'failed'
  | 'ready'
  | 'idle'
  | 'estimating'
  | 'not-comparable'
  | 'insufficient-data'
  | 'within-budget'
  | 'over-budget'
  | 'review-required'
  | 'measured'
  | 'estimated'
  | 'assumed'

interface FlagDefinition {
  readonly glyph: GlyphName
  readonly tone: string
  readonly label: string
  readonly animate?: boolean
}

/**
 * Status vocabulary. Every status carries a glyph and a word as well as a colour, so it survives
 * grayscale printing and colour blindness, and the words are chosen to be defensible: nothing here
 * claims a configuration is secure.
 */
const FLAGS: Record<FlagStatus, FlagDefinition> = {
  verified: { glyph: 'check', tone: 'text-ok', label: 'Verified' },
  mismatch: { glyph: 'cross', tone: 'text-err', label: 'Mismatch' },
  'not-checked': { glyph: 'dash', tone: 'text-ink-3', label: 'Not checked' },
  running: { glyph: 'dot', tone: 'text-signal-ink', label: 'Running', animate: true },
  cancelled: { glyph: 'stop', tone: 'text-warn', label: 'Cancelled' },
  failed: { glyph: 'warn', tone: 'text-err', label: 'Failed' },
  ready: { glyph: 'dot', tone: 'text-ink-3', label: 'Ready' },
  idle: { glyph: 'dash', tone: 'text-ink-3', label: 'Idle' },
  estimating: { glyph: 'clock', tone: 'text-ink-3', label: 'Estimating' },
  'not-comparable': { glyph: 'warn', tone: 'text-warn', label: 'Not comparable' },
  'insufficient-data': { glyph: 'dash', tone: 'text-ink-3', label: 'Insufficient data' },
  'within-budget': { glyph: 'check', tone: 'text-ok', label: 'Within the entered budget' },
  'over-budget': { glyph: 'warn', tone: 'text-err', label: 'Over the entered budget' },
  'review-required': { glyph: 'warn', tone: 'text-warn', label: 'Security review required' },
  measured: { glyph: 'dot', tone: 'text-ink-2', label: 'Measured' },
  estimated: { glyph: 'dash', tone: 'text-ink-3', label: 'Estimated' },
  assumed: { glyph: 'dash', tone: 'text-ink-3', label: 'User-entered' },
}

export function StatusFlag({ status, className }: { status: FlagStatus; className?: string }) {
  const flag = FLAGS[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-label uppercase', flag.tone, className)}>
      <Glyph name={flag.glyph} size={12} className={flag.animate ? 'animate-blink' : undefined} />
      {flag.label}
    </span>
  )
}

/** Where a number came from. Estranged from provenance, a number is just an assertion. */
export function ProvenanceTag({ status }: { status: 'measured' | 'estimated' | 'assumed' }) {
  return <StatusFlag status={status} />
}

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode
  tone?: 'default' | 'signal' | 'ok' | 'warn' | 'err'
  className?: string
}) {
  const tones = {
    default: 'border-rule-2 text-ink-2',
    signal: 'border-signal-ink text-signal-ink',
    ok: 'border-ok text-ok',
    warn: 'border-warn text-warn',
    err: 'border-err text-err',
  } as const
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-hair border px-1.5 py-0.5 font-mono text-label uppercase',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ table */

export interface Column<T> {
  readonly key: string
  readonly header: ReactNode
  readonly align?: 'left' | 'right'
  readonly render: (row: T) => ReactNode
  readonly className?: string
}

export interface DataTableProps<T> {
  readonly columns: readonly Column<T>[]
  readonly rows: readonly T[]
  readonly getRowKey: (row: T, index: number) => string
  readonly caption: string
  readonly empty?: ReactNode
  readonly stickyHeader?: boolean
  readonly className?: string
}

/**
 * A table, not a grid of cards. Columns keep stable widths and numbers are tabular, so a column of
 * results can be scanned and compared vertically. Row actions are explicit buttons in a cell rather
 * than a clickable row, which keeps the table keyboard-navigable without inventing a role for it.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  empty,
  stickyHeader = false,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-max border-collapse text-sm tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'border-b border-rule-2 bg-sheet px-3 py-2.5 font-mono text-label uppercase text-ink-2',
                  column.align === 'right' ? 'text-right' : 'text-left',
                  stickyHeader && 'sticky top-0 z-10',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={getRowKey(row, index)}
              className="border-b border-rule transition-colors duration-150 ease-instrument last:border-b-0 hover:bg-well/55"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-3 py-2.5 align-baseline',
                    column.align === 'right' ? 'text-right' : 'text-left',
                    column.className,
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
