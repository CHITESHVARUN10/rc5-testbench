import { Rc5Error } from './errors'

/**
 * Block-handling policy.
 *
 * PKCS#7 is the same padding RC5-CBC-Pad uses: RFC 2040 §7 states it is identical to PKCS#5, and for
 * the 8-byte blocks of RC5-32 the two names describe the same scheme. Padding always adds between
 * 1 and blockSize bytes, so a message that already fills a block gains a whole block of padding.
 * That is deliberate: it makes the padding unambiguous to remove.
 *
 * Padding provides confidentiality framing only. It is not authentication, it does not detect
 * tampering, and a failure to remove it does not prove the ciphertext was genuine.
 */

export function padPkcs7(data: Uint8Array, blockSize: number): Uint8Array {
  const padLength = blockSize - (data.length % blockSize)
  const out = new Uint8Array(data.length + padLength)
  out.set(data, 0)
  out.fill(padLength, data.length)
  return out
}

export function unpadPkcs7(padded: Uint8Array, blockSize: number): Uint8Array {
  if (padded.length === 0 || padded.length % blockSize !== 0) {
    throw new Rc5Error(
      'invalid-padding',
      `A padded message must be a non-zero multiple of the ${blockSize}-byte block size, but these bytes are ${padded.length} long. The ciphertext is truncated, or it was produced with a different block size.`,
      { byteLength: padded.length, blockSize },
    )
  }

  const padLength = padded[padded.length - 1]
  if (padLength < 1 || padLength > blockSize) {
    throw new Rc5Error(
      'invalid-padding',
      `The last byte is 0x${padLength.toString(16).padStart(2, '0')}, which cannot be a PKCS#7 padding length for ${blockSize}-byte blocks (expected 1 to ${blockSize}). Either the key is wrong, or this ciphertext was not produced with PKCS#7 padding.`,
      { padLength, blockSize },
    )
  }

  for (let i = padded.length - padLength; i < padded.length; i++) {
    if (padded[i] !== padLength) {
      throw new Rc5Error(
        'invalid-padding',
        `The padding is malformed: the last byte says ${padLength} padding bytes, but byte ${i - (padded.length - padLength) + 1} of the padding is 0x${padded[i].toString(16).padStart(2, '0')} instead of 0x${padLength.toString(16).padStart(2, '0')}. Either the key is wrong, or the ciphertext was not produced with PKCS#7 padding.`,
        { padLength, inconsistentAt: i },
      )
    }
  }

  return padded.slice(0, padded.length - padLength)
}

export function assertBlockAligned(byteLength: number, blockSize: number): void {
  if (byteLength % blockSize !== 0) {
    const remainder = byteLength % blockSize
    throw new Rc5Error(
      'not-block-aligned',
      `Raw-block mode encrypts complete blocks only, and ${byteLength} bytes is not a multiple of the ${blockSize}-byte block size (${remainder} bytes left over). Use PKCS#7 padding, or enter a whole number of blocks.`,
      { byteLength, blockSize, remainder },
    )
  }
}
