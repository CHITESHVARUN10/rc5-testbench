import { blockSizeBytes } from '../rc5/constants'
import type { SavedResult, SavedRun } from '../storage/experiments'

/**
 * CSV export.
 *
 * One row per measured result, with the run's method columns repeated on every row so that a
 * spreadsheet can be sorted, filtered and charted without losing what produced each number. Numbers
 * are written as plain decimal values in their base unit (nanoseconds, bytes per second) rather than
 * pre-formatted with units, so they can be used in a calculation.
 */

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const RESULT_COLUMNS = [
  'run_id',
  'run_name',
  'created_at',
  'algorithm',
  'engine_version',
  'methodology_version',
  'schema_version',
  'word_size_bits',
  'rounds',
  'key_bytes',
  'block_bytes',
  'direction',
  'arithmetic',
  'padding_policy',
  'methodology',
  'payload_bytes',
  'payload_pattern',
  'payload_digest',
  'warmup_iterations',
  'measured_iterations',
  'operations_per_sample',
  'timer_resolution_ms',
  'run_duration_ms',
  'samples_n',
  'mean_ns',
  'median_ns',
  'min_ns',
  'max_ns',
  'stddev_ns',
  'p95_ns',
  'q1_ns',
  'q3_ns',
  'cv_percent',
  'throughput_bytes_per_second',
  'key_setup_ns',
  'correctness',
  'browser',
  'os',
  'logical_cores',
  'cross_origin_isolated',
  'warnings',
  'notes',
  'tags',
] as const

function rowFor(run: SavedRun, result: SavedResult): Array<string | number> {
  return [
    run.id,
    run.name,
    run.createdAt,
    run.algorithm,
    run.engineVersion,
    run.methodologyVersion,
    run.schemaVersion,
    result.config.w,
    result.config.r,
    result.config.b,
    blockSizeBytes(result.config.w),
    result.target,
    result.implPath,
    run.paddingPolicy,
    run.methodology,
    result.payloadBytes,
    run.payloadPattern,
    run.payloadDigest,
    run.warmupIterations,
    run.measuredIterations,
    result.opsPerBatch,
    run.timerResolutionMs,
    run.durationMs,
    result.metrics.n,
    result.metrics.meanNs,
    result.metrics.medianNs,
    result.metrics.minNs,
    result.metrics.maxNs,
    result.metrics.stdDevNs,
    result.metrics.p95Ns,
    result.metrics.q1Ns,
    result.metrics.q3Ns,
    result.metrics.cvPercent,
    result.throughputBytesPerSecond,
    result.keySetupNs ?? '',
    result.correctnessStatus,
    run.environment.browserLabel,
    run.environment.osLabel,
    run.environment.logicalCores ?? '',
    run.environment.crossOriginIsolated ? 'yes' : 'no',
    result.warnings.map((warning) => warning.code).join(' '),
    run.notes,
    run.tags.join(' '),
  ]
}

export function runsToCsv(runs: readonly SavedRun[]): string {
  const lines: string[] = [RESULT_COLUMNS.join(',')]
  for (const run of runs) {
    for (const result of run.results) {
      lines.push(rowFor(run, result).map(escapeCell).join(','))
    }
  }
  return `${lines.join('\n')}\n`
}

/**
 * Raw per-operation latency samples, one row per sample.
 *
 * These are the samples the statistics were computed from, after any downsampling applied at save
 * time — the `sample_index` column makes the ordering explicit so a reader can reconstruct the
 * distribution instead of trusting the summary.
 */
export function samplesToCsv(runs: readonly SavedRun[]): string {
  const lines: string[] = [
    'run_id,run_name,word_size_bits,rounds,key_bytes,direction,payload_bytes,sample_index,latency_ns',
  ]
  for (const run of runs) {
    for (const result of run.results) {
      result.samplesNs.forEach((sample, index) => {
        lines.push(
          [
            run.id,
            escapeCell(run.name),
            result.config.w,
            result.config.r,
            result.config.b,
            result.target,
            result.payloadBytes,
            index,
            sample,
          ].join(','),
        )
      })
    }
  }
  return `${lines.join('\n')}\n`
}
