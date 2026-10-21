import { formatByteCount, formatConfigLabel, formatLatency, formatThroughput } from '@/lib/format'
import type { SavedRun } from '@/lib/storage/experiments'
import { DataTable } from '@/components/ui/Data'
import { BarGroup } from '@/components/charts/BarGroup'
import { DistributionKey, DistributionStrip } from '@/components/charts/DistributionStrip'
import { LinePlot } from '@/components/charts/LinePlot'
import { ChartEmpty } from '@/components/charts/primitives'
import { formatBytesTick, formatMicroTick, formatThroughputTick } from '@/components/charts/Scale'
import { Stack, StackHead, StackRow } from '@/components/ui/Surface'
import type { ResultEntry } from './compatibility'

/**
 * Comparison charts.
 *
 * Four views, each answering a different question and each carrying its own table alternative. Charts
 * that cannot be drawn from the current selection say so and explain what measurement would be needed,
 * rather than showing an empty frame or an invented point.
 */

interface TableRow {
  readonly id: string
  readonly cells: readonly string[]
}

function TableFrom({
  caption,
  headers,
  rows,
}: {
  caption: string
  headers: readonly string[]
  rows: readonly (readonly string[])[]
}) {
  return (
    <div className="rounded-hair border border-rule bg-sheet">
      <DataTable<TableRow>
        caption={caption}
        rows={rows.map((cells, index) => ({ id: String(index), cells }))}
        getRowKey={(row) => row.id}
        columns={headers.map((header, index) => ({
          key: String(index),
          header,
          align: index === 0 ? 'left' : 'right',
          render: (row) => row.cells[index],
        }))}
      />
    </div>
  )
}

export function LatencyRoundsChart({ entries }: { entries: readonly ResultEntry[] }) {
  const bySignature = new Map<string, ResultEntry[]>()
  for (const entry of entries) {
    const key = `${entry.result.config.w}|${entry.result.config.b}|${entry.run.payloadBytes}|${entry.result.target}`
    const bucket = bySignature.get(key)
    if (bucket) bucket.push(entry)
    else bySignature.set(key, [entry])
  }

  const sweeps = Array.from(bySignature.entries()).filter(
    ([, bucket]) => new Set(bucket.map((entry) => entry.result.config.r)).size >= 2,
  )

  if (sweeps.length === 0) {
    return (
      <Stack>
        <StackHead index="05.3" title="Latency against round count" />
        <StackRow>
          <ChartEmpty>
            No two results in this comparison share a word size, key length, payload and direction while
            differing in round count. A rounds sweep in the Benchmark Lab produces exactly that set.
          </ChartEmpty>
        </StackRow>
      </Stack>
    )
  }

  const series = sweeps.map(([key, bucket], index) => ({
    id: key,
    label: `${formatConfigLabel(bucket[0].result.config)} · ${formatByteCount(bucket[0].run.payloadBytes)}`,
    accent: index === 0,
    points: bucket
      .slice()
      .sort((a, b) => a.result.config.r - b.result.config.r)
      .map((entry) => ({
        x: entry.result.config.r,
        y: entry.result.metrics.medianNs,
        note: entry.run.name,
      })),
  }))

  const tableRows = sweeps.flatMap(([, bucket]) =>
    bucket
      .slice()
      .sort((a, b) => a.result.config.r - b.result.config.r)
      .map((entry) => [
        `r = ${entry.result.config.r}`,
        formatConfigLabel(entry.result.config),
        formatByteCount(entry.run.payloadBytes),
        formatLatency(entry.result.metrics.medianNs),
        formatLatency(entry.result.metrics.p95Ns),
        formatThroughput(entry.result.throughputBytesPerSecond),
      ]),
  )

  return (
    <Stack>
      <StackHead
        index="05.3"
        title="Latency against round count"
        note="change one parameter at a time"
      />
      <StackRow>
        <LinePlot
          ariaLabel="Median per-operation latency against round count"
          summary="Each point is the median per-operation latency measured at that round count. This is the chart that shows what extra rounds cost on this machine; it does not show what they buy."
          xLabel="rounds (r)"
          yLabel="median per operation"
          formatX={(value) => ({ value: String(value), unit: '' })}
          formatY={formatMicroTick}
          series={series}
          height={280}
          table={
            <TableFrom
              caption="Median latency by round count"
              headers={['Point', 'Configuration', 'Payload', 'Median', 'p95', 'Throughput']}
              rows={tableRows}
            />
          }
        />
      </StackRow>
    </Stack>
  )
}

