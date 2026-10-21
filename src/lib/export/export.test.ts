import { describe, expect, it } from 'vitest'

import { runsToCsv, samplesToCsv } from './csv'
import { parseRunsFile, runsToJson } from './json'
import { runToMarkdown } from './markdown'
import type { SavedRun } from '../storage/experiments'
import { SCHEMA_VERSION } from '../versions'

/**
 * Export round trips.
 *
 * An export that cannot be re-imported, or that drops the method that produced the numbers, is worse
 * than no export: it produces a file that looks authoritative and is not self-describing. These tests
 * hold the formats to that.
 */

const RUN: SavedRun = {
  id: 'run-test-1',
  name: 'RC5-32/12/16 · 4 KiB · 200 samples',
  createdAt: '2026-10-13T10:00:00.000Z',
  algorithm: 'RC5',
  schemaVersion: SCHEMA_VERSION,
  engineVersion: '1.0.0',
  methodologyVersion: '1.0.0',
  paddingPolicy: 'pkcs7',
  methodology: 'steady-state',
  payloadBytes: 4096,
  payloadPattern: 'prng',
  payloadDigest: 'a1b2c3d4',
  seed: 2654435769,
  warmupIterations: 200,
  measuredIterations: 200,
  timerResolutionMs: 0.1,
  durationMs: 412,
  environment: {
    runtime: 'browser',
    browserLabel: 'Chromium-based 141',
    osLabel: 'macOS',
    userAgent: 'Mozilla/5.0 (Macintosh) Chrome/141.0.0.0 Safari/537.36',
    language: 'en-GB',
    logicalCores: 10,
    deviceMemoryGb: null,
    crossOriginIsolated: false,
    devicePixelRatio: 2,
    timestamp: '2026-10-13T10:00:00.000Z',
  },
  warnings: [{ code: 'few-samples', message: 'Only 12 samples were taken.' }],
  results: [
    {
      id: 'run-test-1:32-12-16:encrypt',
      config: { w: 32, r: 12, b: 16 },
      target: 'encrypt',
      implPath: 'number',
      payloadBytes: 4096,
      blocks: 512,
      bytesProcessed: 4096,
      opsPerBatch: 32,
      metrics: {
        n: 200,
        meanNs: 35_500,
        medianNs: 34_400,
        minNs: 31_300,
        maxNs: 48_000,
        stdDevNs: 2500,
        p95Ns: 40_600,
        q1Ns: 33_800,
        q3Ns: 36_900,
        cvPercent: 7.04,
      },
      throughputBytesPerSecond: 115_380_281,
      samplesNs: [31_300, 34_400, 40_600],
      rawSampleCount: 200,
      correctnessStatus: 'verified',
      keySetupNs: 3500,
      warnings: [],
    },
    {
      id: 'run-test-1:32-12-16:decrypt',
      config: { w: 32, r: 12, b: 16 },
      target: 'decrypt',
      implPath: 'number',
      payloadBytes: 4096,
      blocks: 512,
      bytesProcessed: 4096,
      opsPerBatch: 32,
      metrics: {
        n: 200,
        meanNs: 36_100,
        medianNs: 35_000,
        minNs: 31_900,
        maxNs: 49_000,
        stdDevNs: 2600,
        p95Ns: 41_200,
        q1Ns: 34_100,
        q3Ns: 37_500,
        cvPercent: 7.2,
      },
      throughputBytesPerSecond: 113_462_000,
      samplesNs: [31_900, 35_000, 41_200],
      rawSampleCount: 200,
      correctnessStatus: 'verified',
      keySetupNs: null,
      warnings: [],
    },
  ],
  notes: 'Baseline of "three" rounds, with a comma, and a quote "here".',
  tags: ['baseline', 'coursework'],
}

