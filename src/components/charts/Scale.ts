import { latencyParts, throughputParts } from '@/lib/format'

/**
 * Chart scales.
 *
 * Written by hand rather than added as a dependency: the charts in this tool are all one-dimensional
 * linear plots, and the alternative — a general charting library — brings a recognisable default look
 * that has to be fought back out again. The whole of the maths is a linear map, a nice-tick search and
 * unit-aware formatting.
 */

export interface Scale {
  readonly domain: readonly [number, number]
  readonly range: readonly [number, number]
  /** Domain value to pixel position. */
  readonly at: (value: number) => number
  /** Pixel position back to a domain value, for hover readouts. */
  readonly invert: (pixel: number) => number
}

export function linearScale(domain: readonly [number, number], range: readonly [number, number]): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0
  const scale = span === 0 ? 0 : (r1 - r0) / span

  return {
    domain,
    range,
    at: (value) => r0 + (value - d0) * scale,
    invert: (pixel) => (scale === 0 ? d0 : d0 + (pixel - r0) / scale),
  }
}

export function extent(values: readonly number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  let min = values[0]
  let max = values[0]
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  return [min, max]
}

/** Round a domain outward to friendly numbers, so axis labels read as values rather than offsets. */
export function niceExtent(min: number, max: number, includeZero = true): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  let low = includeZero ? Math.min(0, min) : min
  let high = Math.max(max, includeZero ? 0 : max)

  if (low === high) {
    if (low === 0) return [0, 1]
    low = low > 0 ? 0 : low * 1.1
    high = high > 0 ? high * 1.1 : 0
  }

  const step = niceStep((high - low) / 5)
  low = Math.floor(low / step) * step
  high = Math.ceil(high / step) * step
  return [low, high]
}

function niceStep(rough: number): number {
  if (rough <= 0 || !Number.isFinite(rough)) return 1
  const exponent = Math.floor(Math.log10(rough))
  const magnitude = 10 ** exponent
  const fraction = rough / magnitude
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return niceFraction * magnitude
}

export function ticks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min]
  const step = niceStep((max - min) / Math.max(1, count))
  const out: number[] = []
  const start = Math.ceil(min / step) * step
  for (let value = start; value <= max + step * 1e-6; value += step) {
    // Guard against accumulated floating-point noise producing 0.30000000000000004.
    out.push(Number(value.toPrecision(12)))
  }
  return out
}

/* --------------------------------------------------------------- formatting */

/** Axis label for a latency in nanoseconds, keeping the unit out of the number. */
export function formatLatencyTick(ns: number): { value: string; unit: string } {
  return latencyParts(ns)
}

export function formatThroughputTick(bytesPerSecond: number): { value: string; unit: string } {
  return throughputParts(bytesPerSecond)
}

export function formatBytesTick(bytes: number): { value: string; unit: string } {
  if (bytes < 1024) return { value: String(Math.round(bytes)), unit: 'B' }
  if (bytes < 1024 * 1024) return { value: trim(bytes / 1024), unit: 'KiB' }
  return { value: trim(bytes / (1024 * 1024)), unit: 'MiB' }
}

/**
 * A payload axis formatter that pins one unit for the whole scale. Per-value units are fine for a
 * single readout and wrong for an axis: "256" and "16" on the same line cannot mean B and KiB.
 */
export function byteAxisFormatter(maxBytes: number): (bytes: number) => { value: string; unit: string } {
  if (maxBytes >= 1024 * 1024) {
    return (bytes) => ({ value: trim(bytes / (1024 * 1024)), unit: 'MiB' })
  }
  if (maxBytes >= 1024) {
    return (bytes) => ({ value: trim(bytes / 1024), unit: 'KiB' })
  }
  return (bytes) => ({ value: String(Math.round(bytes)), unit: 'B' })
}

export function formatMicroTick(ns: number): { value: string; unit: string } {
  if (ns < 1000) return { value: trim(ns), unit: 'ns' }
  if (ns < 1e6) return { value: trim(ns / 1000), unit: 'µs' }
  if (ns < 1e9) return { value: trim(ns / 1e6), unit: 'ms' }
  return { value: trim(ns / 1e9), unit: 's' }
}

function trim(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const fixed = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

/** A shared unit for an axis, taken from the largest tick, so labels do not repeat it. */
export function commonUnit(labels: readonly { unit: string }[]): string {
  const counts = new Map<string, number>()
  for (const label of labels) {
    counts.set(label.unit, (counts.get(label.unit) ?? 0) + 1)
  }
  let best = ''
  let bestCount = -1
  for (const [unit, count] of counts) {
    if (count > bestCount) {
      best = unit
      bestCount = count
    }
  }
  return best
}