export function DirectionBarsChart({ entries }: { entries: readonly ResultEntry[] }) {
  const bySignature = new Map<string, ResultEntry[]>()
  for (const entry of entries) {
    const key = `${entry.run.payloadBytes}|${entry.run.methodology}|${entry.result.implPath}`
    const bucket = bySignature.get(key)
    if (bucket) bucket.push(entry)
    else bySignature.set(key, [entry])
  }

  const withBoth = Array.from(bySignature.values())
    .filter((bucket) => new Set(bucket.map((entry) => entry.result.target)).size === 2)
    .sort((a, b) => b.length - a.length)[0]

  if (!withBoth) {
    return (
      <Stack>
        <StackHead index="05.4" title="Encryption against decryption" />
        <StackRow>
          <ChartEmpty>
            No configuration in this comparison has both directions measured at the same payload and
            methodology. Benchmark a configuration with the direction set to Both to see the pair.
          </ChartEmpty>
        </StackRow>
      </Stack>
    )
  }

  const configs = Array.from(
    new Map(
      withBoth.map((entry) => [
        `${entry.result.config.w}-${entry.result.config.r}-${entry.result.config.b}`,
        entry,
      ]),
    ).values(),
  )

  const categories = configs.map((entry) => ({
    key: `${entry.result.config.w}-${entry.result.config.r}-${entry.result.config.b}`,
    label: `${entry.result.config.r}R`,
    note: `${entry.result.config.w}/${entry.result.config.b}`,
  }))

  const values: Record<string, Record<string, number>> = {
    encrypt: {},
    decrypt: {},
  }
  for (const entry of withBoth) {
    const key = `${entry.result.config.w}-${entry.result.config.r}-${entry.result.config.b}`
    values[entry.result.target][key] = entry.result.metrics.medianNs
  }

  const tableRows = configs.map((entry) => {
    const key = `${entry.result.config.w}-${entry.result.config.r}-${entry.result.config.b}`
    const enc = values.encrypt[key]
    const dec = values.decrypt[key]
    return [
      formatConfigLabel(entry.result.config),
      enc === undefined ? '—' : formatLatency(enc),
      dec === undefined ? '—' : formatLatency(dec),
      enc !== undefined && dec !== undefined
        ? `${(((dec - enc) / enc) * 100).toFixed(1)}%`
        : '—',
    ]
  })

  return (
    <Stack>
      <StackHead
        index="05.4"
        title="Encryption against decryption"
        note={`at ${formatByteCount(withBoth[0].run.payloadBytes)}`}
      />
      <StackRow>
        <BarGroup
          ariaLabel="Median encryption and decryption latency per configuration"
          summary="Median latency for each direction, at one payload size and one methodology. Decryption is not always the same cost as encryption, and which one matters depends on where the work happens."
          yLabel="median per operation"
          formatY={formatMicroTick}
          categories={categories}
          series={[
            { id: 'encrypt', label: 'Encrypt', pattern: 'solid' },
            { id: 'decrypt', label: 'Decrypt', pattern: 'hatch' },
          ]}
          values={values}
          height={280}
          table={
            <TableFrom
              caption="Median encryption and decryption latency"
              headers={['Configuration', 'Encrypt', 'Decrypt', 'Decrypt relative to encrypt']}
              rows={tableRows}
            />
          }
        />
      </StackRow>
    </Stack>
  )
}

