import type { Measurement } from './measurement'

/**
 * Three picks from one table.
 *
 * The comparison answers a question a table alone does not: of these, which should I care about?
 * Only one of the three answers is measured. "Fastest" comes from the clock. "Strongest settings"
 * is read from the round count and the key length. "Balanced" is the fastest configuration that does
 * not drop below the settings RFC 2040 documents, which is a rule about parameters, not a measurement
 * either.
 *
 * There is deliberately no combined score. A score would have to weigh milliseconds against rounds,
 * and there is no defensible exchange rate between them.
 */

export interface ComparisonSummary {
  /** Lowest median encryption time. */
  readonly fastest: Measurement | null
  /** Fastest configuration at or above the RFC 2040 settings: 12 rounds, a 16-byte key. */
  readonly balanced: Measurement | null
  /** Most rounds, then the longest key, then the fastest of those. */
  readonly strongest: Measurement | null
  /** The message size the picks were taken at, or null when nothing is measured. */
  readonly payloadBytes: number | null
  /** How many rows share that message size. */
  readonly comparedCount: number
  /** True when the table mixes message sizes, so only one size could be compared. */
  readonly mixedPayload: boolean
  readonly notes: readonly string[]
}

export const REFERENCE_ROUNDS = 12
export const REFERENCE_KEY_BYTES = 16

function fastestOf(rows: readonly Measurement[]): Measurement | null {
  return rows.reduce<Measurement | null>(
    (best, row) => (best === null || row.encryptNs < best.encryptNs ? row : best),
    null,
  )
}

function strongestOf(rows: readonly Measurement[]): Measurement | null {
  return rows.reduce<Measurement | null>((best, row) => {
    if (best === null) return row
    if (row.config.r !== best.config.r) return row.config.r > best.config.r ? row : best
    if (row.config.b !== best.config.b) return row.config.b > best.config.b ? row : best
    return row.encryptNs < best.encryptNs ? row : best
  }, null)
}

export function summariseComparison(rows: readonly Measurement[]): ComparisonSummary {
  if (rows.length === 0) {
    return {
      fastest: null,
      balanced: null,
      strongest: null,
      payloadBytes: null,
      comparedCount: 0,
      mixedPayload: false,
      notes: [],
    }
  }

  // A time taken over 15 bytes and a time taken over 1 KiB are not two answers to one question, so
  // the picks are drawn from the largest group measured at a single message size. Ties go to the
  // smallest payload, which is the cheapest group to reproduce.
  const bySize = new Map<number, Measurement[]>()
  for (const row of rows) {
    const group = bySize.get(row.payloadBytes)
    if (group) group.push(row)
    else bySize.set(row.payloadBytes, [row])
  }
  const [compared] = [...bySize.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0] - b[0])
    .map(([, group]) => group)

  const mixedPayload = bySize.size > 1
  const payloadBytes = compared[0]?.payloadBytes ?? null

  const fastest = fastestOf(compared)
  const atReference = compared.filter(
    (row) => row.config.r >= REFERENCE_ROUNDS && row.config.b >= REFERENCE_KEY_BYTES,
  )
  const balanced = fastestOf(atReference)
  const strongest = strongestOf(compared)

  const notes: string[] = []

  if (balanced === null) {
    notes.push(
      `No measured configuration reaches the reference settings (${REFERENCE_ROUNDS} rounds and a ${REFERENCE_KEY_BYTES}-byte key), so there is no balanced pick yet.`,
    )
  } else if (fastest !== null && fastest.id === balanced.id) {
    notes.push(
      `The fastest configuration is also at or above the reference settings, so one configuration holds both places.`,
    )
  }

  if (fastest !== null && fastest.config.r < REFERENCE_ROUNDS) {
    notes.push(
      `The fastest configuration uses ${fastest.config.r} rounds, below the ${REFERENCE_ROUNDS} RFC 2040 documents. Part of why it is quick is that it does less work.`,
    )
  }

  if (fastest !== null && strongest !== null && fastest.id !== strongest.id) {
    notes.push(
      `The strongest settings are not the fastest: ${strongest.config.r} rounds against ${fastest.config.r}, and more rounds cost time. This tool measures that cost; it does not measure the benefit.`,
    )
  }

  return {
    fastest,
    balanced,
    strongest,
    payloadBytes,
    comparedCount: compared.length,
    mixedPayload,
    notes,
  }
}
