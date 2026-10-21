import { blockSizeBytes } from '../rc5/constants'
import type { ImplPath, PaddingPolicy, Rc5Config } from '../rc5/types'
import type { EnvironmentInfo } from '../env'
import type { PayloadPattern } from './prepare'
import type { TimingSummary } from './stats'

/**
 * Messages between the benchmark worker and the page.
 *
 * A run streams its samples as they are taken, so the interface can show the running coefficient of
 * variation while the measurement is still in progress. Watching the noise settle is the point of
 * the Benchmark Lab: a number that appears only at the end hides how much it should be trusted.
 */

export type BenchTarget = 'encrypt' | 'decrypt' | 'both'
export type BenchMethodology = 'steady-state' | 'key-setup-included'

export const BENCH_TARGET_LABELS: Record<BenchTarget, string> = {
  encrypt: 'Encryption',
  decrypt: 'Decryption',
  both: 'Encryption and decryption',
}

export const BENCH_METHODOLOGY_LABELS: Record<BenchMethodology, string> = {
  'steady-state': 'Steady state — key schedule prepared before timing',
  'key-setup-included': 'Cipher call — key schedule included in each timed operation',
}

export interface BenchSpec {
  readonly configs: readonly Rc5Config[]
  readonly padding: PaddingPolicy
  readonly payloadBytes: number
  readonly pattern: PayloadPattern
  readonly seed: number
  readonly warmupIterations: number
  readonly measuredIterations: number
  readonly target: BenchTarget
  readonly methodology: BenchMethodology
  /** A batch is grown until it takes at least this long, to lift timings above timer resolution. */
  readonly minSampleDurationMs: number
  readonly maxOpsPerBatch: number
}

export type BenchWarningCode =
  | 'noisy'
  | 'few-samples'
  | 'coarse-timer'
  | 'max-batch-reached'
  | 'bigint-path'
  | 'high-load'
  | 'large-workload'
  | 'cross-origin-isolated'

export interface BenchWarning {
  readonly code: BenchWarningCode
  readonly message: string
}

export interface BenchSample {
  readonly index: number
  readonly nsPerOp: number
  readonly opsPerBatch: number
  /** Running coefficient of variation, so noise is visible while the run is still going. */
  readonly cvPercent: number
}

export interface BenchGroupResult {
  readonly config: Rc5Config
  readonly implPath: ImplPath
  readonly target: 'encrypt' | 'decrypt'
  readonly payloadBytes: number
  readonly blocks: number
  readonly bytesProcessed: number
  readonly opsPerBatch: number
  readonly metrics: TimingSummary
  readonly throughputBytesPerSecond: number
  /** Per-operation latency samples in nanoseconds, downsampled for storage. */
  readonly samplesNs: readonly number[]
  readonly rawSampleCount: number
  readonly correctnessStatus: 'verified' | 'mismatch' | 'not-checked'
  readonly warnings: readonly BenchWarning[]
  readonly keySetupNs: number | null
}

export interface BenchRunResult {
  readonly runId: string
  readonly name: string
  readonly spec: BenchSpec
  readonly groups: readonly BenchGroupResult[]
  readonly environment: EnvironmentInfo
  readonly startedAt: string
  readonly finishedAt: string
  readonly durationMs: number
  readonly pilotEstimateMs: number
  readonly timerResolutionMs: number
  readonly paddingPolicy: PaddingPolicy
  readonly payloadDigest: string
  readonly warnings: readonly BenchWarning[]
  readonly engineVersion: string
  readonly methodologyVersion: string
}

export interface BenchProbeResult {
  readonly runId: string
  readonly estimatedTotalMs: number
  readonly opsPerBatch: number
  readonly nsPerOp: number
  readonly timerResolutionMs: number
  readonly blocks: number
  readonly bytesProcessed: number
}

export interface BenchProgress {
  readonly phase: 'prepare' | 'warmup' | 'measure' | 'verify'
  readonly configIndex: number
  readonly configCount: number
  readonly target: 'encrypt' | 'decrypt'
  readonly done: number
  readonly total: number
}

export type BenchRequest =
  | { readonly type: 'probe'; readonly runId: string; readonly spec: BenchSpec }
  | { readonly type: 'start'; readonly runId: string; readonly name: string; readonly spec: BenchSpec }
  | { readonly type: 'cancel'; readonly runId: string }

export type BenchEvent =
  | { readonly type: 'probe-result'; readonly result: BenchProbeResult }
  | { readonly type: 'pilot'; readonly runId: string; readonly estimateMs: number; readonly opsPerBatch: number }
  | { readonly type: 'progress'; readonly runId: string; readonly progress: BenchProgress }
  | { readonly type: 'sample'; readonly runId: string; readonly configIndex: number; readonly target: 'encrypt' | 'decrypt'; readonly sample: BenchSample }
  | { readonly type: 'group-done'; readonly runId: string; readonly configIndex: number; readonly result: BenchGroupResult }
  | { readonly type: 'done'; readonly result: BenchRunResult }
  | { readonly type: 'cancelled'; readonly runId: string }
  | { readonly type: 'error'; readonly runId: string; readonly message: string }

export const BENCH_LIMITS = {
  maxPayloadBytes: 1024 * 1024,
  maxMeasuredIterations: 200_000,
  maxWarmupIterations: 50_000,
  maxOpsPerBatch: 1 << 22,
  minSampleDurationMs: 1,
  /** Above this, the interface asks the user to confirm before starting. */
  confirmAboveMs: 15_000,
} as const

export function blocksFor(payloadBytes: number, config: Rc5Config): number {
  const blockSize = blockSizeBytes(config.w)
  return Math.max(1, Math.ceil(payloadBytes / blockSize))
}

export function groupCount(spec: BenchSpec): number {
  return spec.configs.length * (spec.target === 'both' ? 2 : 1)
}