export function ThroughputPayloadChart({ entries }: { entries: readonly ResultEntry[] }) {
  const byConfig = new Map<string, ResultEntry[]>()
  for (const entry of entries) {
    const key = `${formatConfigLabel(entry.result.config)}|${entry.result.target}|${entry.result.implPath}`
    const bucket = byConfig.get(key)
    if (bucket) bucket.push(entry)
    else byConfig.set(key, [entry])
  }

  const multiPayload = Array.from(byConfig.entries()).filter(
    ([, bucket]) => new Set(bucket.map((entry) => entry.run.payloadBytes)).size >= 2,
  )

  if (multiPayload.length === 0) {
    return (
      <Stack>
        <StackHead index="05.5" title="Throughput against payload size" />
        <StackRow>
          <ChartEmpty>
            Every configuration here has been measured at one payload size only. Benchmark the same
            configuration at several payload sizes to see how throughput changes with the amount of data.
          </ChartEmpty>
        </StackRow>
      </Stack>
    )
  }

  const series = multiPayload.map(([key, bucket], index) => ({
    id: key,
    label: `${formatConfigLabel(bucket[0].result.config)} · ${bucket[0].result.target}`,
    accent: index === 0,
    points: bucket
      .slice()
      .sort((a, b) => a.run.payloadBytes - b.run.payloadBytes)
      .map((entry) => ({
        x: entry.run.payloadBytes,
        y: entry.result.throughputBytesPerSecond,
        note: entry.run.name,
      })),
  }))

  const tableRows = multiPayload.flatMap(([, bucket]) =>
    bucket
      .slice()
      .sort((a, b) => a.run.payloadBytes - b.run.payloadBytes)
      .map((entry) => [
        formatByteCount(entry.run.payloadBytes),
        formatConfigLabel(entry.result.config),
        entry.result.target,
        formatThroughput(entry.result.throughputBytesPerSecond),
        formatLatency(entry.result.metrics.medianNs),
      ]),
  )

  return (
    <Stack>
      <StackHead
        index="05.5"
        title="Throughput against payload size"
        note="bytes per second"
      />
      <StackRow>
        <LinePlot
          ariaLabel="Throughput against payload size"
          summary="Throughput rises with payload size up to a point, because a fixed per-call cost is amortised over more blocks. A dip at larger sizes is usually the payload no longer fitting in cache."
          xLabel="payload"
          yLabel="throughput"
          formatX={formatBytesTick}
          formatY={formatThroughputTick}
          series={series}
          height={280}
          table={
            <TableFrom
              caption="Throughput by payload size"
              headers={['Payload', 'Configuration', 'Direction', 'Throughput', 'Median']}
              rows={tableRows}
            />
          }
        />
      </StackRow>
    </Stack>
  )
}

export function CompareDistribution({ entries }: { entries: readonly ResultEntry[] }) {
  const sorted = entries
    .slice()
    .sort((a, b) => a.result.metrics.medianNs - b.result.metrics.medianNs)

  const tableRows = sorted.map((entry) => [
    formatConfigLabel(entry.result.config),
    entry.result.target,
    formatLatency(entry.result.metrics.minNs),
    formatLatency(entry.result.metrics.q1Ns),
    formatLatency(entry.result.metrics.medianNs),
    formatLatency(entry.result.metrics.q3Ns),
    formatLatency(entry.result.metrics.p95Ns),
    formatLatency(entry.result.metrics.maxNs),
  ])

  return (
    <Stack>
      <StackHead
        index="05.6"
        title="Distribution"
        note="the shape behind the median"
      />
      <StackRow className="space-y-4">
        <DistributionStrip
          ariaLabel="Latency distribution for each compared configuration"
          series={sorted.map((entry, index) => ({
            id: entry.result.id,
            label: formatConfigLabel(entry.result.config),
            note: `${entry.result.target} · n=${entry.result.rawSampleCount}`,
            summary: entry.result.metrics,
            samples: entry.result.samplesNs,
            accent: index === 0,
            pattern: entry.result.implPath === 'bigint' ? 'hatch' : 'solid',
          }))}
        />
        <DistributionKey />
        <details className="pt-2">
          <summary className="min-h-11 cursor-pointer font-mono text-label uppercase text-ink-3 sm:min-h-0">
            Show the numbers behind the distribution
          </summary>
          <div className="pt-3">
            <TableFrom
              caption="Latency distribution summary"
              headers={['Configuration', 'Direction', 'Min', 'Q1', 'Median', 'Q3', 'p95', 'Max']}
              rows={tableRows}
            />
          </div>
        </details>
      </StackRow>
    </Stack>
  )
}

export function measurementContext(run: SavedRun): string {
  return `${run.environment.browserLabel} · ${run.environment.osLabel} · ${run.timerResolutionMs > 0 ? `${(run.timerResolutionMs * 1000).toFixed(0)} µs timer` : 'timer resolution unknown'}`
}
