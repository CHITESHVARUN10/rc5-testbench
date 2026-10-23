import { describe, expect, it } from 'vitest'

import { collectEnvironment, describeBrowser, describeOs } from '../env'
import type { Rc5Config } from '../rc5/types'
import { generatePayload, payloadDigest } from './prepare'
import type { BenchSpec } from './protocol'
import { BENCH_LIMITS } from './protocol'
import { BenchmarkCancelled, runBenchmark } from './runner'
import {
  downsampleForDisplay,
  elapsedNs,
  percentile,
  sortAscending,
  summarize,
  throughputBytesPerSecond,
} from './stats'

/* ------------------------------------------------------------------ statistics */

describe('timing statistics', () => {
  it('computes the documented summary for a known sample set', () => {
    const summary = summarize([4, 1, 3, 2])
    expect(summary.n).toBe(4)
    expect(summary.meanNs).toBe(2.5)
    expect(summary.medianNs).toBe(2.5)
    expect(summary.minNs).toBe(1)
    expect(summary.maxNs).toBe(4)
    expect(summary.stdDevNs).toBeCloseTo(Math.sqrt(5 / 3), 10)
    expect(summary.cvPercent).toBeCloseTo((Math.sqrt(5 / 3) / 2.5) * 100, 10)
  })

  it('takes the middle value for an odd count', () => {
    expect(summarize([5, 1, 9]).medianNs).toBe(5)
    expect(summarize([1]).medianNs).toBe(1)
    expect(summarize([1]).stdDevNs).toBe(0)
  })

  it('uses the nearest-rank definition for p95 and the quartiles', () => {
    const samples = Array.from({ length: 100 }, (_, index) => index + 1)
    expect(percentile(sortAscending(samples), 0.95)).toBe(95)
    expect(percentile(sortAscending(samples), 0.5)).toBe(50)
    expect(percentile(sortAscending(samples), 0.25)).toBe(25)
    expect(percentile(sortAscending(samples), 0.75)).toBe(75)
    const nineteen = Array.from({ length: 19 }, (_, index) => index + 1)
    expect(percentile(sortAscending(nineteen), 0.95)).toBe(19)
  })

  it('refuses to summarize nothing', () => {
    expect(() => summarize([])).toThrowError(/empty sample set/)
  })

  it('converts elapsed time and rejects clock anomalies', () => {
    expect(elapsedNs(0, 5)).toBe(5_000_000)
    expect(elapsedNs(10, 10)).toBe(0)
    expect(elapsedNs(10, 9)).toBe(0)
    expect(elapsedNs(0, Number.NaN)).toBe(0)
  })

  it('computes throughput from bytes and nanoseconds', () => {
    expect(throughputBytesPerSecond(1000, 1e6)).toBeCloseTo(1_000_000, 6)
    expect(throughputBytesPerSecond(64 * 1024, 1e9)).toBeCloseTo((64 * 1024) / 1, 6)
    expect(throughputBytesPerSecond(1000, 0)).toBe(0)
    expect(throughputBytesPerSecond(1000, -5)).toBe(0)
  })

  it('keeps the shape of a long sample list when downsampling', () => {
    const samples = Array.from({ length: 1000 }, (_, index) => index + 1)
    const reduced = downsampleForDisplay(samples, 100)
    expect(reduced.length).toBe(100)
    expect(reduced[0]).toBe(1)
    expect(reduced[reduced.length - 1]).toBe(1000)
    expect(reduced.length).toBeLessThanOrEqual(100)
    expect(downsampleForDisplay([3, 1, 2]).length).toBe(3)
  })
})

/* ------------------------------------------------------------------ payloads */

describe('deterministic payloads', () => {
  it('reproduces the same bytes for the same seed and differs for another', () => {
    const first = generatePayload(128, 'prng', 7)
    const second = generatePayload(128, 'prng', 7)
    const other = generatePayload(128, 'prng', 8)
    expect(Array.from(first)).toEqual(Array.from(second))
    expect(Array.from(first)).not.toEqual(Array.from(other))
  })

  it('produces each named pattern as described', () => {
    expect(Array.from(generatePayload(4, 'zeros'))).toEqual([0, 0, 0, 0])
    expect(Array.from(generatePayload(4, 'ascending'))).toEqual([0, 1, 2, 3])
    expect(Array.from(generatePayload(8, 'counter'))).toEqual([0, 0, 0, 0, 1, 1, 1, 1])
  })

  it('mixes the pseudo-random pattern rather than repeating a small cycle', () => {
    const bytes = generatePayload(4096, 'prng', 3)
    const distinct = new Set(bytes)
    expect(distinct.size).toBeGreaterThan(200)
    expect(new Set(Array.from(bytes.subarray(0, 64))).size).toBeGreaterThan(40)
  })

  it('digests a payload reproducibly', () => {
    const digest = payloadDigest(generatePayload(64, 'prng', 1))
    expect(digest).toMatch(/^[0-9a-f]{8}$/)
    expect(digest).toBe(payloadDigest(generatePayload(64, 'prng', 1)))
    expect(digest).not.toBe(payloadDigest(generatePayload(64, 'prng', 2)))
  })
})

