import { Rc5Error } from './errors'

/**
 * Byte-level input handling: hex, UTF-8, and comparison.
 *
 * Displayed hex is uppercase and grouped; exported hex is lowercase and ungrouped. Anything the user
 * types back in is accepted in either case, with whitespace, commas, colons and underscores ignored.
 */

const NON_HEX = /[^0-9a-fA-F]/

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

/**
 * Parse hex typed by a user, or hex read from an exported file.
 *
 * Rejects rather than repairs: an odd digit count or a non-hex character is an error the user has to
 * see, because silently dropping or padding bytes would change the message.
 */
export function hexToBytes(input: string): Uint8Array {
  const cleaned = input.replace(/^\s*0[xX]/, '').replace(/[\s,:_]/g, '')
  if (cleaned.length === 0) return new Uint8Array(0)

  const badIndex = cleaned.search(NON_HEX)
  if (badIndex !== -1) {
    const character = cleaned[badIndex]
    throw new Rc5Error(
      'invalid-hex',
      `"${character}" is not a hexadecimal digit, at position ${badIndex + 1}. Hex uses the characters 0-9 and A-F.`,
      { position: badIndex + 1, character },
    )
  }

  if (cleaned.length % 2 !== 0) {
    throw new Rc5Error(
      'invalid-hex',
      `The hex input has ${cleaned.length} digits, which is odd. Each byte is two digits, so the last byte is incomplete.`,
      { digits: cleaned.length },
    )
  }

  const out = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(cleaned.substr(i * 2, 2), 16)
  }
  return out
}

export function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export function utf8Decode(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Rc5Error(
      'invalid-utf8',
      'These bytes are not valid UTF-8, so they cannot be displayed as text. View them as hex to inspect the raw output.',
      { byteLength: bytes.length },
    )
  }
}

export function groupHex(hex: string, groupSize = 4): string {
  const groups: string[] = []
  for (let i = 0; i < hex.length; i += groupSize) {
    groups.push(hex.slice(i, i + groupSize))
  }
  return groups.join(' ').toUpperCase()
}

export interface ByteComparison {
  readonly equal: boolean
  /** Zero-based index of the first byte that differs, or null when the two buffers are equal. */
  readonly firstDifference: number | null
  readonly lengthDelta: number
}

/**
 * Compare recovered plaintext against the original bytes. The first differing index is what makes a
 * mismatch actionable: it tells the user whether the problem is at the start (wrong key) or at the
 * end (padding or truncation).
 */
export function compareBytes(a: Uint8Array, b: Uint8Array): ByteComparison {
  const shared = Math.min(a.length, b.length)
  for (let i = 0; i < shared; i++) {
    if (a[i] !== b[i]) {
      return { equal: false, firstDifference: i, lengthDelta: a.length - b.length }
    }
  }
  if (a.length !== b.length) {
    return { equal: false, firstDifference: shared, lengthDelta: a.length - b.length }
  }
  return { equal: true, firstDifference: null, lengthDelta: 0 }
}
