import type { Rc5Config } from './rc5/types'

/**
 * A note on what a configuration is, not a verdict on what it is worth.
 *
 * The tool measures time. The one thing it must never do is let a fast number read as a strong
 * cipher, so every configuration in the comparison carries the same kind of note, drawn from what
 * the specification and the published literature actually establish.
 *
 * The reference point is RC5-32/12 with a 16-byte key: the configuration the RC5 specification
 * (RFC 2040) documents and tests. Being at or above the reference round count makes a configuration
 * a fair measurement baseline. It does not make it safe for protecting anything real.
 */

export type SecurityLevel = 'reference' | 'caution'

export interface SecurityNote {
  readonly level: SecurityLevel
  readonly headline: string
  readonly detail: string
}

export function securityNote(config: Rc5Config): SecurityNote {
  const keyBits = config.b * 8
  const keyClause =
    keyBits < 64
      ? ` The key is ${keyBits} bits, so searching the key space is the practical limit — not the cipher.`
      : ` The key is ${keyBits} bits.`

  if (config.r <= 8) {
    return {
      level: 'caution',
      headline: 'Reduced-round configuration',
      detail: `At ${config.r} rounds this is a reduced-round variant, the range published cryptanalysis of RC5 examines. A low round count is the cheap end of the comparison, not a safety margin.${keyClause}`,
    }
  }

  if (config.r < 12) {
    return {
      level: 'caution',
      headline: 'Below the reference round count',
      detail: `${config.r} rounds is below the 12 that RFC 2040 documents. It is a valid measurement of cost, but it is not the documented configuration.${keyClause}`,
    }
  }

  return {
    level: 'reference',
    headline: 'At the reference round count',
    detail: `12 rounds is the configuration RFC 2040 documents and tests, so this is a fair baseline for comparison. A baseline is not a certification: nothing here establishes that this configuration is safe for real data.${keyClause}`,
  }
}

/** The sentence that must accompany any table of timings. */
export const TIMING_CAVEAT =
  'These numbers describe how long the work took on this machine. They say nothing about how hard the cipher is to break, and a faster configuration is not a stronger one.'

/**
 * Exhaustive key search, as arithmetic rather than a claim.
 *
 * The key space of a b-byte key is exactly 2^(8b) — that is a fact about the key length, not a
 * measurement. Turning it into a time needs one assumption, the guess rate, which is stated wherever
 * the number appears. This is the only security-relevant figure the tool can produce honestly, and it
 * covers exactly one attack: trying every key. Cryptanalysis of the round function is a different
 * attack and is not covered by it.
 */

export interface KeySearchEstimate {
  readonly keyBits: number
  readonly keySpaceLabel: string
  readonly searchLabel: string
  readonly universeLabel: string | null
  readonly note: string
}

/** The assumption behind the search-time figure: one billion guesses per second. */
export const KEY_SEARCH_GUESS_RATE = 1e9

const SECONDS_PER_YEAR = 31_557_600
/** 13.8 billion years. Used only as a scale, never as a security claim. */
const UNIVERSE_YEARS = 1.38e10

export function keySearchEstimate(keyBytes: number, guessesPerSecond = KEY_SEARCH_GUESS_RATE): KeySearchEstimate {
  const keyBits = keyBytes * 8
  const keySpace = 2 ** keyBits
  // An exhaustive search finds the key after half the space on average.
  const seconds = 2 ** (keyBits - 1) / guessesPerSecond
  const years = seconds / SECONDS_PER_YEAR

  const keySpaceLabel =
    keyBits <= 40
      ? `${keySpace.toLocaleString('en-US')} keys`
      : `${scientific(keySpace)} keys`

  let searchLabel: string
  if (seconds < 1) searchLabel = 'under a second'
  else if (years < 1) searchLabel = `${Math.round(seconds).toLocaleString('en-US')} seconds`
  else if (years < 10_000) searchLabel = `${Math.round(years).toLocaleString('en-US')} years`
  else searchLabel = `${scientific(years)} years`

  const universeLabel =
    years > UNIVERSE_YEARS
      ? `about ${scientific(years / UNIVERSE_YEARS)} times the age of the universe`
      : null

  return {
    keyBits,
    keySpaceLabel,
    searchLabel,
    universeLabel,
    note: `Half the key space on average, at an assumed ${scientific(guessesPerSecond)} guesses per second. This is arithmetic on the key length, not a measurement, and it does not cover attacks that avoid searching the key space.`,
  }
}

/** 3.4 × 10^38, with a mantissa that does not carry a pointless .0. */
export function scientific(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (value < 1000) return String(Math.round(value))
  const exponent = Math.floor(Math.log10(value))
  const mantissa = Number((value / 10 ** exponent).toFixed(1))
  if (mantissa >= 10) return `1 × 10^${exponent + 1}`
  return `${String(mantissa)} × 10^${exponent}`
}
