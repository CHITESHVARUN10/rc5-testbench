import { collectEnvironment, measureTimerResolutionMs } from '../env'
import { decryptBuffer, encryptBuffer } from '../rc5/block'
import { blockSizeBytes } from '../rc5/constants'
import { expandKey, validateConfig } from '../rc5/engine'
import { compareBytes } from '../rc5/bytes'
import type { ImplPath, Rc5Config } from '../rc5/types'
import { ENGINE_VERSION, METHODOLOGY_VERSION } from '../versions'
import { generatePayload, payloadDigest } from './prepare'
import {
  BENCH_LIMITS,
  blocksFor,
  type BenchGroupResult,
  type BenchProgress,
  type BenchProbeResult,
  type BenchRunResult,
  type BenchSample,
  type BenchSpec,
  type BenchWarning,
} from './protocol'
import {
  downsampleForDisplay,
  elapsedNs,
  summarize,
  throughputBytesPerSecond,
} from './stats'

/**
 * The benchmark runner.
 *
 * Design decisions worth knowing when reading the numbers it produces:
 *
 *   - Adaptive batching. A browser timer cannot resolve a single block operation, so a batch of
 *     operations is timed as a unit and divided by the batch size. The batch grows until it spans at
 *     least `minSampleDurationMs`, and the batch size is recorded in the result so the method is
 *     visible rather than implied.
 *   - Buffers are allocated once, before the timed region, and reused. Allocation is therefore not
 *     part of the measurement, and the payload stays cache-resident across iterations.
 *   - Byte-order conversion and round processing are inside the timed region, because both are part
 *     of encrypting a payload. Key expansion is outside it in steady-state mode and inside it in
 *     cipher-call mode.
 *   - Correctness is checked after timing, never inside it, and a run whose output does not round-trip
 *     is reported as a mismatch instead of being saved as a success.
 *   - Nothing here reads or stores a user's key: the benchmark derives its own key from the spec seed.
 */

export interface RunnerHooks {
  readonly onPilot?: (estimateMs: number, opsPerBatch: number) => void
  readonly onProgress?: (progress: BenchProgress) => void
  readonly onSample?: (configIndex: number, target: 'encrypt' | 'decrypt', sample: BenchSample) => void
  readonly isCancelled?: () => boolean
  readonly yieldToEventLoop?: () => Promise<void>
  readonly now?: () => number
}

const defaultYield = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const defaultNow = (): number => performance.now()

/** Benchmarks never use a user's key. This one is derived from the spec seed and recorded. */
function benchmarkKey(config: Rc5Config, seed: number): Uint8Array {
  return generatePayload(config.b, 'prng', seed ^ 0x5bf03635)
}

export class BenchmarkCancelled extends Error {
  constructor() {
    super('The run was cancelled.')
    this.name = 'BenchmarkCancelled'
  }
}

function validateSpec(spec: BenchSpec): void {
  if (spec.configs.length === 0) {
    throw new Error('A benchmark needs at least one configuration.')
  }
  for (const config of spec.configs) {
    validateConfig(config)
  }
  if (!Number.isInteger(spec.payloadBytes) || spec.payloadBytes < 1) {
    throw new Error('Payload size must be a whole number of bytes, at least 1.')
  }
  if (spec.payloadBytes > BENCH_LIMITS.maxPayloadBytes) {
    throw new Error(
      `Payload size must be at most ${BENCH_LIMITS.maxPayloadBytes} bytes (1 MiB). This run asked for ${spec.payloadBytes}.`,
    )
  }
  if (!Number.isInteger(spec.measuredIterations) || spec.measuredIterations < 1) {
    throw new Error('Measured iterations must be a whole number, at least 1.')
  }
  if (spec.measuredIterations > BENCH_LIMITS.maxMeasuredIterations) {
    throw new Error(
      `Measured iterations must be at most ${BENCH_LIMITS.maxMeasuredIterations.toLocaleString('en-US')}. This run asked for ${spec.measuredIterations.toLocaleString('en-US')}.`,
    )
  }
  if (!Number.isInteger(spec.warmupIterations) || spec.warmupIterations < 0) {
    throw new Error('Warm-up iterations must be a whole number, zero or more.')
  }
  if (spec.warmupIterations > BENCH_LIMITS.maxWarmupIterations) {
    throw new Error(
      `Warm-up iterations must be at most ${BENCH_LIMITS.maxWarmupIterations.toLocaleString('en-US')}. This run asked for ${spec.warmupIterations.toLocaleString('en-US')}.`,
    )
  }
}

interface TimedOpContext {
  readonly w: Rc5Config['w']
  readonly r: number
  readonly src: Uint8Array
  readonly dst: Uint8Array
  readonly schedule: readonly number[] | readonly bigint[]
  readonly key: Uint8Array
  readonly config: Rc5Config
  readonly isEncrypt: boolean
  readonly includeSetup: boolean
}

