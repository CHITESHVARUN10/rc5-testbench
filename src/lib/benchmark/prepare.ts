/**
 * Deterministic benchmark payloads.
 *
 * The pattern matters for a cipher whose rotations are data-dependent: a payload of all zero bytes
 * produces a rotation amount of zero in every round, which is not representative of general data.
 * The pattern used for a run is recorded in the result, so two runs are only compared when they used
 * the same one.
 */

export type PayloadPattern = 'prng' | 'zeros' | 'ascending' | 'counter'

export const PAYLOAD_PATTERNS: readonly PayloadPattern[] = ['prng', 'zeros', 'ascending', 'counter']

export const PAYLOAD_PATTERN_LABELS: Record<PayloadPattern, string> = {
  prng: 'Deterministic pseudo-random',
  zeros: 'All zero bytes',
  ascending: 'Ascending byte values',
  counter: 'Repeating 32-bit counter',
}

export const PAYLOAD_PATTERN_NOTES: Record<PayloadPattern, string> = {
  prng: 'Mixed byte values, so rotation amounts vary the way they would with ordinary data.',
  zeros: 'Every rotation amount is zero. A useful floor, and not representative of real messages.',
  ascending: 'Low byte values with little variation between adjacent bytes.',
  counter: 'A counter incrementing across the payload, as a framing header might look.',
}

/**
 * Fill a buffer with a reproducible pattern.
 *
 * Deterministic and seedable so a run can be reproduced exactly from its recorded specification.
 * This work happens outside the timed region.
 */
export function generatePayload(bytes: number, pattern: PayloadPattern, seed = 0x9e3779b9): Uint8Array {
  const out = new Uint8Array(bytes)

  switch (pattern) {
    case 'zeros':
      return out

    case 'ascending':
      for (let i = 0; i < bytes; i++) out[i] = i & 0xff
      return out

    case 'counter':
      for (let i = 0; i < bytes; i++) {
        out[i] = (i >> 2) & 0xff
      }
      return out

    case 'prng': {
      // xorshift32 with a fixed seed: cheap, deterministic, and well mixed.
      let state = seed >>> 0 || 0x9e3779b9
      for (let i = 0; i < bytes; i++) {
        state ^= state << 13
        state >>>= 0
        state ^= state >>> 17
        state ^= state << 5
        state >>>= 0
        out[i] = (state >>> 8) & 0xff
      }
      return out
    }
  }
}

/**
 * FNV-1a over the payload, recorded with the result so a run can be shown to have used the payload it
 * claims. A digest, not a checksum for integrity against an adversary.
 */
export function payloadDigest(bytes: Uint8Array): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
