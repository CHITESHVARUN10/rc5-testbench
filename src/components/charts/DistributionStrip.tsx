import { useId } from 'react'

import { cn } from '@/lib/cn'
import type { TimingSummary } from '@/lib/benchmark/stats'
import { ChartPatterns, seriesFill, useMeasuredWidth, type SeriesPattern } from './primitives'
import { commonUnit, formatMicroTick, linearScale, niceExtent, ticks } from './Scale'

/**
 * Latency distribution per configuration.
 *
 * A drawn rail with the interquartile block, a median tick, and a p95 mark — the shape of the
 * measurement rather than a single number with a ±. Where a run is short enough, the individual
 * samples are drawn as hairline ticks, so a bimodal or spiky distribution is visible instead of being
 * averaged away. A mean and a standard deviation cannot show you that.
 */

export interface DistributionSeries {
  readonly id: string
  readonly label: string
  readonly summary: TimingSummary
  readonly samples?: readonly number[]
  readonly note?: string
  readonly accent?: boolean
  readonly pattern?: SeriesPattern
}

export interface DistributionStripProps {
  readonly series: readonly DistributionSeries[]
  readonly ariaLabel: string
  readonly className?: string
  readonly maxSampleTicks?: number
}

interface ScaleLike {
  at: (value: number) => number
}

interface Geometry {
  readonly scale: ScaleLike
  readonly plotWidth: number
  readonly labelWidth: number
  readonly valueWidth: number
  readonly rowHeight: number
}

export function DistributionStrip({
  series,
  ariaLabel,
  className,
  maxSampleTicks = 200,
}: DistributionStripProps) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>()
  const namespace = useId().replace(/:/g, '')

  if (series.length === 0) {
    return (
      <div ref={ref} className={cn('min-h-24 rounded-hair border border-rule bg-well', className)} />
    )
  }

  const compact = width > 0 && width < 620
  const labelWidth = compact ? 92 : 156
  const valueWidth = compact ? 0 : 78
  const rowHeight = compact ? 48 : 56
  const axisHeight = 36
  const plotWidth = Math.max(80, width - labelWidth - valueWidth - 12)
  const height = series.length * rowHeight + axisHeight

  const allValues = series.flatMap((entry) => [
    entry.summary.minNs,
    entry.summary.p95Ns,
    entry.summary.maxNs,
    entry.summary.medianNs,
  ])
  const domain = niceExtent(Math.min(...allValues), Math.max(...allValues), false)
  const scale = linearScale(domain, [0, plotWidth])
  const tickValues = ticks(domain[0], domain[1], compact ? 3 : 5)
  const unit = commonUnit(tickValues.map(formatMicroTick))

  const geometry: Geometry = { scale, plotWidth, labelWidth, valueWidth, rowHeight }

  return (
    <div ref={ref} className={cn('w-full', className)}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          className="overflow-visible"
        >
          <ChartPatterns namespace={namespace} />

          {series.map((entry, index) => (
            <DistributionRow
              key={entry.id}
              entry={entry}
              index={index}
              geometry={geometry}
              namespace={namespace}
              compact={compact}
              maxSampleTicks={maxSampleTicks}
            />
          ))}

          {/* Axis */}
          <g transform={`translate(${labelWidth}, ${series.length * rowHeight})`}>
            {tickValues.map((tick) => (
              <g key={tick}>
                <line
                  x1={scale.at(tick)}
                  y1={0}
                  x2={scale.at(tick)}
                  y2={6}
                  stroke="var(--color-rule-2)"
                  strokeWidth="1"
                />
                <text
                  x={scale.at(tick)}
                  y={20}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="10"
                  fill="var(--color-ink-3)"
                >
                  {formatMicroTick(tick).value}
                </text>
              </g>
            ))}
            <text x={0} y={34} className="font-mono" fontSize="10" fill="var(--color-ink-4)" letterSpacing="0.08em">
              {`PER OPERATION · ${unit || 'ns'}`}
            </text>
          </g>
        </svg>
      ) : (
        <div style={{ height }} />
      )}
    </div>
  )
}

