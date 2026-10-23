import type { BenchRunResult, BenchSpec } from './benchmark/protocol'
import { blockSizeBytes } from './rc5/constants'
import type { Rc5Config } from './rc5/types'
import { ENGINE_VERSION } from './versions'

/**
 * A measurement.
 *
 * One configuration, one message size, two medians. This is the whole record: it is what the
 * comparison table sorts, what the chart plots, and what the CSV exports. There is no run, no
 * experiment, no session and no hypothesis to fill in — those were machinery for a different tool.
 *
 * Everything here is measured on this machine, in this browser. Nothing is estimated or looked up.
 */

export interface Measurement {
  readonly id: string
  readonly createdAt: string
  readonly config: Rc5Config
  readonly payloadBytes: number
  readonly payloadBlocks: number
  readonly encryptNs: number
  readonly encryptP95Ns: number
  readonly decryptNs: number
  readonly decryptP95Ns: number
  /** The larger of the two coefficients of variation, as a percentage. */
  readonly spreadPercent: number
  readonly keySetupNs: number
  readonly throughputBytesPerSecond: number
  readonly samples: number
  readonly timerResolutionMs: number
  readonly correctness: 'verified' | 'mismatch'
  readonly engineVersion: string
  readonly browser: string
  readonly os: string
}

/** Fixed protocol, chosen so the number means the same thing every time it is produced. */
export const MEASUREMENT_METHOD = {
  warmupIterations: 100,
  measuredIterations: 150,
  payloadPattern: 'prng',
  seed: 0x9e3779b9,
  minSampleDurationMs: 1,
  maxOpsPerBatch: 1 << 20,
} as const

/** The smallest message we will measure. One block is the floor for a meaningful per-operation time. */
export const MIN_MEASURE_PAYLOAD_BYTES = 8

export function measurementSpec(config: Rc5Config, payloadBytes: number): BenchSpec {
  return {
    configs: [config],
    padding: 'pkcs7',
    payloadBytes,
    pattern: MEASUREMENT_METHOD.payloadPattern,
    seed: MEASUREMENT_METHOD.seed,
    warmupIterations: MEASUREMENT_METHOD.warmupIterations,
    measuredIterations: MEASUREMENT_METHOD.measuredIterations,
    target: 'both',
    methodology: 'steady-state',
    minSampleDurationMs: MEASUREMENT_METHOD.minSampleDurationMs,
    maxOpsPerBatch: MEASUREMENT_METHOD.maxOpsPerBatch,
  }
}

export function measurementFromRun(run: BenchRunResult): Measurement | null {
  const encrypt = run.groups.find((group) => group.target === 'encrypt')
  const decrypt = run.groups.find((group) => group.target === 'decrypt')
  if (!encrypt || !decrypt) return null

  const config = encrypt.config
  return {
    id: createId(),
    createdAt: new Date().toISOString(),
    config,
    payloadBytes: run.spec.payloadBytes,
    payloadBlocks: encrypt.blocks,
    encryptNs: encrypt.metrics.medianNs,
    encryptP95Ns: encrypt.metrics.p95Ns,
    decryptNs: decrypt.metrics.medianNs,
    decryptP95Ns: decrypt.metrics.p95Ns,
    spreadPercent: Math.max(encrypt.metrics.cvPercent, decrypt.metrics.cvPercent),
    keySetupNs: encrypt.keySetupNs ?? 0,
    throughputBytesPerSecond: encrypt.throughputBytesPerSecond,
    samples: encrypt.rawSampleCount,
    timerResolutionMs: run.timerResolutionMs,
    correctness:
      encrypt.correctnessStatus === 'verified' && decrypt.correctnessStatus === 'verified'
        ? 'verified'
        : 'mismatch',
    engineVersion: run.engineVersion || ENGINE_VERSION,
    browser: run.environment.browserLabel,
    os: run.environment.osLabel,
  }
}

/** Two measurements of the same configuration and message size are the same row. */
export function measurementKey(config: Rc5Config, payloadBytes: number): string {
  return `${config.w}-${config.r}-${config.b}-${payloadBytes}`
}

export function blockCount(config: Rc5Config, payloadBytes: number): number {
  return Math.max(1, Math.ceil(payloadBytes / blockSizeBytes(config.w)))
}

export function measurementsToCsv(rows: readonly Measurement[]): string {
  const header = [
    'configuration',
    'word_bits',
    'rounds',
    'key_bytes',
    'block_bytes',
    'payload_bytes',
    'payload_blocks',
    'encrypt_median_ns',
    'encrypt_p95_ns',
    'decrypt_median_ns',
    'decrypt_p95_ns',
    'key_setup_ns',
    'throughput_bytes_per_second',
    'samples',
    'spread_percent',
    'correctness',
    'measured_at',
    'browser',
    'os',
  ]
  const lines = rows.map((row) =>
    [
      `RC5-${row.config.w}/${row.config.r}/${row.config.b}`,
      row.config.w,
      row.config.r,
      row.config.b,
      blockSizeBytes(row.config.w),
      row.payloadBytes,
      row.payloadBlocks,
      round(row.encryptNs),
      round(row.encryptP95Ns),
      round(row.decryptNs),
      round(row.decryptP95Ns),
      round(row.keySetupNs),
      round(row.throughputBytesPerSecond),
      row.samples,
      round(row.spreadPercent),
      row.correctness,
      row.createdAt,
      row.browser,
      row.os,
    ]
      .map(csvCell)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

function round(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : ''
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
