import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { Glyph, type GlyphName } from './Glyph'
import { Label } from './Text'

/**
 * Notices, progress, and the empty and error states.
 *
 * Notices are bordered blocks with a glyph and a word. They deliberately do not use a coloured stripe
 * down one side: a stripe is decoration standing in for structure, and it says nothing a glyph and a
 * sentence cannot say better.
 */

export type NoticeTone = 'note' | 'info' | 'caution' | 'warning'

const NOTICE_TONES: Record<NoticeTone, { box: string; mark: string; glyph: GlyphName; word: string }> = {
  note: { box: 'border-rule bg-sheet', mark: 'text-ink-3', glyph: 'info', word: 'Note' },
  info: { box: 'border-rule bg-well', mark: 'text-ink-2', glyph: 'info', word: 'Note' },
  caution: { box: 'border-warn/45 bg-warn-wash', mark: 'text-warn', glyph: 'warn', word: 'Caution' },
  warning: { box: 'border-err/45 bg-err-wash', mark: 'text-err', glyph: 'warn', word: 'Warning' },
}

export function Notice({
  tone = 'note',
  title,
  children,
  actions,
  className,
}: {
  tone?: NoticeTone
  title?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const config = NOTICE_TONES[tone]
  return (
    <div className={cn('rounded-hair border p-3.5 sm:p-4', config.box, className)}>
      <div className="flex gap-3">
        <Glyph name={config.glyph} size={16} className={cn('mt-0.5', config.mark)} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className={cn('font-mono text-label uppercase', config.mark)}>{title ?? config.word}</p>
          {children ? <div className="max-w-[76ch] text-sm text-ink-2">{children}</div> : null}
          {actions ? <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div> : null}
        </div>
      </div>
    </div>
  )
}

/** Determinate or indeterminate progress. The phase is announced separately by the page. */
export function ProgressBar({
  value,
  max = 100,
  indeterminate = false,
  label,
  className,
}: {
  value?: number
  max?: number
  indeterminate?: boolean
  label: string
  className?: string
}) {
  const percent = indeterminate || max <= 0 ? 0 : Math.min(100, Math.max(0, (value ?? 0) / max * 100))

  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-hair bg-well', className)}
      role="progressbar"
      aria-label={label}
      {...(indeterminate
        ? { 'aria-valuetext': 'in progress' }
        : { 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(percent) })}
    >
      {indeterminate ? (
        <div className="h-full w-1/4 animate-sweep bg-signal-ink" />
      ) : (
        <div
          className="h-full bg-signal-ink transition-[width] duration-200 ease-instrument"
          style={{ width: `${percent}%` }}
        />
      )}
    </div>
  )
}

export function EmptyState({
  label,
  title,
  children,
  action,
  className,
}: {
  label: ReactNode
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-hair border border-rule bg-well px-4 py-8 text-center sm:px-6 sm:py-10',
        className,
      )}
    >
      <div className="mx-auto max-w-[54ch] space-y-3">
        <Label>{label}</Label>
        <p className="text-lg font-medium text-ink">{title}</p>
        {children ? <p className="text-sm text-ink-2">{children}</p> : null}
        {action ? <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{action}</div> : null}
      </div>
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  children,
  action,
  className,
}: {
  title?: ReactNode
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-hair border border-err/45 bg-err-wash p-4 sm:p-5', className)} role="alert">
      <div className="flex gap-3">
        <Glyph name="warn" size={16} className="mt-0.5 shrink-0 text-err" />
        <div className="min-w-0 space-y-2">
          <p className="text-base font-medium text-ink">{title}</p>
          <div className="max-w-[76ch] text-sm text-ink-2">{children}</div>
          {action ? <div className="flex flex-wrap items-center gap-2 pt-1">{action}</div> : null}
        </div>
      </div>
    </div>
  )
}

/** A single inline error for a failed action, sized for a form footer or a result panel. */
export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 text-sm text-err">
      <Glyph name="cross" size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** Announced to assistive technology without being visible. Used for run phases and confirmations. */
export function LiveRegion({ children }: { children: ReactNode }) {
  return (
    <p aria-live="polite" className="sr-only">
      {children}
    </p>
  )
}