function DistributionRow({
  entry,
  index,
  geometry,
  namespace,
  compact,
  maxSampleTicks,
}: {
  entry: DistributionSeries
  index: number
  geometry: Geometry
  namespace: string
  compact: boolean
  maxSampleTicks: number
}) {
  const { scale, labelWidth, rowHeight, plotWidth, valueWidth } = geometry
  const centerY = index * rowHeight + rowHeight / 2
  const { minNs, maxNs, q1Ns, q3Ns, medianNs, p95Ns } = entry.summary
  const color = entry.accent ? 'var(--color-series-4)' : 'var(--color-series-1)'
  const pattern: SeriesPattern = entry.pattern ?? 'solid'
  const fill = seriesFill(namespace, pattern, color)

  const canDrawSamples = entry.samples !== undefined && entry.samples.length <= maxSampleTicks

  return (
    <g transform={`translate(0, ${index * rowHeight})`}>
      <text x={0} y={centerY - 2} className="font-mono" fontSize="11" fill="var(--color-ink)">
        {entry.label}
      </text>
      {entry.note ? (
        <text x={0} y={centerY + 12} className="font-mono" fontSize="9" fill="var(--color-ink-4)">
          {entry.note}
        </text>
      ) : null}

      <g transform={`translate(${labelWidth}, 0)`}>
        {/* full extent */}
        <line
          x1={scale.at(minNs)}
          y1={centerY}
          x2={scale.at(maxNs)}
          y2={centerY}
          stroke="var(--color-rule-3)"
          strokeWidth="1"
        />
        {/* interquartile block */}
        <rect
          x={scale.at(q1Ns)}
          y={centerY - 8}
          width={Math.max(1, scale.at(q3Ns) - scale.at(q1Ns))}
          height={16}
          fill={fill.fill}
          style={fill.style}
          stroke={color}
          strokeWidth="1"
        />
        {/* individual samples, when there are few enough to be honest about */}
        {canDrawSamples
          ? entry.samples?.map((sample, sampleIndex) => (
              <line
                key={sampleIndex}
                x1={scale.at(sample)}
                y1={centerY + 10}
                x2={scale.at(sample)}
                y2={centerY + 16}
                stroke="var(--color-rule-3)"
                strokeWidth="1"
              />
            ))
          : null}
        {/* median */}
        <line
          x1={scale.at(medianNs)}
          y1={centerY - 13}
          x2={scale.at(medianNs)}
          y2={centerY + 13}
          stroke="var(--color-ink)"
          strokeWidth="2"
        />
        {/* p95 mark */}
        <path
          d={`M ${scale.at(p95Ns) - 4} ${centerY + 24} L ${scale.at(p95Ns)} ${centerY + 18} L ${scale.at(p95Ns) + 4} ${centerY + 24}`}
          fill="none"
          stroke={entry.accent ? 'var(--color-series-4)' : 'var(--color-ink-2)'}
          strokeWidth="1.5"
        />
      </g>

      {!compact ? (
        <text
          x={labelWidth + plotWidth + 12}
          y={centerY + 4}
          className="font-mono"
          fontSize="12"
          fill="var(--color-ink)"
        >
          {formatMicroTick(medianNs).value}
          <tspan fill="var(--color-ink-3)" fontSize="9">
            {` ${formatMicroTick(medianNs).unit}`}
          </tspan>
        </text>
      ) : null}
      {valueWidth === 0 ? null : (
        <title>{`${entry.label}: median ${formatMicroTick(medianNs).value} ${formatMicroTick(medianNs).unit}, p95 ${formatMicroTick(p95Ns).value} ${formatMicroTick(p95Ns).unit}, min ${formatMicroTick(minNs).value}, max ${formatMicroTick(maxNs).value}`}</title>
      )}
    </g>
  )
}

/** The reading key for a distribution strip, stated once rather than repeated per row. */
export function DistributionKey() {
  return (
    <p className="text-sm text-ink-3">
      Each rail spans the slowest and quickest samples. The block is the interquartile range, the heavy
      tick is the median, and the small chevron below marks p95 — the value that 95% of samples came in
      under. Where a run took 200 samples or fewer, every sample is drawn as a hairline tick beneath the
      rail.
    </p>
  )
}