function timeBatch(count: number, context: TimedOpContext, now: () => number): number {
  const { w, r, src, dst, schedule, isEncrypt, includeSetup, key, config } = context
  const startedAt = now()

  if (includeSetup) {
    for (let i = 0; i < count; i++) {
      const expanded = expandKey(key, config).s
      if (isEncrypt) encryptBuffer(w, src, dst, expanded, r)
      else decryptBuffer(w, src, dst, expanded, r)
    }
  } else {
    for (let i = 0; i < count; i++) {
      if (isEncrypt) encryptBuffer(w, src, dst, schedule, r)
      else decryptBuffer(w, src, dst, schedule, r)
    }
  }

  return elapsedNs(startedAt, now())
}

/**
 * Grow the batch until one batch is long enough to be resolved by the timer, then report the batch
 * size and the per-operation cost it implies.
 */
function calibrateBatch(
  context: TimedOpContext,
  minSampleDurationMs: number,
  maxOpsPerBatch: number,
  now: () => number,
): { opsPerBatch: number; nsPerOp: number; reachedLimit: boolean } {
  let opsPerBatch = 1
  let batchNs = timeBatch(opsPerBatch, context, now)
  const minimumNs = minSampleDurationMs * 1e6

  while (batchNs < minimumNs && opsPerBatch < maxOpsPerBatch) {
    opsPerBatch = Math.min(opsPerBatch * 2, maxOpsPerBatch)
    batchNs = timeBatch(opsPerBatch, context, now)
  }

  if (batchNs <= 0) {
    throw new Error(
      'The timer did not advance during a batch of ' +
        `${opsPerBatch.toLocaleString('en-US')} operations. Timing cannot be trusted in this browser session.`,
    )
  }

  return {
    opsPerBatch,
    nsPerOp: batchNs / opsPerBatch,
    reachedLimit: opsPerBatch >= maxOpsPerBatch && batchNs < minimumNs,
  }
}

/** Measure key expansion on its own, since the steady-state mode excludes it from the main figures. */
function measureKeySetupNs(
  key: Uint8Array,
  config: Rc5Config,
  now: () => number,
  rounds = 200,
): number {
  const startedAt = now()
  for (let i = 0; i < rounds; i++) {
    expandKey(key, config)
  }
  const total = elapsedNs(startedAt, now())
  return total > 0 ? total / rounds : 0
}

function groupWarnings(
  metrics: { cvPercent: number; n: number; minNs: number; medianNs: number },
  implPath: ImplPath,
  opsPerBatch: number,
  reachedLimit: boolean,
  timerResolutionMs: number,
): BenchWarning[] {
  const warnings: BenchWarning[] = []

  if (implPath === 'bigint') {
    warnings.push({
      code: 'bigint-path',
      message:
        'This configuration uses 64-bit words, which are implemented with BigInt arithmetic. The timing measures that path, not the same arithmetic the 16- and 32-bit configurations use, so it is excluded from rankings.',
    })
  }

  if (metrics.cvPercent > 25) {
    warnings.push({
      code: 'noisy',
      message: `Run-to-run variation was ${metrics.cvPercent.toFixed(1)}% of the mean, which is high. Other work on this machine most likely interfered. Repeat the run before drawing a conclusion from it.`,
    })
  }

  if (metrics.n < 30) {
    warnings.push({
      code: 'few-samples',
      message: `Only ${metrics.n} samples were taken, so the p95 figure and the spread are weak. Thirty samples is the minimum for p95 to mean anything here.`,
    })
  }

  if (metrics.minNs > 0 && metrics.medianNs > metrics.minNs * 1.5) {
    warnings.push({
      code: 'high-load',
      message: `The fastest sample was ${(((metrics.medianNs - metrics.minNs) / metrics.minNs) * 100).toFixed(0)}% quicker than the median, which usually means something else was competing for the processor. Treat these timings as a lower bound on the time this machine can achieve.`,
    })
  }

  if (reachedLimit) {
    warnings.push({
      code: 'max-batch-reached',
      message: `A batch of ${opsPerBatch.toLocaleString('en-US')} operations still finished faster than the target sample duration, so the batch size stopped growing. The timings are usable, but the effective timer resolution is coarser than ideal.`,
    })
  }

  if (timerResolutionMs >= 0.05) {
    warnings.push({
      code: 'coarse-timer',
      message: `This browser reports time in steps of about ${timerResolutionMs >= 1 ? `${timerResolutionMs.toFixed(0)} ms` : `${(timerResolutionMs * 1000).toFixed(0)} µs`}. Batching keeps the measurements meaningful; the batch size above is how many operations each sample covers.`,
    })
  }

  return warnings
}

