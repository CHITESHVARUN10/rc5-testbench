import { blockSizeBytes } from './constants'
import { Rc5Error } from './errors'
import { expandKeyBigInt } from './expand'
import type { BlockTrace, Rc5Config, RoundTraceStep, WordSize } from './types'
import { add16, add32, add64, rotl16, rotl32, rotl64, rotlBig, rotr16, rotr32, rotr64, sub16, sub32, sub64, wordToHex } from './words'

/**
 * The RC5 block cipher, RFC 2040 §6.
 *
 * Each word size has its own transcription of the round function. This is deliberate duplication:
 * a benchmark that measures RC5 must time the cipher's own arithmetic, not a dispatch layer over a
 * generic word type. The masking and rotation primitives come from words.ts, so the parts that are
 * easy to get wrong still exist in exactly one place.
 *
 * Byte order is little-endian (RFC 2040 §6.1): the first byte of a block is the least significant
 * byte of A, and the byte at offset u is the least significant byte of B.
 *
 * `dst` may be the same buffer as `src`: a block is read before it is written, so in-place
 * decryption and encryption are both safe.
 */

function assertAligned(byteLength: number, blockSize: number): void {
  if (byteLength % blockSize !== 0) {
    throw new Rc5Error(
      'not-block-aligned',
      `This operation needs a whole number of ${blockSize}-byte blocks, and ${byteLength} bytes is not one.`,
      { byteLength, blockSize },
    )
  }
}

export function encryptBuffer(
  w: WordSize,
  src: Uint8Array,
  dst: Uint8Array,
  S: readonly number[] | readonly bigint[],
  r: number,
): void {
  const blockSize = blockSizeBytes(w)
  assertAligned(src.length, blockSize)
  if (dst.length < src.length) {
    throw new Rc5Error('payload-too-large', 'The output buffer is smaller than the input.', {
      srcLength: src.length,
      dstLength: dst.length,
    })
  }

  switch (w) {
    case 16: {
      const s = S as readonly number[]
      const s0 = s[0]
      const s1 = s[1]
      for (let o = 0; o + 4 <= src.length; o += 4) {
        let a = src[o] | (src[o + 1] << 8)
        let b = src[o + 2] | (src[o + 3] << 8)
        a = add16(a, s0)
        b = add16(b, s1)
        for (let i = 1; i <= r; i++) {
          a = add16(rotl16(a ^ b, b), s[2 * i])
          b = add16(rotl16(b ^ a, a), s[2 * i + 1])
        }
        dst[o] = a & 0xff
        dst[o + 1] = (a >>> 8) & 0xff
        dst[o + 2] = b & 0xff
        dst[o + 3] = (b >>> 8) & 0xff
      }
      return
    }

    case 32: {
      const s = S as readonly number[]
      const s0 = s[0]
      const s1 = s[1]
      for (let o = 0; o + 8 <= src.length; o += 8) {
        let a = (src[o] | (src[o + 1] << 8) | (src[o + 2] << 16) | (src[o + 3] << 24)) >>> 0
        let b = (src[o + 4] | (src[o + 5] << 8) | (src[o + 6] << 16) | (src[o + 7] << 24)) >>> 0
        a = add32(a, s0)
        b = add32(b, s1)
        for (let i = 1; i <= r; i++) {
          a = add32(rotl32(a ^ b, b), s[2 * i])
          b = add32(rotl32(b ^ a, a), s[2 * i + 1])
        }
        dst[o] = a & 0xff
        dst[o + 1] = (a >>> 8) & 0xff
        dst[o + 2] = (a >>> 16) & 0xff
        dst[o + 3] = (a >>> 24) & 0xff
        dst[o + 4] = b & 0xff
        dst[o + 5] = (b >>> 8) & 0xff
        dst[o + 6] = (b >>> 16) & 0xff
        dst[o + 7] = (b >>> 24) & 0xff
      }
      return
    }

    case 64: {
      const s = S as readonly bigint[]
      const s0 = s[0]
      const s1 = s[1]
      for (let o = 0; o + 16 <= src.length; o += 16) {
        let a = 0n
        let b = 0n
        for (let k = 0; k < 8; k++) {
          a |= BigInt(src[o + k]) << BigInt(8 * k)
          b |= BigInt(src[o + 8 + k]) << BigInt(8 * k)
        }
        a = add64(a, s0)
        b = add64(b, s1)
        for (let i = 1; i <= r; i++) {
          a = add64(rotl64(a ^ b, b), s[2 * i])
          b = add64(rotl64(b ^ a, a), s[2 * i + 1])
        }
        for (let k = 0; k < 8; k++) {
          dst[o + k] = Number((a >> BigInt(8 * k)) & 0xffn)
          dst[o + 8 + k] = Number((b >> BigInt(8 * k)) & 0xffn)
        }
      }
      return
    }
  }
}

