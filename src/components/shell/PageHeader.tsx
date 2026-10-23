import type { ReactNode } from 'react'

import { SpecStrip, type SpecItem } from './SpecStrip'
import { Label } from '../ui/Text'

/**
 * Page header.
 *
 * Left-aligned and asymmetric on purpose: an index, a category, a title, one sentence of framing,
 * actions on the right where a reader's eye expects the next step, and the configuration strip
 * underneath. No centred stack, no display type carrying a marketing claim, and nothing here could be
 * lifted onto a different product unchanged.
 *
 * The title is the one place the type scale opens up. Everything under it returns to working size, so
 * the page has a single point of arrival instead of a row of competing headings.
 */

export interface PageHeaderProps {
  readonly index: string
  readonly category: string
  readonly title: string
  readonly lead: ReactNode
  readonly actions?: ReactNode
  readonly specs?: readonly SpecItem[]
  readonly specsLabel?: string
  readonly aside?: ReactNode
}

export function PageHeader({
  index,
  category,
  title,
  lead,
  actions,
  specs,
  specsLabel,
  aside,
}: PageHeaderProps) {
  return (
    <header className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
        <div className="min-w-0 max-w-[62ch] space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-label tabular-nums text-signal-ink">{index}</span>
            <span className="h-px w-10 bg-rule-2" aria-hidden="true" />
            <Label>{category}</Label>
          </div>
          <h1 className="text-2xl font-semibold text-balance text-ink sm:text-display">{title}</h1>
          <p className="max-w-[64ch] text-read text-ink-2">{lead}</p>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-start gap-2 lg:pt-1">{actions}</div>
        ) : null}
      </div>
      {specs && specs.length > 0 ? <SpecStrip items={specs} label={specsLabel} /> : null}
      {aside}
    </header>
  )
}