/** A deterministic, reproducible payload of the requested size. */
function payloadFor(spec: BenchSpec): Uint8Array {
  return generatePayload(spec.payloadBytes, spec.pattern, spec.seed)
}

export async function probeBenchmark(spec: BenchSpec, now: () => number = defaultNow): Promise<Omit<BenchProbeResult, 'runId'>> {
  validateSpec(spec)
  const timerResolutionMs = measureTimerResolutionMs()
  const config = spec.configs[0]
  const blockSize = blockSizeBytes(config.w)
  const blocks = blocksFor(spec.payloadBytes, config)
  const bytesProcessed = blocks * blockSize

  const payload = payloadFor(spec)
  const src = new Uint8Array(bytesProcessed)
  src.set(payload.subarray(0, Math.min(payload.length, src.length)))
  const dst = new Uint8Array(bytesProcessed)
  const key = benchmarkKey(config, spec.seed)
  const schedule = expandKey(key, config).s

  const context: TimedOpContext = {
    w: config.w,
    r: config.r,
    src,
    dst,
    schedule,
    key,
    config,
    isEncrypt: true,
    includeSetup: spec.methodology === 'key-setup-included',
  }

  const calibration = calibrateBatch(context, spec.minSampleDurationMs, spec.maxOpsPerBatch, now)
  const groups = spec.configs.length * (spec.target === 'both' ? 2 : 1)
  const operations = (spec.warmupIterations + spec.measuredIterations) * groups
  const estimatedTotalMs = (operations * calibration.nsPerOp) / 1e6

  return {
    estimatedTotalMs,
    opsPerBatch: calibration.opsPerBatch,
    nsPerOp: calibration.nsPerOp,
    timerResolutionMs,
    blocks,
    bytesProcessed,
  }
}

