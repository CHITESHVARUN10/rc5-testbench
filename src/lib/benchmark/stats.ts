/**
 * Timing statistics.
 *
 * Every definition here is the one shown in the interface and in exported reports, so the numbers can
 * be reproduced by hand from the sample list:
 *
 *   mean      arithmetic mean of the samples
 *   median    middle value, or the mean of the two middle values for an even count
 *   std dev   sample standard deviation, n - 1 denominator
 *   p95       nearest-rank: the sample at position ceil(0.95 · n) in ascending order
 *   CV        std dev / mean, as a percentage; the measure that decides whether a difference
 *             between two configurations is larger than the noise in the measurements themselves
 *
 * Samples are per-operation latencies in nanoseconds. A batch sample is the elapsed time of a batch
 * divided by the number of operations in it, which is how a browser timer with coarse resolution is
 * still able to measure sub-microsecond work: see runner.ts.
 */

export interface TimingSummary {
  readonly n: number
  readonly meanNs: number
  readonly medianNs: number
  readonly minNs: number
  readonly maxNs: number
  readonly stdDevNs: number
  readonly p95Ns: number
  readonly q1Ns: number
  readonly q3Ns: number
  readonly cvPercent: number
}

export function isUsableSample(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/** Nearest-rank percentile on an ascending-sorted array. p is a fraction in [0, 1]. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN
  const rank = Math.ceil(p * sorted.length)
  const index = Math.min(Math.max(rank, 1), sorted.length) - 1
  return sorted[index]
}

export function sortAscending(samples: readonly number[]): number[] {
  return [...samples].sort((a, b) => a - b)
}

export function summarize(samples: readonly number[]): TimingSummary {
  if (samples.length === 0) {
    throw new Error('Cannot summarize an empty sample set.')
  }

  const sorted = sortAscending(samples)
  const n = sorted.length

  let total = 0
  for (let i = 0; i < n; i++) total += sorted[i]
  const meanNs = total / n

  let variance = 0
  if (n > 1) {
    let sumSquares = 0
    for (let i = 0; i < n; i++) {
      const delta = sorted[i] - meanNs
      sumSquares += delta * delta
    }
    variance = sumSquares / (n - 1)
  }
  const stdDevNs = Math.sqrt(variance)

  const middle = n >> 1
  const medianNs = n % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2

  return {
    n,
    meanNs,
    medianNs,
    minNs: sorted[0],
    maxNs: sorted[n - 1],
    stdDevNs,
    p95Ns: percentile(sorted, 0.95),
    q1Ns: percentile(sorted, 0.25),
    q3Ns: percentile(sorted, 0.75),
    cvPercent: meanNs > 0 ? (stdDevNs / meanNs) * 100 : 0,
  }
}

/** Throughput from bytes processed and total elapsed nanoseconds. */
export function throughputBytesPerSecond(bytesProcessed: number, totalNs: number): number {
  if (totalNs <= 0) return 0
  return bytesProcessed / (totalNs / 1e9)
}

/** Elapsed nanoseconds between two monotonic readings, rejecting clock anomalies. */
export function elapsedNs(startedAt: number, finishedAt: number): number {
  const deltaMs = finishedAt - startedAt
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0
  return deltaMs * 1e6
}

/**
 * Reduce a long sample list to at most `limit` values for display, keeping the shape of the
 * distribution: the retained samples are taken at even intervals across the sorted list, so the
 * minimum, median, p95 and maximum survive.
 */
export function downsampleForDisplay(samples: readonly number[], limit = 400): number[] {
  if (samples.length <= limit) return [...samples]
  const sorted = sortAscending(samples)
  const out: number[] = []
  const step = (sorted.length - 1) / (limit - 1)
  for (let i = 0; i < limit; i++) {
    out.push(sorted[Math.round(i * step)])
  }
  return out
}
