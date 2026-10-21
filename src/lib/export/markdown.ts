import { interpretGroups } from '../benchmark/interpret'
import type { BenchGroupResult } from '../benchmark/protocol'
import { BENCH_METHODOLOGY_LABELS } from '../benchmark/protocol'
import { PAYLOAD_PATTERN_LABELS } from '../benchmark/prepare'
import { blockSizeBytes, PADDING_LABELS } from '../rc5/constants'
import type { SavedResult, SavedRun } from '../storage/experiments'
import { formatByteCount, formatConfigLabel, formatLatency, formatPercent, formatTimestamp, formatThroughput } from '../format'
import { APP_VERSION, ENGINE_VERSION, METHODOLOGY_VERSION, SCHEMA_VERSION } from '../versions'

/**
 * Markdown report.
 *
 * Follows the twelve-part structure an academic write-up is expected to have, and fills in only what
 * the measurements can actually support. Two sections — the objective and the hypothesis — are left as
 * prompts rather than generated, because inventing a research question on the author's behalf would
 * make the report dishonest, and those are the two places a reader is meant to recognise their own
 * intent.
 */

function toGroup(result: SavedResult): BenchGroupResult {
  return {
    config: result.config,
    implPath: result.implPath,
    target: result.target,
    payloadBytes: result.payloadBytes,
    blocks: result.blocks,
    bytesProcessed: result.bytesProcessed,
    opsPerBatch: result.opsPerBatch,
    metrics: result.metrics,
    throughputBytesPerSecond: result.throughputBytesPerSecond,
    samplesNs: result.samplesNs,
    rawSampleCount: result.rawSampleCount,
    correctnessStatus: result.correctnessStatus,
    warnings: result.warnings,
    keySetupNs: result.keySetupNs,
  }
}

function resultTable(run: SavedRun): string {
  const header =
    '| Configuration | Direction | Payload | Mean | Median | Min | Max | p95 | Spread | Throughput | Round trip |'
  const divider = '|---|---|---|---|---|---|---|---|---|---|---|'
  const rows = run.results.map((result) =>
    [
      formatConfigLabel(result.config),
      result.target,
      formatByteCount(run.payloadBytes),
      formatLatency(result.metrics.meanNs),
      formatLatency(result.metrics.medianNs),
      formatLatency(result.metrics.minNs),
      formatLatency(result.metrics.maxNs),
      formatLatency(result.metrics.p95Ns),
      formatPercent(result.metrics.cvPercent),
      formatThroughput(result.throughputBytesPerSecond),
      result.correctnessStatus,
    ].join(' | '),
  )
  return [header, divider, ...rows.map((row) => `| ${row} |`)].join('\n')
}

function statisticsTable(run: SavedRun): string {
  const header = '| Configuration | Direction | n | Q1 | Median | Q3 | p95 | Std dev | CV |'
  const divider = '|---|---|---|---|---|---|---|---|---|'
  const rows = run.results.map((result) =>
    [
      formatConfigLabel(result.config),
      result.target,
      String(result.metrics.n),
      formatLatency(result.metrics.q1Ns),
      formatLatency(result.metrics.medianNs),
      formatLatency(result.metrics.q3Ns),
      formatLatency(result.metrics.p95Ns),
      formatLatency(result.metrics.stdDevNs),
      formatPercent(result.metrics.cvPercent),
    ].join(' | '),
  )
  return [header, divider, ...rows.map((row) => `| ${row} |`)].join('\n')
}

export interface MarkdownOptions {
  readonly objective?: string
  readonly hypothesis?: string
}

