import type {
  BenchGroupResult,
  BenchRunResult,
  BenchWarning,
  BenchMethodology,
} from '../benchmark/protocol'
import type { PayloadPattern } from '../benchmark/prepare'
import type { TimingSummary } from '../benchmark/stats'
import type { EnvironmentInfo } from '../env'
import type { ImplPath, PaddingPolicy, Rc5Config } from '../rc5/types'
import { SCHEMA_VERSION } from '../versions'

/**
 * The saved experiment record.
 *
 * A run is the unit the user created: one name, one timestamp, one environment, one method. The
 * results inside it are one row per configuration and direction, which is what comparison tables and
 * reports operate on. Keeping both levels means a sweep stays intact as a single experiment while its
 * configurations can still be compared individually.
 *
 * What is deliberately absent: plaintext, secret keys, and round keys. None of them are needed to
 * reproduce a run, because the benchmark generates its own payload and key from the recorded seed.
 */

export interface SavedResult {
  readonly id: string
  readonly config: Rc5Config
  readonly target: 'encrypt' | 'decrypt'
  readonly implPath: ImplPath
  readonly payloadBytes: number
  readonly blocks: number
  readonly bytesProcessed: number
  readonly opsPerBatch: number
  readonly metrics: TimingSummary
  readonly throughputBytesPerSecond: number
  readonly samplesNs: readonly number[]
  readonly rawSampleCount: number
  readonly correctnessStatus: BenchGroupResult['correctnessStatus']
  readonly keySetupNs: number | null
  readonly warnings: readonly BenchWarning[]
}

export interface SavedRun {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly algorithm: 'RC5'
  readonly schemaVersion: number
  readonly engineVersion: string
  readonly methodologyVersion: string
  readonly paddingPolicy: PaddingPolicy
  readonly methodology: BenchMethodology
  readonly payloadBytes: number
  readonly payloadPattern: PayloadPattern
  readonly payloadDigest: string
  readonly seed: number
  readonly warmupIterations: number
  readonly measuredIterations: number
  readonly timerResolutionMs: number
  readonly durationMs: number
  readonly environment: EnvironmentInfo
  readonly warnings: readonly BenchWarning[]
  readonly results: readonly SavedResult[]
  readonly notes: string
  readonly tags: readonly string[]
}

function resultId(runId: string, config: Rc5Config, target: string): string {
  return `${runId}:${config.w}-${config.r}-${config.b}:${target}`
}

export function savedResultFrom(
  runId: string,
  group: BenchGroupResult,
): SavedResult {
  return {
    id: resultId(runId, group.config, group.target),
    config: group.config,
    target: group.target,
    implPath: group.implPath,
    payloadBytes: group.payloadBytes,
    blocks: group.blocks,
    bytesProcessed: group.bytesProcessed,
    opsPerBatch: group.opsPerBatch,
    metrics: group.metrics,
    throughputBytesPerSecond: group.throughputBytesPerSecond,
    samplesNs: group.samplesNs,
    rawSampleCount: group.rawSampleCount,
    correctnessStatus: group.correctnessStatus,
    keySetupNs: group.keySetupNs,
    warnings: group.warnings,
  }
}

export function savedRunFrom(
  run: BenchRunResult,
  options: { name?: string; notes?: string; tags?: readonly string[] } = {},
): SavedRun {
  return {
    id: run.runId,
    name: options.name?.trim() || run.name,
    createdAt: run.finishedAt,
    algorithm: 'RC5',
    schemaVersion: SCHEMA_VERSION,
    engineVersion: run.engineVersion,
    methodologyVersion: run.methodologyVersion,
    paddingPolicy: run.paddingPolicy,
    methodology: run.spec.methodology,
    payloadBytes: run.spec.payloadBytes,
    payloadPattern: run.spec.pattern,
    payloadDigest: run.payloadDigest,
    seed: run.spec.seed,
    warmupIterations: run.spec.warmupIterations,
    measuredIterations: run.spec.measuredIterations,
    timerResolutionMs: run.timerResolutionMs,
    durationMs: run.durationMs,
    environment: run.environment,
    warnings: run.warnings,
    results: run.groups.map((group) => savedResultFrom(run.runId, group)),
    notes: options.notes ?? '',
    tags: options.tags ?? [],
  }
}

/** A minimum viable shape check for imported records. Rejects rather than repairing. */
export function isSavedRun(value: unknown): value is SavedRun {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<SavedRun>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.createdAt === 'string' &&
    candidate.algorithm === 'RC5' &&
    Array.isArray(candidate.results) &&
    candidate.results.length > 0 &&
    typeof candidate.environment === 'object' &&
    candidate.environment !== null
  )
}

export function describeResult(result: SavedResult): string {
  return `RC5-${result.config.w}/${result.config.r}/${result.config.b} ${result.target}`
}