describe('CSV export', () => {
  it('writes one row per result with the method repeated on each row', () => {
    const csv = runsToCsv([RUN])
    const lines = csv.trim().split('\n')
    expect(lines.length).toBe(3) // header plus two results
    const header = lines[0].split(',')
    expect(header.length).toBeGreaterThan(40)
    expect(header).toContain('median_ns')
    expect(header).toContain('methodology')
    expect(header).toContain('timer_resolution_ms')
    expect(header).toContain('payload_digest')
    expect(header).toContain('notes')
    // Both results appear, in base units, with the run's method repeated on each row.
    expect(lines[1]).toContain('34400')
    expect(lines[2]).toContain('35000')
    expect(lines[1]).toContain('steady-state')
    expect(lines[2]).toContain('steady-state')
  })

  it('escapes a run note containing commas and quotes', () => {
    const csv = runsToCsv([RUN])
    expect(csv).toContain('"Baseline of ""three"" rounds, with a comma, and a quote ""here""."')
  })

  it('writes numbers in base units rather than pre-formatted with units', () => {
    const csv = runsToCsv([RUN])
    expect(csv).toContain('34400')
    expect(csv).not.toContain('µs')
    expect(csv).not.toContain('MiB/s')
  })

  it('writes raw samples with an explicit index', () => {
    const csv = samplesToCsv([RUN])
    const lines = csv.trim().split('\n')
    expect(lines[0]).toContain('sample_index')
    expect(lines.length).toBe(1 + 3 + 3)
  })
})

describe('JSON export and import', () => {
  it('round-trips runs through an envelope that records the versions', () => {
    const json = runsToJson([RUN])
    const parsed = JSON.parse(json) as { schemaVersion: number; runs: unknown[] }
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION)
    expect(parsed.runs.length).toBe(1)

    const outcome = parseRunsFile(json)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.runs.length).toBe(1)
      expect(outcome.warnings).toEqual([])
    }
  })

  it('accepts a bare list of runs but says the version information is missing', () => {
    const outcome = parseRunsFile(JSON.stringify([RUN]))
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.warnings[0]).toContain('no version information')
    }
  })

  it('refuses a file written by a newer schema instead of guessing', () => {
    const json = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, runs: [RUN] })
    const outcome = parseRunsFile(json)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error).toContain('newer version')
  })

  it('warns when the methodology version differs, because timings would not be comparable', () => {
    const json = JSON.stringify({ methodologyVersion: '0.9.0', runs: [RUN] })
    const outcome = parseRunsFile(json)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.warnings.join(' ')).toContain('not directly comparable')
  })

  it('reports invalid JSON and a missing runs list as errors, without throwing', () => {
    const broken = parseRunsFile('{ not json')
    expect(broken.ok).toBe(false)
    if (!broken.ok) expect(broken.error).toContain('not valid JSON')

    const empty = parseRunsFile('{"something": true}')
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.error).toContain('no "runs" list')
  })
})

describe('Markdown report', () => {
  const markdown = runToMarkdown(RUN)

  it('carries all twelve sections a report is expected to have', () => {
    for (const heading of [
      '## 1. Objective',
      '## 2. Research question or hypothesis',
      '## 3. RC5 parameters and padding policy',
      '## 4. Test payloads and key setup methodology',
      '## 5. Hardware and runtime environment',
      '## 6. Warm-up and iteration counts',
      '## 7. Results',
      '## 8. Statistical summary',
      '## 9. Interpretation',
      '## 10. Security and validity limitations',
      '## 11. Reproduction',
      '## 12. Date and versions',
    ]) {
      expect(markdown).toContain(heading)
    }
  })

  it('leaves the objective and the hypothesis for the author rather than inventing them', () => {
    expect(markdown).toContain('State the objective here')
    expect(markdown).toContain('State the hypothesis here')
  })

  it('records the method that produced the numbers', () => {
    expect(markdown).toContain('Operations per timed sample: 32')
    expect(markdown).toContain('Payload digest')
    expect(markdown).toContain('a1b2c3d4')
    expect(markdown).toContain('Warm-up iterations: 200')
  })

  it('states the environment and admits what it cannot identify', () => {
    expect(markdown).toContain('Chromium-based 141')
    expect(markdown).toContain('No browser exposes the processor model')
  })

  it('includes the interpretation and the limitations', () => {
    expect(markdown).toContain('## 9. Interpretation')
    expect(markdown).toContain('legacy cipher')
    expect(markdown).toContain('Only 12 samples were taken.')
  })

  it('tails with the standing disclaimer', () => {
    expect(markdown.trimEnd().endsWith('*Generated by RC5 CipherLab, a measurement and learning tool. It is not a security-certification tool.*')).toBe(true)
  })
})