export function runToMarkdown(run: SavedRun, options: MarkdownOptions = {}): string {
  const interpretation = interpretGroups(run.results.map(toGroup))
  const configs = Array.from(
    new Map(
      run.results.map((result) => [formatConfigLabel(result.config), result]),
    ).values(),
  )

  const lines: string[] = []

  lines.push(`# ${run.name}`)
  lines.push('')
  lines.push(
    `*Recorded ${formatTimestamp(run.createdAt)} · RC5 CipherLab ${APP_VERSION} · engine ${ENGINE_VERSION} · methodology ${METHODOLOGY_VERSION} · schema ${SCHEMA_VERSION}*`,
  )
  lines.push('')

  lines.push('## 1. Objective')
  lines.push('')
  lines.push(
    options.objective?.trim() ||
      '> **State the objective here.** This report measures the RC5 implementation in a browser at the workload recorded below. Nothing in the measurements establishes that any configuration is suitable for protecting real data.',
  )
  lines.push('')

  lines.push('## 2. Research question or hypothesis')
  lines.push('')
  lines.push(
    options.hypothesis?.trim() ||
      '> **State the hypothesis here before reading the results.** It is deliberately not generated: a hypothesis written after the measurements is not a hypothesis.',
  )
  lines.push('')

  lines.push('## 3. RC5 parameters and padding policy')
  lines.push('')
  lines.push('| Configuration | Word size | Rounds | Key length | Block size | Padding | Arithmetic |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const result of configs) {
    lines.push(
      `| ${formatConfigLabel(result.config)} | ${result.config.w} bit | ${result.config.r} | ${result.config.b} B | ${blockSizeBytes(result.config.w)} B | ${PADDING_LABELS[run.paddingPolicy]} | ${result.implPath === 'bigint' ? 'BigInt (reference only)' : 'integer'} |`,
    )
  }
  lines.push('')
  if (run.results.some((result) => result.implPath === 'bigint')) {
    lines.push(
      'The 64-bit configuration uses arbitrary-precision arithmetic, which costs far more than the integer path used at 16 and 32 bits. Its timings are not comparable with the others and it is excluded from rankings in the application.',
    )
    lines.push('')
  }

  lines.push('## 4. Test payloads and key setup methodology')
  lines.push('')
  lines.push(`- Payload size: ${formatByteCount(run.payloadBytes)} (${run.results[0]?.blocks ?? 0} blocks)`)
  lines.push(`- Payload pattern: ${PAYLOAD_PATTERN_LABELS[run.payloadPattern]}`)
  lines.push(`- Payload digest (FNV-1a, seed ${run.seed}): \`${run.payloadDigest}\``)
  lines.push(`- Methodology: ${BENCH_METHODOLOGY_LABELS[run.methodology]}`)
  lines.push(
    `- Timed region: ${
      run.methodology === 'steady-state'
        ? 'block processing and byte conversion, with the key schedule prepared beforehand'
        : 'key schedule, block processing and byte conversion'
    }`,
  )
  lines.push('- Outside the timed region: payload generation, buffer allocation, padding, and the round-trip check')
  lines.push(
    `- Key: generated from the recorded seed for the benchmark, never a user key. Length ${
      run.results[0]?.config.b ?? 0
    } bytes, matching the configuration.`,
  )
  lines.push(
    `- Execution: a Web Worker in the browser, so that interface work is not inside the timed region.`,
  )
  lines.push('')

  lines.push('## 5. Hardware and runtime environment')
  lines.push('')
  lines.push('| Property | Value |')
  lines.push('|---|---|')
  lines.push(`| Runtime | Browser worker |`)
  lines.push(`| Browser | ${run.environment.browserLabel} |`)
  lines.push(`| System | ${run.environment.osLabel} |`)
  lines.push(`| Logical cores | ${run.environment.logicalCores ?? 'not reported by this browser'} |`)
  lines.push(`| Cross-origin isolated | ${run.environment.crossOriginIsolated ? 'yes' : 'no'} |`)
  lines.push(`| Timer resolution | ${run.timerResolutionMs > 0 ? `${(run.timerResolutionMs * 1000).toFixed(1)} µs per step, as measured` : 'could not be measured'} |`)
  lines.push(`| User agent | \`${run.environment.userAgent}\` |`)
  lines.push('')
  lines.push(
    'These values are reported by the browser. No browser exposes the processor model, and some report a fixed version string regardless of the real one, so they identify the environment approximately.',
  )
  lines.push('')

  lines.push('## 6. Warm-up and iteration counts')
  lines.push('')
  lines.push(`- Warm-up iterations: ${run.warmupIterations} per group, discarded from the statistics`)
  lines.push(`- Measured iterations: ${run.measuredIterations} per group`)
  lines.push(
    `- Operations per timed sample: ${run.results[0]?.opsPerBatch ?? 0}, chosen by growing the batch until one batch exceeded the target duration`,
  )
  lines.push(
    '- Why batching: a browser coarsens `performance.now()` as a side-channel mitigation, so a single block operation is not resolvable. Each sample is the elapsed time of a batch divided by the number of operations in it.',
  )
  lines.push(`- Total run duration: ${run.durationMs} ms`)
  lines.push('')

  lines.push('## 7. Results')
  lines.push('')
  lines.push(resultTable(run))
  lines.push('')
  lines.push(
    'Charts for this run — latency against round count, throughput against payload size, and the sample distribution — are rendered in the application under Compare.',
  )
  lines.push('')
  if (run.results.some((result) => result.keySetupNs !== null)) {
    lines.push('Key schedule time, measured separately from the block processing:')
    lines.push('')
    lines.push('| Configuration | Key schedule |')
    lines.push('|---|---|')
    for (const result of run.results) {
      if (result.keySetupNs !== null) {
        lines.push(`| ${formatConfigLabel(result.config)} | ${formatLatency(result.keySetupNs)} |`)
      }
    }
    lines.push('')
  }

  lines.push('## 8. Statistical summary')
  lines.push('')
  lines.push(statisticsTable(run))
  lines.push('')
  lines.push(
    'Definitions: the median is the middle sample; Q1 and Q3 bound the interquartile range; p95 is the nearest-rank value, meaning the sample at position ⌈0.95 · n⌉ in ascending order, and it is only meaningful with 30 samples or more; CV is the sample standard deviation divided by the mean.',
  )
  lines.push('')

  lines.push('## 9. Interpretation')
  lines.push('')
  for (const line of interpretation) {
    lines.push(`- ${line.text}`)
  }
  lines.push('')

  lines.push('## 10. Security and validity limitations')
  lines.push('')
  for (const warning of run.warnings) {
    lines.push(`- ${warning.message}`)
  }
  lines.push(
    '- RC5 is a legacy cipher. These measurements describe computational cost on one runtime and say nothing about cryptographic strength.',
  )
  lines.push(
    '- A fast configuration is not a secure configuration, a long key is not a secure configuration, and a high round count is not on its own a secure configuration.',
  )
  lines.push(
    '- Padding is framing, not authentication. It does not detect a modified ciphertext and must not be described as integrity protection.',
  )
  lines.push('')

  lines.push('## 11. Reproduction')
  lines.push('')
  lines.push(`1. Open RC5 CipherLab (engine ${ENGINE_VERSION}, methodology ${METHODOLOGY_VERSION}) in this browser.`)
  lines.push(
    `2. Set the configuration to ${configs.map((result) => formatConfigLabel(result.config)).join(', ')}, with ${PADDING_LABELS[run.paddingPolicy]} block handling.`,
  )
  lines.push(
    `3. In the Benchmark Lab, choose a ${formatByteCount(run.payloadBytes)} payload with the ${PAYLOAD_PATTERN_LABELS[run.payloadPattern].toLowerCase()} pattern, ${run.warmupIterations} warm-up and ${run.measuredIterations} measured iterations, direction "${run.results[0]?.target ?? 'encrypt'}", methodology "${run.methodology}".`,
  )
  lines.push(
    `4. Expect the same payload digest, \`${run.payloadDigest}\`, and timings in the same range on the same environment. Timings will differ on other hardware and under different load.`,
  )
  lines.push(
    '5. To read the samples rather than the summary, export the raw sample CSV from the Experiments page.',
  )
  lines.push('')

  lines.push('## 12. Date and versions')
  lines.push('')
  lines.push(`- Recorded: ${formatTimestamp(run.createdAt)}`)
  lines.push(`- Application version: ${APP_VERSION}`)
  lines.push(`- Engine version: ${ENGINE_VERSION}`)
  lines.push(`- Methodology version: ${METHODOLOGY_VERSION}`)
  lines.push(`- Record schema version: ${SCHEMA_VERSION}`)
  lines.push(`- Engine version recorded with the run: ${run.engineVersion}`)
  lines.push(`- Methodology version recorded with the run: ${run.methodologyVersion}`)
  lines.push('')
  lines.push(
    '---',
    '',
    '*Generated by RC5 CipherLab, a measurement and learning tool. It is not a security-certification tool.*',
  )
  lines.push('')

  return lines.join('\n')
}

export function runsToMarkdown(runs: readonly SavedRun[], options: MarkdownOptions = {}): string {
  return runs.map((run) => runToMarkdown(run, options)).join('\n\n---\n\n')
}