export function decryptBuffer(
  w: WordSize,
  src: Uint8Array,
  dst: Uint8Array,
  S: readonly number[] | readonly bigint[],
  r: number,
): void {
  const blockSize = blockSizeBytes(w)
  assertAligned(src.length, blockSize)
  if (dst.length < src.length) {
    throw new Rc5Error('payload-too-large', 'The output buffer is smaller than the input.', {
      srcLength: src.length,
      dstLength: dst.length,
    })
  }

  switch (w) {
    case 16: {
      const s = S as readonly number[]
      const s0 = s[0]
      const s1 = s[1]
      for (let o = 0; o + 4 <= src.length; o += 4) {
        let a = src[o] | (src[o + 1] << 8)
        let b = src[o + 2] | (src[o + 3] << 8)
        for (let i = r; i >= 1; i--) {
          b = rotr16(sub16(b, s[2 * i + 1]), a) ^ a
          a = rotr16(sub16(a, s[2 * i]), b) ^ b
        }
        b = sub16(b, s1)
        a = sub16(a, s0)
        dst[o] = a & 0xff
        dst[o + 1] = (a >>> 8) & 0xff
        dst[o + 2] = b & 0xff
        dst[o + 3] = (b >>> 8) & 0xff
      }
      return
    }

    case 32: {
      const s = S as readonly number[]
      const s0 = s[0]
      const s1 = s[1]
      for (let o = 0; o + 8 <= src.length; o += 8) {
        let a = (src[o] | (src[o + 1] << 8) | (src[o + 2] << 16) | (src[o + 3] << 24)) >>> 0
        let b = (src[o + 4] | (src[o + 5] << 8) | (src[o + 6] << 16) | (src[o + 7] << 24)) >>> 0
        for (let i = r; i >= 1; i--) {
          b = rotr32(sub32(b, s[2 * i + 1]), a) ^ a
          a = rotr32(sub32(a, s[2 * i]), b) ^ b
        }
        b = sub32(b, s1)
        a = sub32(a, s0)
        dst[o] = a & 0xff
        dst[o + 1] = (a >>> 8) & 0xff
        dst[o + 2] = (a >>> 16) & 0xff
        dst[o + 3] = (a >>> 24) & 0xff
        dst[o + 4] = b & 0xff
        dst[o + 5] = (b >>> 8) & 0xff
        dst[o + 6] = (b >>> 16) & 0xff
        dst[o + 7] = (b >>> 24) & 0xff
      }
      return
    }

    case 64: {
      const s = S as readonly bigint[]
      const s0 = s[0]
      const s1 = s[1]
      for (let o = 0; o + 16 <= src.length; o += 16) {
        let a = 0n
        let b = 0n
        for (let k = 0; k < 8; k++) {
          a |= BigInt(src[o + k]) << BigInt(8 * k)
          b |= BigInt(src[o + 8 + k]) << BigInt(8 * k)
        }
        for (let i = r; i >= 1; i--) {
          b = rotr64(sub64(b, s[2 * i + 1]), a) ^ a
          a = rotr64(sub64(a, s[2 * i]), b) ^ b
        }
        b = sub64(b, s1)
        a = sub64(a, s0)
        for (let k = 0; k < 8; k++) {
          dst[o + k] = Number((a >> BigInt(8 * k)) & 0xffn)
          dst[o + 8 + k] = Number((b >> BigInt(8 * k)) & 0xffn)
        }
      }
      return
    }
  }
}

/* ------------------------------------------------------------------ Traced path */

/**
 * Encrypt one block and record every intermediate value.
 *
 * Used by the Learn page diagram and the simulator's round viewer, both of which display values
 * rather than measure anything, so this path is written for legibility and works at every word size
 * with one implementation. It uses the width-generic BigInt arithmetic, which the tests require to
 * agree byte-for-byte with the optimized number paths.
 */
export function encryptBlockTraced(
  src: Uint8Array,
  srcOffset: number,
  key: Uint8Array,
  config: Rc5Config,
): BlockTrace {
  const { w } = config
  const u = w >> 3
  const blockSize = blockSizeBytes(w)
  if (srcOffset + blockSize > src.length) {
    throw new Rc5Error('payload-too-large', 'The block extends past the end of the input buffer.', {
      srcOffset,
      blockSize,
      srcLength: src.length,
    })
  }

  const s = expandKeyBigInt(key, config)
  const width = BigInt(w)
  const mask = (1n << width) - 1n
  const r = config.r

  let a = 0n
  let b = 0n
  for (let k = 0; k < u; k++) {
    a |= BigInt(src[srcOffset + k]) << BigInt(8 * k)
    b |= BigInt(src[srcOffset + u + k]) << BigInt(8 * k)
  }

  const a0 = a
  const b0 = b
  a = (a + s[0]) & mask
  b = (b + s[1]) & mask

  const steps: RoundTraceStep[] = []
  for (let i = 1; i <= r; i++) {
    const aBefore = a
    const bBefore = b
    const rotA = Number(bBefore & (width - 1n))
    const aRotated = rotlBig(aBefore ^ bBefore, bBefore, w)
    const s2i = s[2 * i]
    const aAfter = (aRotated + s2i) & mask

    a = aAfter
    const rotB = Number(a & (width - 1n))
    const bRotated = rotlBig(bBefore ^ a, a, w)
    const s2i1 = s[2 * i + 1]
    const bAfter = (bRotated + s2i1) & mask
    b = bAfter

    steps.push({
      round: i,
      aBefore: wordToHex(aBefore, w),
      bBefore: wordToHex(bBefore, w),
      rotA,
      aRotated: wordToHex(aRotated, w),
      s2i: wordToHex(s2i, w),
      aAfter: wordToHex(aAfter, w),
      rotB,
      bRotated: wordToHex(bRotated, w),
      s2i1: wordToHex(s2i1, w),
      bAfter: wordToHex(bAfter, w),
    })
  }

  return {
    config,
    implPath: 'bigint',
    a0: wordToHex(a0, w),
    b0: wordToHex(b0, w),
    s0: wordToHex(s[0], w),
    s1: wordToHex(s[1], w),
    aAfterInit: wordToHex((a0 + s[0]) & mask, w),
    bAfterInit: wordToHex((b0 + s[1]) & mask, w),
    steps,
  }
}
