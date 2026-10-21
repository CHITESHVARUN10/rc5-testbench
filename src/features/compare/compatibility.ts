import type { BenchMethodology } from '@/lib/benchmark/protocol'
import type { ImplPath } from '@/lib/rc5/types'
import type { SavedResult, SavedRun } from '@/lib/storage/experiments'
import { formatByteCount } from '@/lib/format'

/**
 * Comparability.
 *
 * Two measurements can only be ranked against each other when the things that change what is being
 * measured are the same: payload size, direction, whether the key schedule was inside the timed
 * region, and which arithmetic path ran. Everything else — a different payload, a different
 * methodology — means the numbers describe different work, and putting them in the same ranking is the
 * mistake this module exists to prevent.
 *
 * Incompatible results are never hidden. They stay visible with their absolute values and are excluded
 * from every ranking and interpretation, with the reason stated.
 */

export interface ResultEntry {
  readonly run: SavedRun
  readonly result: SavedResult
}

export interface ComparabilitySignature {
  readonly payloadBytes: number
  readonly methodology: BenchMethodology
  readonly implPath: ImplPath
  readonly target: 'encrypt' | 'decrypt'
}

export function signatureOf(entry: ResultEntry): ComparabilitySignature {
  return {
    payloadBytes: entry.run.payloadBytes,
    methodology: entry.run.methodology,
    implPath: entry.result.implPath,
    target: entry.result.target,
  }
}

export function signatureKey(signature: ComparabilitySignature): string {
  return [
    signature.payloadBytes,
    signature.methodology,
    signature.implPath,
    signature.target,
  ].join('|')
}

export function describeSignature(signature: ComparabilitySignature): string {
  const method =
    signature.methodology === 'steady-state' ? 'steady state' : 'key schedule included'
  const path = signature.implPath === 'bigint' ? 'BigInt arithmetic' : 'integer arithmetic'
  return `${formatByteCount(signature.payloadBytes)} · ${signature.target} · ${method} · ${path}`
}

function methodWord(methodology: BenchMethodology): string {
  return methodology === 'steady-state'
    ? 'the key schedule was excluded from the timed region'
    : 'the key schedule was included in each timed operation'
}

/** Plain-language reasons two signatures cannot be ranked together. */
export function differenceBetween(
  primary: ComparabilitySignature,
  other: ComparabilitySignature,
): string[] {
  const reasons: string[] = []
  if (primary.payloadBytes !== other.payloadBytes) {
    reasons.push(
      `payload size (${formatByteCount(primary.payloadBytes)} against ${formatByteCount(other.payloadBytes)})`,
    )
  }
  if (primary.target !== other.target) {
    reasons.push(`direction (${primary.target} against ${other.target})`)
  }
  if (primary.methodology !== other.methodology) {
    reasons.push(
      `methodology (${methodWord(primary.methodology)} against ${methodWord(other.methodology)})`,
    )
  }
  if (primary.implPath !== other.implPath) {
    reasons.push(
      `arithmetic path (${primary.implPath === 'bigint' ? 'BigInt' : 'integer'} against ${other.implPath === 'bigint' ? 'BigInt' : 'integer'})`,
    )
  }
  return reasons
}

export interface ComparabilityGroup {
  readonly signature: ComparabilitySignature
  readonly entries: ResultEntry[]
}

export interface ComparabilityReport {
  readonly groups: readonly ComparabilityGroup[]
  /** The largest compatible set: the results that may be ranked and interpreted together. */
  readonly ranked: ResultEntry[]
  readonly rankedSignature: ComparabilitySignature | null
  readonly excluded: ResultEntry[]
  /** Distinct reasons results were kept out of the ranking. */
  readonly differences: readonly string[]
}

export function analyseComparability(entries: readonly ResultEntry[]): ComparabilityReport {
  const buckets = new Map<string, ComparabilityGroup>()

  for (const entry of entries) {
    const signature = signatureOf(entry)
    const key = signatureKey(signature)
    const existing = buckets.get(key)
    if (existing) {
      existing.entries.push(entry)
    } else {
      buckets.set(key, { signature, entries: [entry] })
    }
  }

  const groups = Array.from(buckets.values()).sort((a, b) => b.entries.length - a.entries.length)
  const primary = groups[0] ?? null
  const excluded = groups.slice(1).flatMap((group) => group.entries)

  const differences: string[] = []
  if (primary) {
    for (const group of groups.slice(1)) {
      for (const reason of differenceBetween(primary.signature, group.signature)) {
        if (!differences.includes(reason)) differences.push(reason)
      }
    }
  }

  return {
    groups,
    ranked: primary?.entries ?? [],
    rankedSignature: primary?.signature ?? null,
    excluded,
    differences,
  }
}

/** Rows in a comparison table, sorted by the chosen metric. */
export type CompareSortKey = 'config' | 'median' | 'throughput' | 'rounds' | 'keyLength' | 'payload'

export function sortEntries(
  entries: readonly ResultEntry[],
  key: CompareSortKey,
  direction: 'asc' | 'desc',
): ResultEntry[] {
  const factor = direction === 'asc' ? 1 : -1
  const sorted = entries.slice().sort((a, b) => {
    switch (key) {
      case 'median':
        return (a.result.metrics.medianNs - b.result.metrics.medianNs) * factor
      case 'throughput':
        return (a.result.throughputBytesPerSecond - b.result.throughputBytesPerSecond) * factor
      case 'rounds':
        return (a.result.config.r - b.result.config.r) * factor
      case 'keyLength':
        return (a.result.config.b - b.result.config.b) * factor
      case 'payload':
        return (a.run.payloadBytes - b.run.payloadBytes) * factor
      case 'config':
        return (
          (a.result.config.w - b.result.config.w ||
            a.result.config.r - b.result.config.r ||
            a.result.config.b - b.result.config.b) * factor
        )
    }
  })
  return sorted
}

/** Distinct payload sizes present in a set of results, ascending. */
export function payloadSizesIn(entries: readonly ResultEntry[]): number[] {
  return Array.from(new Set(entries.map((entry) => entry.run.payloadBytes))).sort((a, b) => a - b)
}
