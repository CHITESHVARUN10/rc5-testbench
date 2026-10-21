import { useCallback, useMemo, useState } from 'react'

import { MAX_BENCH_PAYLOAD_BYTES, PAYLOAD_PRESETS, ROUND_SWEEP_VALUES } from '@/lib/rc5/constants'
import { PAYLOAD_PATTERNS, type PayloadPattern } from '@/lib/benchmark/prepare'
import {
  BENCH_LIMITS,
  type BenchMethodology,
  type BenchSpec,
  type BenchTarget,
} from '@/lib/benchmark/protocol'
import { useSettings } from '@/state/settings.store'

/**
 * The benchmark workload form.
 *
 * The spec is derived from the form rather than stored twice, and `specKey` is a stable string used to
 * debounce the duration probe: changing anything that would change the workload re-probes, and
 * changing nothing does not.
 */

export interface BenchFormState {
  mode: 'single' | 'sweep'
  sweepRounds: number[]
  payloadBytes: number
  pattern: PayloadPattern
  warmupIterations: number
  measuredIterations: number
  target: BenchTarget
  methodology: BenchMethodology
}

export interface BenchForm {
  readonly form: BenchFormState
  readonly spec: BenchSpec
  readonly specKey: string
  readonly setPayloadBytes: (bytes: number) => void
  readonly setPattern: (pattern: PayloadPattern) => void
  readonly setMode: (mode: 'single' | 'sweep') => void
  readonly toggleSweepRound: (rounds: number) => void
  readonly setWarmup: (iterations: number) => void
  readonly setMeasured: (iterations: number) => void
  readonly setTarget: (target: BenchTarget) => void
  readonly setMethodology: (methodology: BenchMethodology) => void
  readonly validationError: string | null
}

export function useBenchForm(): BenchForm {
  const config = useSettings((state) => state.config)
  const padding = useSettings((state) => state.padding)
  const storedPayload = useSettings((state) => state.benchPayloadBytes)
  const storedWarmup = useSettings((state) => state.benchWarmupIterations)
  const storedMeasured = useSettings((state) => state.benchMeasuredIterations)
  const storedTarget = useSettings((state) => state.benchTarget)
  const storedMethodology = useSettings((state) => state.benchMethodology)
  const storedPattern = useSettings((state) => state.benchPattern)
  const setBenchPayloadBytes = useSettings((state) => state.setBenchPayloadBytes)
  const setBenchIterations = useSettings((state) => state.setBenchIterations)
  const setBenchTarget = useSettings((state) => state.setBenchTarget)
  const setBenchMethodology = useSettings((state) => state.setBenchMethodology)
  const setBenchPattern = useSettings((state) => state.setBenchPattern)

  const [mode, setModeState] = useState<'single' | 'sweep'>('single')
  const [sweepRounds, setSweepRounds] = useState<number[]>([8, 12, 16, 20])

  const setPayloadBytes = useCallback(
    (bytes: number) => {
      setBenchPayloadBytes(Math.max(1, Math.min(MAX_BENCH_PAYLOAD_BYTES, Math.round(bytes))))
    },
    [setBenchPayloadBytes],
  )

  const toggleSweepRound = useCallback((rounds: number) => {
    setSweepRounds((current) =>
      current.includes(rounds)
        ? current.filter((value) => value !== rounds)
        : [...current, rounds].sort((a, b) => a - b),
    )
  }, [])

  const validationError = useMemo(() => {
    if (mode === 'sweep' && sweepRounds.length < 2) {
      return 'A sweep needs at least two round counts to compare. Select another, or switch to a single configuration.'
    }
    return null
  }, [mode, sweepRounds])

  const spec = useMemo<BenchSpec>(() => {
    const configs =
      mode === 'sweep'
        ? sweepRounds.map((r) => ({ w: config.w, r, b: config.b }))
        : [config]
    return {
      configs,
      padding,
      payloadBytes: storedPayload,
      pattern: storedPattern,
      seed: 0x9e3779b9,
      warmupIterations: storedWarmup,
      measuredIterations: storedMeasured,
      target: storedTarget,
      methodology: storedMethodology,
      minSampleDurationMs: BENCH_LIMITS.minSampleDurationMs,
      maxOpsPerBatch: BENCH_LIMITS.maxOpsPerBatch,
    }
  }, [
    mode,
    sweepRounds,
    config,
    padding,
    storedPayload,
    storedPattern,
    storedWarmup,
    storedMeasured,
    storedTarget,
    storedMethodology,
  ])

  const specKey = useMemo(() => JSON.stringify(spec), [spec])

  return {
    form: {
      mode,
      sweepRounds,
      payloadBytes: storedPayload,
      pattern: storedPattern,
      warmupIterations: storedWarmup,
      measuredIterations: storedMeasured,
      target: storedTarget,
      methodology: storedMethodology,
    },
    spec,
    specKey,
    setPayloadBytes,
    setPattern: setBenchPattern,
    setMode: setModeState,
    toggleSweepRound,
    setWarmup: (iterations) => setBenchIterations(storedMeasured, iterations),
    setMeasured: (iterations) => setBenchIterations(iterations, storedWarmup),
    setTarget: setBenchTarget,
    setMethodology: setBenchMethodology,
    validationError,
  }
}

export { PAYLOAD_PRESETS, PAYLOAD_PATTERNS, ROUND_SWEEP_VALUES }
