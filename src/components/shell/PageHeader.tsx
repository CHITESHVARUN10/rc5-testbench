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
 * The category names what kind of page this is — reference, measurement, estimation, record — which is
 * how the tool actually differs from section to section.
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
    <header className="space-y-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <div className="min-w-0 space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-label text-signal-ink">{index}</span>
            <span className="h-px w-8 bg-rule-2" aria-hidden="true" />
            <Label>{category}</Label>
          </div>
          <h1 className="text-2xl font-medium text-ink">{title}</h1>
          <p className="max-w-[68ch] text-read text-ink-2">{lead}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-start gap-2">{actions}</div> : null}
      </div>
      {specs && specs.length > 0 ? <SpecStrip items={specs} label={specsLabel} /> : null}
      {aside}
    </header>
  )
}