/* ------------------------------------------------------------------ environment */

describe('environment reporting', () => {
  it('names the browser even when the user agent claims otherwise', () => {
    const chromeish =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
    expect(describeBrowser(chromeish)).toBe('Chromium-based 141')
    expect(describeBrowser(`${chromeish} Edg/141.0.0.0`)).toBe('Edge 141')
    expect(describeBrowser(`${chromeish} OPR/115.0.0.0`)).toBe('Opera 115')
    expect(
      describeBrowser('Mozilla/5.0 (Windows NT 10.0; rv:133.0) Gecko/20100101 Firefox/133.0'),
    ).toBe('Firefox 133')
    expect(
      describeBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
      ),
    ).toBe('Safari 18')
    expect(describeBrowser('SomethingElse/1.0')).toBe('Unrecognised browser')
  })

  it('prefers the platform hint and falls back to parsing', () => {
    expect(describeOs('', 'macOS')).toBe('macOS')
    expect(describeOs('', 'Windows')).toBe('Windows')
    expect(
      describeOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', null),
    ).toBe('macOS')
    expect(describeOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', null)).toBe('Windows 10 or 11')
    expect(describeOs('Mozilla/5.0 (Windows NT 6.3; Win64; x64)', null)).toBe('Windows 8.1')
    expect(describeOs('Mozilla/5.0 (Linux; Android 15; Pixel 8)', null)).toBe('Android 15')
    expect(describeOs('Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X)', null)).toBe(
      'iOS or iPadOS',
    )
    expect(describeOs('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)', null)).toBe('ChromeOS')
    expect(describeOs('Mozilla/5.0 (X11; Linux x86_64)', null)).toBe('Linux')
    expect(describeOs('SomethingElse', null)).toBe('Unrecognised system')
  })

  it('collects a timestamped environment record', () => {
    const environment = collectEnvironment('2026-10-13T00:00:00.000Z')
    expect(environment.runtime).toBe('browser')
    expect(environment.timestamp).toBe('2026-10-13T00:00:00.000Z')
    expect(typeof environment.userAgent).toBe('string')
    expect(typeof environment.crossOriginIsolated).toBe('boolean')
  })
})

/* ------------------------------------------------------------------ runner */

function specWith(overrides: Partial<BenchSpec> = {}): BenchSpec {
  return {
    configs: [{ w: 32, r: 12, b: 16 }],
    padding: 'pkcs7',
    payloadBytes: 64,
    pattern: 'prng',
    seed: 0x9e3779b9,
    warmupIterations: 0,
    measuredIterations: 5,
    target: 'both',
    methodology: 'steady-state',
    minSampleDurationMs: 0.05,
    maxOpsPerBatch: 1 << 16,
    ...overrides,
  }
}

