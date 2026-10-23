import { useId } from 'react'

import { ChartPatterns, ChartWithTable, seriesFill, useMeasuredWidth, type SeriesPattern } from './primitives'
import { linearScale, niceExtent, ticks } from './Scale'

/**
 * Grouped bars.
 *
 * Used for categorical comparison — encryption against decryption, or one configuration against
 * another at a fixed workload. Bars are hatched per series so the grouping survives grayscale, and
 * value labels are drawn above each bar whenever there is room for them.
 */

export interface BarCategory {
  readonly key: string
  readonly label: string
  readonly note?: string
  /** Marks the category the chart is drawing attention to. Never a claim about security. */
  readonly accent?: boolean
}

export interface BarSeriesDef {
  readonly id: string
  readonly label: string
  readonly pattern?: SeriesPattern
}

export interface BarGroupProps {
  readonly categories: readonly BarCategory[]
  readonly series: readonly BarSeriesDef[]
  readonly values: Readonly<Record<string, Readonly<Record<string, number>>>>
  readonly formatY: (value: number) => { value: string; unit: string }
  readonly yLabel: string
  readonly ariaLabel: string
  readonly summary: string
  readonly table: React.ReactNode
  readonly className?: string
  readonly height?: number
  readonly tableVisible?: boolean
}

const MARGIN = { top: 30, right: 12, bottom: 48, left: 56 }

export function BarGroup({
  categories,
  series,
  values,
  formatY,
  yLabel,
  ariaLabel,
  summary,
  table,
  className,
  height = 280,
  tableVisible = false,
}: BarGroupProps) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>()
  const namespace = useId().replace(/:/g, '')

  const allValues = series.flatMap((def) =>
    categories.map((category) => values[def.id]?.[category.key] ?? 0),
  )
  const domain = niceExtent(0, Math.max(...allValues, 1), true)
  const tickValues = ticks(domain[0], domain[1], 4)
  const plotWidth = Math.max(80, width - MARGIN.left - MARGIN.right)
  const plotHeight = height - MARGIN.top - MARGIN.bottom
  const yScale = linearScale(domain, [plotHeight, 0])

  const slot = plotWidth / Math.max(1, categories.length)
  const barGroupWidth = Math.min(slot * 0.72, 132)
  const barWidth = Math.max(6, (barGroupWidth - (series.length - 1) * 4) / series.length)
  const showValues = barWidth > 26

  const legend = series.map((def, index) => ({
    label: def.label,
    color: index === 0 ? 'var(--color-series-1)' : 'var(--color-series-2)',
    pattern: def.pattern ?? (index === 0 ? 'solid' : 'hatch'),
  }))

  return (
    <ChartWithTable
      className={className}
      tableVisible={tableVisible}
      label={ariaLabel}
      summary={summary}
      table={table}
      legend={<BarLegend entries={legend} />}
      chart={
        <div ref={ref} className="w-full">
          {width > 0 ? (
            <svg width={width} height={height} role="img" aria-label={ariaLabel}>
              <ChartPatterns namespace={namespace} />
              <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
                {tickValues.map((tick) => (
                  <g key={tick}>
                    <line
                      x1={0}
                      y1={yScale.at(tick)}
                      x2={plotWidth}
                      y2={yScale.at(tick)}
                      stroke="var(--color-rule)"
                      strokeWidth="1"
                    />
                    <text
                      x={-8}
                      y={yScale.at(tick) + 3}
                      textAnchor="end"
                      className="font-mono"
                      fontSize="10"
                      fill="var(--color-ink-3)"
                    >
                      {formatY(tick).value}
                    </text>
                  </g>
                ))}

                {categories.map((category, categoryIndex) => {
                  const center = categoryIndex * slot + slot / 2
                  const groupLeft = center - barGroupWidth / 2

                  return (
                    <g key={category.key}>
                      {series.map((def, seriesIndex) => {
                        const value = values[def.id]?.[category.key] ?? 0
                        const top = yScale.at(value)
                        const barHeight = Math.max(0, plotHeight - top)
                        const isAccent = category.accent === true && seriesIndex === 0
                        const color = isAccent
                          ? 'var(--color-series-4)'
                          : seriesIndex === 0
                            ? 'var(--color-series-1)'
                            : 'var(--color-series-2)'
                        const fill = seriesFill(namespace, def.pattern ?? (seriesIndex === 0 ? 'solid' : 'hatch'), color)

                        return (
                          <g key={def.id}>
                            <rect
                              x={groupLeft + seriesIndex * (barWidth + 4)}
                              y={top}
                              width={barWidth}
                              height={barHeight}
                              fill={fill.fill}
                              style={fill.style}
                              stroke={color}
                              strokeWidth="1"
                            >
                              <title>{`${category.label} · ${def.label}: ${formatY(value).value} ${formatY(value).unit}`}</title>
                            </rect>
                            {showValues && seriesIndex === 0 ? (
                              <text
                                x={groupLeft + seriesIndex * (barWidth + 4) + barWidth / 2}
                                y={top - 6}
                                textAnchor="middle"
                                className="font-mono"
                                fontSize="10"
                                fill="var(--color-ink-2)"
                              >
                                {formatY(value).value}
                              </text>
                            ) : null}
                          </g>
                        )
                      })}
                      <text
                        x={center}
                        y={plotHeight + 16}
                        textAnchor="middle"
                        className="font-mono"
                        fontSize="10"
                        fill={category.accent ? 'var(--color-signal-ink)' : 'var(--color-ink-2)'}
                      >
                        {category.label}
                      </text>
                      {category.note ? (
                        <text
                          x={center}
                          y={plotHeight + 29}
                          textAnchor="middle"
                          className="font-mono"
                          fontSize="9"
                          fill="var(--color-ink-4)"
                        >
                          {category.note}
                        </text>
                      ) : null}
                    </g>
                  )
                })}

                <text
                  x={-MARGIN.left + 4}
                  y={-15}
                  className="font-mono"
                  fontSize="10"
                  fill="var(--color-ink-4)"
                  letterSpacing="0.08em"
                >
                  {`${yLabel.toUpperCase()} · ${
                    formatY(tickValues.length > 0 ? Math.max(...tickValues) : 0).unit
                  }`}
                </text>
              </g>
            </svg>
          ) : (
            <div style={{ height }} />
          )}
        </div>
      }
    />
  )
}

function BarLegend({
  entries,
}: {
  entries: readonly { label: string; color: string; pattern: SeriesPattern }[]
}) {
  const namespace = useId().replace(/:/g, '')
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <svg width="0" height="0" aria-hidden="true">
        <ChartPatterns namespace={namespace} />
      </svg>
      {entries.map((entry) => (
        <span key={entry.label} className="flex items-center gap-2">
          <svg width="14" height="14" aria-hidden="true">
            <rect
              x="1"
              y="1"
              width="12"
              height="12"
              fill={entry.pattern === 'solid' ? entry.color : `url(#${namespace}-${entry.pattern})`}
              style={entry.pattern === 'solid' ? undefined : { color: entry.color }}
              stroke={entry.color}
              strokeWidth="1"
            />
          </svg>
          <span className="font-mono text-label text-ink-2 uppercase">{entry.label}</span>
        </span>
      ))}
    </div>
  )
}
