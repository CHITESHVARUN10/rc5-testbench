import { formatConfigLabel, formatLatency, formatThroughput } from '../format'
import type { BenchGroupResult } from './protocol'

/**
 * Turns measured results into sentences.
 *
 * Two rules shape every line this module can produce:
 *
 *   1. A difference is only called a difference when it is larger than the variation the
 *      measurements themselves showed. Comparing two medians and declaring a winner is the most
 *      common way a benchmark misleads, so the coefficient of variation decides whether a ranking
 *      is stated at all.
 *   2. Timing never becomes a statement about security. No line here says a configuration is safe,
 *      stronger, or suitable; the fastest one is only described as the fastest one measured.
 *
 * The module is pure, so every sentence it can emit is covered by tests.
 */

export type InterpretationKind = 'finding' | 'variability' | 'caveat' | 'insufficient' | 'exclusion'

export interface InterpretationLine {
  readonly kind: InterpretationKind
  readonly text: string
}

const STANDING_CAVEATS: readonly string[] = [
  'These figures describe this browser on this machine, at the payload size measured. They do not predict how the same configuration would perform on a microcontroller or a server.',
  'Timing measures computation, not strength. The quicker configuration in this comparison is not the safer one, and no configuration here is being recommended for protecting real data.',
]

/** 64-bit words use BigInt arithmetic, whose timings are not comparable with the 16- and 32-bit paths. */
export function isRankEligible(group: BenchGroupResult): boolean {
  return group.implPath === 'number'
}

export function rankByMedian(groups: readonly BenchGroupResult[]): BenchGroupResult[] {
  return groups.filter(isRankEligible).slice().sort((a, b) => a.metrics.medianNs - b.metrics.medianNs)
}

function targetNoun(target: 'encrypt' | 'decrypt'): string {
  return target === 'encrypt' ? 'encryption' : 'decryption'
}

function percentDifference(from: number, to: number): number {
  if (from <= 0) return 0
  return ((to - from) / from) * 100
}

function describeGroupsForTarget(
  groups: readonly BenchGroupResult[],
  target: 'encrypt' | 'decrypt',
): InterpretationLine[] {
  const lines: InterpretationLine[] = []
  const forTarget = groups.filter((group) => group.target === target)
  const eligible = rankByMedian(forTarget)
  const noun = targetNoun(target)

  if (eligible.length === 0) {
    return lines
  }

  if (eligible.length === 1) {
    const only = eligible[0]
    lines.push({
      kind: 'insufficient',
      text: `Only one configuration is selected, so there is nothing to rank. ${formatConfigLabel(only.config)} took ${formatLatency(only.metrics.medianNs)} at the median for ${noun}, and it moved ${formatThroughput(only.throughputBytesPerSecond)}.`,
    })
    return lines
  }

  const fastest = eligible[0]
  const second = eligible[1]
  const gap = Math.abs(percentDifference(fastest.metrics.medianNs, second.metrics.medianNs))
  const noise = Math.max(fastest.metrics.cvPercent, second.metrics.cvPercent)

  lines.push({
    kind: 'finding',
    text: `${formatConfigLabel(fastest.config)} had the lowest median ${noun} time in this test: ${formatLatency(fastest.metrics.medianNs)}, against ${formatLatency(second.metrics.medianNs)} for ${formatConfigLabel(second.config)}.`,
  })

  if (gap <= noise) {
    lines.push({
      kind: 'variability',
      text: `That gap is ${gap.toFixed(1)}%, which is no larger than the variation these two runs showed on their own (up to ${noise.toFixed(1)}%). This test does not establish which of them is quicker; repeat it with more iterations before drawing that conclusion.`,
    })
  } else {
    lines.push({
      kind: 'finding',
      text: `${formatConfigLabel(fastest.config)} came out ${gap.toFixed(1)}% quicker than ${formatConfigLabel(second.config)} at the median, and that gap is wider than the variation either run showed (up to ${noise.toFixed(1)}%).`,
    })
  }

  if (fastest.metrics.cvPercent > 25) {
    lines.push({
      kind: 'variability',
      text: `Even the quickest configuration varied by ${fastest.metrics.cvPercent.toFixed(1)}% between samples, which is a lot. Something else on this machine was competing for the processor during the run.`,
    })
  }

  lines.push({
    kind: 'finding',
    text: `${formatConfigLabel(fastest.config)} processed ${formatThroughput(fastest.throughputBytesPerSecond)} at a ${fastest.payloadBytes.toLocaleString('en-US')} byte payload, where one sample covered ${fastest.opsPerBatch.toLocaleString('en-US')} operation${fastest.opsPerBatch === 1 ? '' : 's'}.`,
  })

  return lines
}

/** Rounds sweep: every group shares a word size and key length but differs in round count. */
function describeRoundsSweep(groups: readonly BenchGroupResult[]): InterpretationLine[] {
  const eligible = groups.filter(isRankEligible)
  if (eligible.length < 2) return []

  const wordSizes = new Set(eligible.map((group) => group.config.w))
  const keyLengths = new Set(eligible.map((group) => group.config.b))
  const roundCounts = new Set(eligible.map((group) => group.config.r))
  if (wordSizes.size !== 1 || keyLengths.size !== 1 || roundCounts.size < 2) return []

  const target = eligible[0].target
  if (eligible.some((group) => group.target !== target)) return []

  const ordered = eligible.slice().sort((a, b) => a.config.r - b.config.r)
  const increasing = ordered.every(
    (group, index) => index === 0 || group.metrics.medianNs >= ordered[index - 1].metrics.medianNs,
  )

  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  const change = percentDifference(first.metrics.medianNs, last.metrics.medianNs)

  if (increasing) {
    return [
      {
        kind: 'finding',
        text: `Median ${targetNoun(target)} time rose with the round count, from ${formatLatency(first.metrics.medianNs)} at ${first.config.r} rounds to ${formatLatency(last.metrics.medianNs)} at ${last.config.r} rounds (${change >= 0 ? '+' : ''}${change.toFixed(1)}%). Each round adds work to every block, which is what this sweep shows.`,
      },
    ]
  }

  return [
    {
      kind: 'variability',
      text: `Median time did not rise steadily with the round count in this sweep, which usually means the run was too short or too noisy to resolve the difference. Repeat it with more iterations.`,
    },
  ]
}

export function interpretGroups(groups: readonly BenchGroupResult[]): InterpretationLine[] {
  if (groups.length === 0) {
    return [{ kind: 'insufficient', text: 'No measurements selected yet.' }]
  }

  const lines: InterpretationLine[] = []
  const targets = Array.from(new Set(groups.map((group) => group.target)))
  const sweepLines = describeRoundsSweep(groups)
  const isSweep = sweepLines.length > 0

  for (const target of targets) {
    lines.push(...describeGroupsForTarget(groups, target))
  }

  if (isSweep) {
    lines.push(...sweepLines)
  }

  const excluded = groups.filter((group) => !isRankEligible(group))
  if (excluded.length > 0) {
    const labels = Array.from(new Set(excluded.map((group) => formatConfigLabel(group.config)))).join(', ')
    lines.push({
      kind: 'exclusion',
      text: `${labels} use 64-bit words, which this implementation computes with BigInt. That arithmetic costs far more than the equivalent integer work, so its timings are shown but kept out of every ranking above.`,
    })
  }

  for (const caveat of STANDING_CAVEATS) {
    lines.push({ kind: 'caveat', text: caveat })
  }

  return lines
}
