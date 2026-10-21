import type { Rc5Config } from './rc5/types'

/**
 * Display formatting.
 *
 * One rule everywhere: a number shown without its unit is a bug. Latency is always ns, µs, ms or s;
 * throughput is always bytes/s or MiB/s; payload sizes are always bytes or KiB.
 */

const MICRO = '\u00b5s'

function significant(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  if (Math.abs(value) >= 1e21) return value.toExponential(2)
  const rounded = Number(value.toPrecision(digits))
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 20 })
}

/** RC5-32/12/16 style label for a configuration. */
export function formatConfigLabel(config: Rc5Config): string {
  return `RC5-${config.w}/${config.r}/${config.b}`
}

export function formatWordSize(w: number): string {
  return `${w}-bit`
}

export function formatByteCount(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${significant(bytes / 1024, 3)} KiB`
  return `${significant(bytes / (1024 * 1024), 3)} MiB`
}

export function formatByteRange(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${bytes / 1024} KiB`
  return `${bytes / (1024 * 1024)} MiB`
}

/** Latency split into a number and its unit, for readouts that set the unit smaller. */
export function latencyParts(ns: number | null | undefined): { value: string; unit: string } {
  if (ns === null || ns === undefined || !Number.isFinite(ns) || ns < 0) return { value: '—', unit: '' }
  if (ns < 1000) return { value: significant(ns, 3), unit: 'ns' }
  if (ns < 1e6) return { value: significant(ns / 1e3, 3), unit: MICRO }
  if (ns < 1e9) return { value: significant(ns / 1e6, 3), unit: 'ms' }
  return { value: significant(ns / 1e9, 3), unit: 's' }
}

export function throughputParts(bytesPerSecond: number | null | undefined): { value: string; unit: string } {
  if (
    bytesPerSecond === null ||
    bytesPerSecond === undefined ||
    !Number.isFinite(bytesPerSecond) ||
    bytesPerSecond < 0
  ) {
    return { value: '—', unit: '' }
  }
  if (bytesPerSecond < 1024) return { value: significant(bytesPerSecond, 3), unit: 'B/s' }
  if (bytesPerSecond < 1024 * 1024) return { value: significant(bytesPerSecond / 1024, 3), unit: 'KiB/s' }
  return { value: significant(bytesPerSecond / (1024 * 1024), 3), unit: 'MiB/s' }
}

export function byteParts(bytes: number | null | undefined): { value: string; unit: string } {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return { value: '—', unit: '' }
  if (bytes < 1024) return { value: String(bytes), unit: 'B' }
  if (bytes < 1024 * 1024) return { value: significant(bytes / 1024, 3), unit: 'KiB' }
  return { value: significant(bytes / (1024 * 1024), 3), unit: 'MiB' }
}

export function countParts(value: number | null | undefined): { value: string; unit: string } {
  if (value === null || value === undefined || !Number.isFinite(value)) return { value: '—', unit: '' }
  return { value: Math.round(value).toLocaleString('en-US'), unit: '' }
}

/** Latency from nanoseconds, choosing the unit so the number stays readable. */
export function formatLatency(ns: number | null | undefined): string {
  const { value, unit } = latencyParts(ns)
  return unit ? `${value} ${unit}` : value
}

export function formatMilliseconds(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1) return `${significant(ms * 1000, 3)} ${MICRO}`
  if (ms < 1000) return `${significant(ms, 3)} ms`
  return `${significant(ms / 1000, 3)} s`
}

export function formatThroughput(bytesPerSecond: number | null | undefined): string {
  const { value, unit } = throughputParts(bytesPerSecond)
  return unit ? `${value} ${unit}` : value
}

export function formatBitsPerSecond(bitsPerSecond: number | null | undefined): string {
  if (bitsPerSecond === null || bitsPerSecond === undefined || !Number.isFinite(bitsPerSecond)) {
    return '—'
  }
  if (bitsPerSecond < 1000) return `${significant(bitsPerSecond, 3)} bit/s`
  if (bitsPerSecond < 1e6) return `${significant(bitsPerSecond / 1e3, 3)} kbit/s`
  if (bitsPerSecond < 1e9) return `${significant(bitsPerSecond / 1e6, 3)} Mbit/s`
  return `${significant(bitsPerSecond / 1e9, 3)} Gbit/s`
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${significant(value, digits + 1)}%`
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('en-US')
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return String(Math.round(value))
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDateOnly(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
}

/** Compact relative age, for lists where the exact timestamp is available on the row's detail view. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const seconds = Math.max(0, Math.round((now - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} d ago`
  return formatDateOnly(iso)
}
