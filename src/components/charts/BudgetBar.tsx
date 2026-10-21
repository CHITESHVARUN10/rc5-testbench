import { useId } from 'react'

import { cn } from '@/lib/cn'
import { formatMilliseconds } from '@/lib/format'
import { ChartPatterns, useMeasuredWidth, type SeriesPattern } from './primitives'
import { linearScale } from './Scale'

/**
 * The timing budget bar.
 *
 * The one chart in this tool whose whole job is to keep two kinds of number apart. Segments that were
 * measured are filled solid; segments that came from an assumption or a calculation are hatched. The
 * budget itself is a marked rule, not a background colour, so being over or under it is a distance you
 * can see rather than a mood the page sets.
 */

export type BudgetProvenance = 'measured' | 'estimated' | 'assumed'

export interface BudgetSegment {
  readonly id: string
  readonly label: string
  readonly valueNs: number
  readonly provenance: BudgetProvenance
}

export interface BudgetBarProps {
  readonly segments: readonly BudgetSegment[]
  readonly budgetNs: number
  readonly ariaLabel: string
  readonly className?: string
  readonly height?: number
}

const PATTERNS: Record<BudgetProvenance, SeriesPattern> = {
  measured: 'solid',
  estimated: 'hatch',
  assumed: 'dots',
}

const COLORS: Record<BudgetProvenance, string> = {
  measured: 'var(--color-series-1)',
  estimated: 'var(--color-series-2)',
  assumed: 'var(--color-series-3)',
}

export const PROVENANCE_WORDS: Record<BudgetProvenance, string> = {
  measured: 'Measured',
  estimated: 'Estimated',
  assumed: 'User-entered',
}

export function BudgetBar({
  segments,
  budgetNs,
  ariaLabel,
  className,
  height = 96,
}: BudgetBarProps) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>()
  const namespace = useId().replace(/:/g, '')

  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.valueNs), 0)
  const overBy = total - budgetNs
  const axisMax = Math.max(total, budgetNs, 1) * 1.04
  const barHeight = 30
  const barTop = 30
  const scale = linearScale([0, axisMax], [0, Math.max(80, width)])

  const usedProvenance = Array.from(new Set(segments.map((segment) => segment.provenance)))

  return (
    <div ref={ref} className={cn('w-full', className)}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <ChartPatterns namespace={namespace} />

          {/* the budget rule, drawn under the bar so segments read on top of it */}
          <line
            x1={scale.at(budgetNs)}
            y1={barTop - 16}
            x2={scale.at(budgetNs)}
            y2={barTop + barHeight + 8}
            stroke="var(--color-err)"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          <text
            x={scale.at(budgetNs)}
            y={barTop - 22}
            textAnchor={scale.at(budgetNs) > width - 80 ? 'end' : 'middle'}
            className="font-mono"
            fontSize="10"
            fill="var(--color-err)"
            letterSpacing="0.08em"
          >
            {`BUDGET ${formatMilliseconds(budgetNs / 1e6)}`}
          </text>

          {/* stacked segments */}
          {segments.map((segment) => {
            const start = segments
              .slice(0, segments.indexOf(segment))
              .reduce((sum, previous) => sum + Math.max(0, previous.valueNs), 0)
            const x = scale.at(start)
            const segmentWidth = Math.max(0, scale.at(start + Math.max(0, segment.valueNs)) - x)
            if (segmentWidth <= 0) return null
            const color = COLORS[segment.provenance]
            return (
              <rect
                key={segment.id}
                x={x}
                y={barTop}
                width={segmentWidth}
                height={barHeight}
                fill={
                  segment.provenance === 'measured'
                    ? color
                    : `url(#${namespace}-${PATTERNS[segment.provenance]})`
                }
                style={segment.provenance === 'measured' ? undefined : { color }}
                stroke={color}
                strokeWidth="1"
              >
                <title>{`${segment.label}: ${formatMilliseconds(segment.valueNs / 1e6)} · ${PROVENANCE_WORDS[segment.provenance]}`}</title>
              </rect>
            )
          })}

          {/* the over-budget portion is called out rather than allowed to run off the axis */}
          {overBy > 0 ? (
            <>
              <line
                x1={scale.at(budgetNs)}
                y1={barTop + barHeight + 14}
                x2={scale.at(total)}
                y2={barTop + barHeight + 14}
                stroke="var(--color-err)"
                strokeWidth="1.5"
              />
              <text
                x={scale.at(total)}
                y={barTop + barHeight + 28}
                textAnchor="end"
                className="font-mono"
                fontSize="10"
                fill="var(--color-err)"
              >
                {`OVER BY ${formatMilliseconds(overBy / 1e6)}`}
              </text>
            </>
          ) : (
            <text
              x={0}
              y={barTop + barHeight + 24}
              className="font-mono"
              fontSize="10"
              fill="var(--color-ok)"
            >
              {`${formatMilliseconds(Math.abs(overBy) / 1e6)} INSIDE THE BUDGET`}
            </text>
          )}

          {/* zero mark */}
          <line x1={0} y1={barTop} x2={0} y2={barTop + barHeight} stroke="var(--color-rule-3)" strokeWidth="1" />
        </svg>
      ) : (
        <div style={{ height }} />
      )}

      <BudgetLegend provenance={usedProvenance} />
    </div>
  )
}

function BudgetLegend({ provenance }: { provenance: readonly BudgetProvenance[] }) {
  const namespace = useId().replace(/:/g, '')
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <svg width="0" height="0" aria-hidden="true">
        <ChartPatterns namespace={namespace} />
      </svg>
      {provenance.map((kind) => (
        <span key={kind} className="flex items-center gap-2">
          <svg width="14" height="14" aria-hidden="true">
            <rect
              x="1"
              y="1"
              width="12"
              height="12"
              fill={kind === 'measured' ? COLORS[kind] : `url(#${namespace}-${PATTERNS[kind]})`}
              style={kind === 'measured' ? undefined : { color: COLORS[kind] }}
              stroke={COLORS[kind]}
              strokeWidth="1"
            />
          </svg>
          <span className="font-mono text-label text-ink-2 uppercase">{PROVENANCE_WORDS[kind]}</span>
        </span>
      ))}
      <span className="flex items-center gap-2">
        <svg width="14" height="14" aria-hidden="true">
          <line x1="1" y1="7" x2="13" y2="7" stroke="var(--color-err)" strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
        <span className="font-mono text-label text-ink-2 uppercase">Budget</span>
      </span>
    </div>
  )
}