export async function runBenchmark(
  runId: string,
  name: string,
  spec: BenchSpec,
  hooks: RunnerHooks = {},
): Promise<BenchRunResult> {
  validateSpec(spec)

  const now = hooks.now ?? defaultNow
  const yieldToEventLoop = hooks.yieldToEventLoop ?? defaultYield
  const isCancelled = hooks.isCancelled ?? ((): boolean => false)
  const startedAtIso = new Date().toISOString()
  const startedAtMs = Date.now()
  const timerResolutionMs = measureTimerResolutionMs()

  const payload = payloadFor(spec)
  const digest = payloadDigest(payload)
  const targets: Array<'encrypt' | 'decrypt'> =
    spec.target === 'both' ? ['encrypt', 'decrypt'] : [spec.target]

  const groups: BenchGroupResult[] = []
  const runWarnings: BenchWarning[] = []
  let pilotEstimateMs = 0
  let calibrationReported = false

  for (let configIndex = 0; configIndex < spec.configs.length; configIndex++) {
    const config = spec.configs[configIndex]
    const blockSize = blockSizeBytes(config.w)
    const blocks = blocksFor(spec.payloadBytes, config)
    const bytesProcessed = blocks * blockSize
    const key = benchmarkKey(config, spec.seed)
    const schedule = expandKey(key, config).s
    const implPath: ImplPath = config.w === 64 ? 'bigint' : 'number'

    // Input and output buffers are allocated once and reused for every operation.
    const plaintext = new Uint8Array(bytesProcessed)
    plaintext.set(payload.subarray(0, Math.min(payload.length, plaintext.length)))
    const ciphertext = new Uint8Array(bytesProcessed)
    encryptBuffer(config.w, plaintext, ciphertext, schedule, config.r)

    for (const target of targets) {
      const isEncrypt = target === 'encrypt'
      const src = isEncrypt ? plaintext : ciphertext
      const dst = new Uint8Array(bytesProcessed)
      const includeSetup = spec.methodology === 'key-setup-included'

      const context: TimedOpContext = {
        w: config.w,
        r: config.r,
        src,
        dst,
        schedule,
        key,
        config,
        isEncrypt,
        includeSetup,
      }

      hooks.onProgress?.({
        phase: 'prepare',
        configIndex,
        configCount: spec.configs.length,
        target,
        done: 0,
        total: spec.measuredIterations,
      })

      const calibration = calibrateBatch(context, spec.minSampleDurationMs, spec.maxOpsPerBatch, now)

      if (!calibrationReported) {
        calibrationReported = true
        const groups_ = spec.configs.length * targets.length
        const operations = (spec.warmupIterations + spec.measuredIterations) * groups_
        pilotEstimateMs = (operations * calibration.nsPerOp) / 1e6
        hooks.onPilot?.(pilotEstimateMs, calibration.opsPerBatch)
      }

      if (spec.warmupIterations > 0) {
        hooks.onProgress?.({
          phase: 'warmup',
          configIndex,
          configCount: spec.configs.length,
          target,
          done: 0,
          total: spec.warmupIterations,
        })
        timeBatch(spec.warmupIterations, context, now)
      }

      const samples: number[] = []
      let lastEmit = 0

      for (let i = 0; i < spec.measuredIterations; i++) {
        if (isCancelled()) throw new BenchmarkCancelled()

        const batchNs = timeBatch(calibration.opsPerBatch, context, now)
        if (batchNs <= 0) {
          throw new Error(
            `The timer reported no elapsed time for a batch of ${calibration.opsPerBatch.toLocaleString('en-US')} operations. Timing cannot be trusted in this browser session.`,
          )
        }

        const nsPerOp = batchNs / calibration.opsPerBatch
        samples.push(nsPerOp)

        const timestamp = now()
        if (timestamp - lastEmit > 25 || i === spec.measuredIterations - 1) {
          lastEmit = timestamp
          const running = summarize(samples)
          hooks.onSample?.(configIndex, target, {
            index: i,
            nsPerOp,
            opsPerBatch: calibration.opsPerBatch,
            cvPercent: running.cvPercent,
          })
          hooks.onProgress?.({
            phase: 'measure',
            configIndex,
            configCount: spec.configs.length,
            target,
            done: i + 1,
            total: spec.measuredIterations,
          })
          // Yield so a cancel request can be handled while a long run is in progress.
          await yieldToEventLoop()
        }
      }

      // Correctness is checked outside the timed region.
      hooks.onProgress?.({
        phase: 'verify',
        configIndex,
        configCount: spec.configs.length,
        target,
        done: spec.measuredIterations,
        total: spec.measuredIterations,
      })

      let correctnessStatus: BenchGroupResult['correctnessStatus'] = 'not-checked'
      if (isEncrypt) {
        const recovered = new Uint8Array(bytesProcessed)
        decryptBuffer(config.w, dst, recovered, schedule, config.r)
        correctnessStatus = compareBytes(recovered, plaintext).equal ? 'verified' : 'mismatch'
      } else {
        const reencrypted = new Uint8Array(bytesProcessed)
        encryptBuffer(config.w, dst, reencrypted, schedule, config.r)
        correctnessStatus = compareBytes(reencrypted, ciphertext).equal ? 'verified' : 'mismatch'
      }

      const metrics = summarize(samples)
      const groupWarningList = groupWarnings(
        metrics,
        implPath,
        calibration.opsPerBatch,
        calibration.reachedLimit,
        timerResolutionMs,
      )

      if (correctnessStatus === 'mismatch') {
        groupWarningList.push({
          code: 'high-load',
          message:
            'The output of this configuration did not round-trip back to its input. The timings are recorded, but the configuration is reported as incorrect.',
        })
      }

      const group: BenchGroupResult = {
        config,
        implPath,
        target,
        payloadBytes: spec.payloadBytes,
        blocks,
        bytesProcessed,
        opsPerBatch: calibration.opsPerBatch,
        metrics,
        throughputBytesPerSecond: throughputBytesPerSecond(bytesProcessed, metrics.meanNs),
        samplesNs: downsampleForDisplay(samples),
        rawSampleCount: samples.length,
        correctnessStatus,
        warnings: groupWarningList,
        keySetupNs: includeSetup ? null : measureKeySetupNs(key, config, now),
      }

      groups.push(group)
      for (const warning of groupWarningList) {
        if (!runWarnings.some((existing) => existing.code === warning.code)) {
          runWarnings.push(warning)
        }
      }
    }
  }

  const environment = collectEnvironment(startedAtIso)

  if (!environment.crossOriginIsolated) {
    runWarnings.push({
      code: 'cross-origin-isolated',
      message:
        'This page is not cross-origin isolated. Browsers coarsen the clock in that situation (commonly to 100 µs per step), which is why each sample covers many operations. The measured resolution is shown with the results.',
    })
  }

  const processedBytes = groups.reduce((total, group) => total + group.bytesProcessed * group.rawSampleCount, 0)
  if (processedBytes > 4 * 1024 * 1024 * 1024) {
    runWarnings.push({
      code: 'large-workload',
      message: `This run processed ${(processedBytes / (1024 * 1024 * 1024)).toFixed(1)} GiB in total. Long runs are more exposed to thermal throttling and to other work on the machine, so compare them with that in mind.`,
    })
  }

  return {
    runId,
    name,
    spec,
    groups,
    environment,
    startedAt: startedAtIso,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    pilotEstimateMs,
    timerResolutionMs,
    paddingPolicy: spec.padding,
    payloadDigest: digest,
    warnings: runWarnings,
    engineVersion: ENGINE_VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
  }
}