describe('benchmark runner', () => {
  it('measures both directions and verifies the output', async () => {
    const result = await runBenchmark('run-1', 'Smoke run', specWith(), { yieldToEventLoop: async () => {} })

    expect(result.runId).toBe('run-1')
    expect(result.name).toBe('Smoke run')
    expect(result.groups.length).toBe(2)
    expect(result.groups.map((group) => group.target)).toEqual(['encrypt', 'decrypt'])
    expect(result.groups[0].blocks).toBe(8)
    expect(result.groups[0].bytesProcessed).toBe(64)
    expect(result.payloadDigest).toMatch(/^[0-9a-f]{8}$/)
    expect(result.engineVersion).toBeTruthy()
    expect(result.methodologyVersion).toBeTruthy()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.pilotEstimateMs).toBeGreaterThan(0)
    expect(result.timerResolutionMs).toBeGreaterThanOrEqual(0)

    for (const group of result.groups) {
      expect(group.metrics.n).toBe(5)
      expect(group.correctnessStatus).toBe('verified')
      expect(group.rawSampleCount).toBe(5)
      expect(group.samplesNs.length).toBe(5)
      expect(group.metrics.medianNs).toBeGreaterThan(0)
      expect(group.metrics.meanNs).toBeGreaterThan(0)
      expect(group.metrics.minNs).toBeLessThanOrEqual(group.metrics.maxNs)
      expect(group.throughputBytesPerSecond).toBeGreaterThan(0)
      expect(group.opsPerBatch).toBeGreaterThanOrEqual(1)
      expect(group.implPath).toBe('number')
    }
  })

  it('measures the key schedule separately in steady-state mode and folds it in otherwise', async () => {
    const steady = await runBenchmark('run-2', 'Steady', specWith({ target: 'encrypt' }), {
      yieldToEventLoop: async () => {},
    })
    expect(steady.groups[0].keySetupNs).toBeGreaterThan(0)

    const including = await runBenchmark(
      'run-3',
      'Cipher call',
      specWith({ target: 'encrypt', methodology: 'key-setup-included' }),
      { yieldToEventLoop: async () => {} },
    )
    expect(including.groups[0].keySetupNs).toBeNull()
  })

  it('runs a rounds sweep across several configurations', async () => {
    const configs: Rc5Config[] = [8, 12, 16].map((r) => ({ w: 32, r, b: 16 }))
    const result = await runBenchmark(
      'run-4',
      'Rounds sweep',
      specWith({ configs, target: 'encrypt', measuredIterations: 3 }),
      { yieldToEventLoop: async () => {} },
    )
    expect(result.groups.length).toBe(3)
    expect(result.groups.map((group) => group.config.r)).toEqual([8, 12, 16])
    for (const group of result.groups) {
      expect(group.correctnessStatus).toBe('verified')
    }
  })

  it('flags the BigInt path, whose timings are not comparable', async () => {
    const result = await runBenchmark(
      'run-5',
      'Wide words',
      specWith({ configs: [{ w: 64, r: 12, b: 16 }], target: 'encrypt', measuredIterations: 3 }),
      { yieldToEventLoop: async () => {} },
    )
    const group = result.groups[0]
    expect(group.implPath).toBe('bigint')
    expect(group.correctnessStatus).toBe('verified')
    expect(group.warnings.some((warning) => warning.code === 'bigint-path')).toBe(true)
  })

  it('warns when a run has too few samples for p95', async () => {
    const result = await runBenchmark('run-6', 'Sparse', specWith({ target: 'encrypt', measuredIterations: 4 }), {
      yieldToEventLoop: async () => {},
    })
    expect(result.groups[0].warnings.some((warning) => warning.code === 'few-samples')).toBe(true)
  })

  it('stops when cancelled and reports it as a cancellation, not a result', async () => {
    let checks = 0
    const promise = runBenchmark('run-7', 'Cancelled', specWith({ measuredIterations: 500 }), {
      isCancelled: () => {
        checks += 1
        return checks > 2
      },
      yieldToEventLoop: async () => {},
    })
    await expect(promise).rejects.toBeInstanceOf(BenchmarkCancelled)
  })

  it('reports progress as the run advances', async () => {
    const phases = new Set<string>()
    let samples = 0
    await runBenchmark('run-8', 'Progress', specWith({ measuredIterations: 6 }), {
      onProgress: (progress) => phases.add(progress.phase),
      onSample: () => {
        samples += 1
      },
      yieldToEventLoop: async () => {},
    })
    expect(phases.has('prepare')).toBe(true)
    expect(phases.has('measure')).toBe(true)
    expect(phases.has('verify')).toBe(true)
    expect(samples).toBeGreaterThan(0)
  })

  it('rejects specifications it cannot honour, with a reason', async () => {
    await expect(
      runBenchmark('run-9', 'Too big', specWith({ payloadBytes: BENCH_LIMITS.maxPayloadBytes + 1 })),
    ).rejects.toThrowError(/at most 1048576 bytes/)

    await expect(
      runBenchmark('run-10', 'Too many', specWith({ measuredIterations: BENCH_LIMITS.maxMeasuredIterations + 1 })),
    ).rejects.toThrowError(/Measured iterations must be at most/)

    await expect(runBenchmark('run-11', 'No config', specWith({ configs: [] }))).rejects.toThrowError(
      /at least one configuration/,
    )

    await expect(
      runBenchmark('run-12', 'Bad rounds', specWith({ configs: [{ w: 32, r: 99, b: 16 }] })),
    ).rejects.toThrowError(/Rounds must be a whole number/)

    await expect(runBenchmark('run-13', 'Bad size', specWith({ payloadBytes: 0 }))).rejects.toThrowError(
      /at least 1/,
    )
  })
})
