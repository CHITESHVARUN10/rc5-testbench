import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'

import { cn } from '@/lib/cn'
import { Button } from '../ui/Button'
import { Label } from '../ui/Text'

/**
 * Chart primitives.
 *
 * Charts are drawn in ink, and series are separated by value and hatch pattern rather than by hue.
 * That keeps a page printable in black and white, survives every form of colour blindness, and keeps
 * the oxide signal meaning one thing only: the series currently selected.
 *
 * Every chart is accompanied by a table of the same numbers, toggled here, because a picture of data
 * is not an accessible representation of it.
 */

/** Track a container's width so the plot can be drawn at real pixel size and keep its type readable. */
export function useMeasuredWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const update = () => setWidth(node.clientWidth)
    update()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}

export type SeriesPattern = 'solid' | 'hatch' | 'hatch-dense' | 'dots' | 'cross'

export const SERIES_COLORS = [
  'var(--color-series-1)',
  'var(--color-series-2)',
  'var(--color-series-3)',
  'var(--color-series-4)',
] as const

export const SERIES_PATTERNS: readonly SeriesPattern[] = ['solid', 'hatch', 'dots', 'hatch-dense']

/** Pattern definitions for one chart. Ids are namespaced per chart instance. */
export function ChartPatterns({ namespace }: { namespace: string }) {
  return (
    <defs>
      <pattern id={`${namespace}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="none" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.6" />
      </pattern>
      <pattern id={`${namespace}-hatch-dense`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1.2" />
      </pattern>
      <pattern id={`${namespace}-dots`} width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="currentColor" />
      </pattern>
      <pattern id={`${namespace}-cross`} width="7" height="7" patternUnits="userSpaceOnUse">
        <path d="M0 0 L7 7 M7 0 L0 7" stroke="currentColor" strokeWidth="0.9" />
      </pattern>
    </defs>
  )
}

/** A fill reference for a series: either its colour, or a hatch in that colour. */
export function seriesFill(
  namespace: string,
  pattern: SeriesPattern,
  color: string,
  opacity?: number,
): { fill: string; style?: { color: string; opacity?: number } } {
  if (pattern === 'solid') {
    return { fill: color, style: opacity === undefined ? undefined : { color, opacity } }
  }
  return {
    fill: `url(#${namespace}-${pattern})`,
    style: opacity === undefined ? { color } : { color, opacity },
  }
}

export interface LegendEntry {
  readonly label: string
  readonly color: string
  readonly pattern: SeriesPattern
  readonly note?: string
}

export function ChartLegend({ entries, className }: { entries: readonly LegendEntry[]; className?: string }) {
  const namespace = useId().replace(/:/g, '')
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      <svg width="0" height="0" aria-hidden="true">
        <ChartPatterns namespace={namespace} />
      </svg>
      {entries.map((entry) => {
        const fill = seriesFill(namespace, entry.pattern, entry.color)
        return (
          <span key={entry.label} className="flex items-center gap-2">
            <svg width="14" height="14" aria-hidden="true">
              <rect
                x="1"
                y="1"
                width="12"
                height="12"
                fill={fill.fill}
                style={fill.style}
                stroke={entry.color}
                strokeWidth="1"
              />
            </svg>
            <span className="font-mono text-label text-ink-2 uppercase">{entry.label}</span>
            {entry.note ? <span className="font-mono text-label text-ink-4">{entry.note}</span> : null}
          </span>
        )
      })}
    </div>
  )
}

export interface AxisProps {
  readonly scale: ScaleLike
  readonly ticks: readonly number[]
  readonly orientation: 'x' | 'y'
  readonly label: string
  readonly format: (value: number) => string
  readonly length: number
  readonly unit?: string
}

interface ScaleLike {
  at: (value: number) => number
}

/** Hairline grid and mono tick labels. Grid lines are drawn only at labelled ticks. */
export function Axis({ scale, ticks, orientation, label, format, length, unit }: AxisProps) {
  return (
    <g>
      {ticks.map((tick) => {
        const position = scale.at(tick)
        const isZero = tick === 0
        if (orientation === 'x') {
          return (
            <g key={tick}>
              <line
                x1={position}
                y1={0}
                x2={position}
                y2={length}
                stroke={isZero ? 'var(--color-rule-2)' : 'var(--color-rule)'}
                strokeWidth="1"
              />
              <text
                x={position}
                y={length + 15}
                textAnchor="middle"
                className="font-mono"
                fontSize="10"
                fill="var(--color-ink-3)"
              >
                {format(tick)}
              </text>
            </g>
          )
        }
        return (
          <g key={tick}>
            <line
              x1={0}
              y1={position}
              x2={length}
              y2={position}
              stroke={isZero ? 'var(--color-rule-2)' : 'var(--color-rule)'}
              strokeWidth="1"
            />
            <text
              x={-8}
              y={position + 3}
              textAnchor="end"
              className="font-mono"
              fontSize="10"
              fill="var(--color-ink-3)"
            >
              {format(tick)}
            </text>
          </g>
        )
      })}
      <text
        className="font-mono"
        fontSize="10"
        fill="var(--color-ink-4)"
        letterSpacing="0.08em"
        style={{ textTransform: 'uppercase' }}
        x={orientation === 'x' ? length : -8}
        y={orientation === 'x' ? length + 30 : 0}
        textAnchor={orientation === 'x' ? 'end' : 'end'}
      >
        {label}
        {unit ? ` · ${unit}` : ''}
      </text>
    </g>
  )
}

export interface ChartWithTableProps {
  readonly label: string
  readonly summary: ReactNode
  readonly chart: ReactNode
  readonly table: ReactNode
  readonly legend?: ReactNode
  readonly className?: string
}

/**
 * A chart with its tabular alternative. The toggle is a real control with pressed state, and the
 * table is the same data rather than a description of it.
 */
export function ChartWithTable({ label, summary, chart, table, legend, className }: ChartWithTableProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')

  return (
    <figure className={cn('space-y-3', className)}>
      <figcaption className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Label>{label}</Label>
          <p className="max-w-[76ch] text-sm text-ink-3">{summary}</p>
        </div>
        <div className="shrink-0">
          <Button
            compact
            variant="ghost"
            aria-pressed={view === 'table'}
            onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
          >
            {view === 'chart' ? 'Show table' : 'Show chart'}
          </Button>
        </div>
      </figcaption>
      {view === 'chart' ? (
        <div className="space-y-3">
          {chart}
          {legend}
        </div>
      ) : (
        <div>{table}</div>
      )}
    </figure>
  )
}

/** Shared empty state for a chart with nothing to plot. */
export function ChartEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-hair border border-rule bg-well px-4 py-8 text-center">
      <p className="max-w-[52ch] text-sm text-ink-3">{children}</p>
    </div>
  )
}
