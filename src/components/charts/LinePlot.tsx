import { useId } from 'react'

import { ChartPatterns, ChartWithTable, useMeasuredWidth, type LegendEntry, type SeriesPattern } from './primitives'
import { commonUnit, linearScale, niceExtent, ticks } from './Scale'

/**
 * Line plots.
 *
 * Used where the x axis is a parameter rather than a category: latency against round count, throughput
 * against payload size. Points are square markers on a hairline path; the selected series carries the
 * oxide accent and everything else stays ink, so a comparison reads at a glance without a rainbow.
 */

export interface LinePoint {
  readonly x: number
  readonly y: number
  readonly note?: string
}

export interface LineSeries {
  readonly id: string
  readonly label: string
  readonly points: readonly LinePoint[]
  readonly accent?: boolean
  readonly dashed?: boolean
  readonly pattern?: SeriesPattern
}

export interface LinePlotProps {
  readonly series: readonly LineSeries[]
  readonly xLabel: string
  readonly yLabel: string
  readonly formatX: (value: number) => { value: string; unit: string }
  readonly formatY: (value: number) => { value: string; unit: string }
  readonly ariaLabel: string
  readonly summary: string
  readonly table: React.ReactNode
  readonly className?: string
  readonly height?: number
}

const MARGIN = { top: 14, right: 16, bottom: 44, left: 58 }

export function LinePlot({
  series,
  xLabel,
  yLabel,
  formatX,
  formatY,
  ariaLabel,
  summary,
  table,
  className,
  height = 260,
}: LinePlotProps) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>()
  const namespace = useId().replace(/:/g, '')

  const pointCount = series.reduce((total, entry) => total + entry.points.length, 0)
  if (pointCount === 0) {
    return (
      <ChartWithTable
        label={ariaLabel}
        summary={summary}
        table={table}
        chart={<div ref={ref} className="h-40 rounded-hair border border-rule bg-well" />}
      />
    )
  }

  const plotWidth = Math.max(80, width - MARGIN.left - MARGIN.right)
  const plotHeight = height - MARGIN.top - MARGIN.bottom

  const xValues = series.flatMap((entry) => entry.points.map((point) => point.x))
  const yValues = series.flatMap((entry) => entry.points.map((point) => point.y))
  const xDomain = niceExtent(Math.min(...xValues), Math.max(...xValues), false)
  const yDomain = niceExtent(Math.min(...yValues), Math.max(...yValues), false)

  const xScale = linearScale(xDomain, [0, plotWidth])
  const yScale = linearScale(yDomain, [plotHeight, 0])
  const xTicks = ticks(xDomain[0], xDomain[1], 5)
  const yTicks = ticks(yDomain[0], yDomain[1], 4)
  const yUnit = commonUnit(yTicks.map(formatY))

  const legend: LegendEntry[] = series.map((entry, index) => ({
    label: entry.label,
    color: entry.accent ? 'var(--color-series-4)' : index === 1 ? 'var(--color-series-2)' : 'var(--color-series-1)',
    pattern: entry.pattern ?? (index === 1 ? 'dots' : 'solid'),
  }))

  return (
    <ChartWithTable
      className={className}
      label={ariaLabel}
      summary={summary}
      table={table}
      legend={<LegendRow entries={legend} />}
      chart={
        <div ref={ref} className="w-full">
          {width > 0 ? (
            <svg width={width} height={height} role="img" aria-label={ariaLabel}>
              <ChartPatterns namespace={namespace} />
              <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
                {/* horizontal grid + y labels */}
                {yTicks.map((tick) => (
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
                {/* x ticks */}
                {xTicks.map((tick) => (
                  <g key={tick}>
                    <line
                      x1={xScale.at(tick)}
                      y1={plotHeight}
                      x2={xScale.at(tick)}
                      y2={plotHeight + 5}
                      stroke="var(--color-rule-2)"
                      strokeWidth="1"
                    />
                    <text
                      x={xScale.at(tick)}
                      y={plotHeight + 18}
                      textAnchor="middle"
                      className="font-mono"
                      fontSize="10"
                      fill="var(--color-ink-3)"
                    >
                      {formatX(tick).value}
                    </text>
                  </g>
                ))}

                {/* series */}
                {series.map((entry, index) => {
                  const color = entry.accent
                    ? 'var(--color-series-4)'
                    : index === 1
                      ? 'var(--color-series-2)'
                      : 'var(--color-series-1)'
                  const path = entry.points
                    .slice()
                    .sort((a, b) => a.x - b.x)
                    .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'} ${xScale.at(point.x)} ${yScale.at(point.y)}`)
                    .join(' ')

                  return (
                    <g key={entry.id}>
                      <path
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth={entry.accent ? 2 : 1.5}
                        strokeDasharray={entry.dashed ? '4 3' : undefined}
                      />
                      {entry.points.map((point) => (
                        <rect
                          key={`${point.x}-${point.y}`}
                          x={xScale.at(point.x) - 2.5}
                          y={yScale.at(point.y) - 2.5}
                          width="5"
                          height="5"
                          fill={color}
                        >
                          <title>
                            {`${formatX(point.x).value} ${formatX(point.x).unit} → ${formatY(point.y).value} ${formatY(point.y).unit}${point.note ? ` · ${point.note}` : ''}`}
                          </title>
                        </rect>
                      ))}
                    </g>
                  )
                })}

                {/* axis titles */}
                <text
                  x={plotWidth}
                  y={plotHeight + 38}
                  textAnchor="end"
                  className="font-mono"
                  fontSize="10"
                  fill="var(--color-ink-4)"
                  letterSpacing="0.08em"
                >
                  {`${xLabel.toUpperCase()}${xTicks.length > 0 ? ` · ${formatX(xTicks[0]).unit}` : ''}`}
                </text>
                <text
                  x={-MARGIN.left + 4}
                  y={-2}
                  className="font-mono"
                  fontSize="10"
                  fill="var(--color-ink-4)"
                  letterSpacing="0.08em"
                >
                  {`${yLabel.toUpperCase()}${yUnit ? ` · ${yUnit}` : ''}`}
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

function LegendRow({ entries }: { entries: readonly LegendEntry[] }) {
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
