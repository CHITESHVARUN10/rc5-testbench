import { describe, expect, it } from 'vitest'

import { blockSizeBytes, MAGIC_CONSTANTS, MAX_INPUT_BYTES } from './constants'
import { bytesToHex, compareBytes, groupHex, hexToBytes, utf8Decode, utf8Encode } from './bytes'
import { decryptBuffer, encryptBuffer, encryptBlockTraced } from './block'
import {
  decryptBytes,
  encryptBytes,
  expandKey,
  padKeyToLength,
  scheduleToHex,
  validateConfig,
  validateKey,
} from './engine'
import { Rc5Error } from './errors'
import { expandKey16, expandKey32, expandKeyBigInt } from './expand'
import { assertBlockAligned, padPkcs7, unpadPkcs7 } from './padding'
import type { BlockTrace, Rc5Config, WordSize } from './types'
import { add16, add32, add64, rotl16, rotl32, rotl64, rotr16, rotr32, rotr64 } from './words'
import { RFC2040_VECTORS, SINGLE_BLOCK_VECTORS, type Rfc2040Vector } from './vectors'

/* ------------------------------------------------------------------ helpers */

/** CBC encryption on top of the raw block cipher, so the RFC's chained vectors can be checked. */
function cbcEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  config: Rc5Config,
  iv: Uint8Array,
): Uint8Array {
  const blockSize = blockSizeBytes(config.w)
  const schedule = expandKey(key, config)
  const out = new Uint8Array(plaintext.length)
  let previous = iv
  for (let offset = 0; offset < plaintext.length; offset += blockSize) {
    const xored = new Uint8Array(blockSize)
    for (let i = 0; i < blockSize; i++) {
      xored[i] = plaintext[offset + i] ^ previous[i]
    }
    const target = out.subarray(offset, offset + blockSize)
    encryptBuffer(config.w, xored, target, schedule.s, config.r)
    previous = target
  }
  return out
}

function vectorConfig(vector: Rfc2040Vector): Rc5Config {
  return { w: 32, r: vector.rounds, b: hexToBytes(vector.keyHex).length }
}

function isRc5ErrorCode(error: unknown, code: string): boolean {
  return error instanceof Rc5Error && error.code === code
}

function traceFinalWords(trace: BlockTrace): { a: string; b: string } {
  const last = trace.steps[trace.steps.length - 1]
  if (last) return { a: last.aAfter, b: last.bAfter }
  return { a: trace.aAfterInit, b: trace.bAfterInit }
}

function hexWordsToBlock(a: string, b: string, w: WordSize): Uint8Array {
  const u = w >> 3
  const block = new Uint8Array(2 * u)
  const aValue = BigInt(`0x${a}`)
  const bValue = BigInt(`0x${b}`)
  for (let k = 0; k < u; k++) {
    block[k] = Number((aValue >> BigInt(8 * k)) & 0xffn)
    block[u + k] = Number((bValue >> BigInt(8 * k)) & 0xffn)
  }
  return block
}

function deterministicBytes(length: number, seed = 1): Uint8Array {
  const out = new Uint8Array(length)
  let state = seed >>> 0
  for (let i = 0; i < length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0
    out[i] = (state >>> 16) & 0xff
  }
  return out
}

const ALL_WORD_SIZES: readonly WordSize[] = [16, 32, 64]

/* ---------------------------------------------------------- RFC 2040 vectors */

describe('RFC 2040 §9.2 / §9.3 reference vectors', () => {
  it('covers six round counts and key lengths from 1 to 16 bytes', () => {
    const rounds = new Set(RFC2040_VECTORS.map((v) => v.rounds))
    const keyLengths = new Set(RFC2040_VECTORS.map((v) => hexToBytes(v.keyHex).length))
    expect(rounds).toEqual(new Set([0, 1, 2, 8, 12, 16]))
    expect(keyLengths).toEqual(new Set([1, 4, 5, 8, 16]))
    expect(RFC2040_VECTORS.length).toBe(29)
  })

  for (const vector of RFC2040_VECTORS) {
    it(`${vector.id}: ${vector.note}`, () => {
      const key = hexToBytes(vector.keyHex)
      const config = vectorConfig(vector)
      const blockSize = blockSizeBytes(32)
      const plaintext = hexToBytes(vector.plaintextHex)
      const message = vector.padding ? padPkcs7(plaintext, blockSize) : plaintext

      const ciphertext = cbcEncrypt(message, key, config, hexToBytes(vector.ivHex))
      expect(bytesToHex(ciphertext)).toBe(vector.ciphertextHex)
    })
  }

  it('exposes the single-block subset that the raw engine path can be checked against', () => {
    expect(SINGLE_BLOCK_VECTORS.length).toBeGreaterThanOrEqual(14)
    for (const vector of SINGLE_BLOCK_VECTORS) {
      expect(vector.padding).toBe(false)
      expect(vector.ivHex).toBe('0000000000000000')
    }
  })

  for (const vector of SINGLE_BLOCK_VECTORS) {
    it(`single block through the public API: ${vector.id}`, () => {
      const key = hexToBytes(vector.keyHex)
      const config = vectorConfig(vector)
      const result = encryptBytes(hexToBytes(vector.plaintextHex), key, config, 'raw')
      expect(bytesToHex(result.output)).toBe(vector.ciphertextHex)
      expect(result.blocks).toBe(1)
      expect(result.paddingBytes).toBe(0)
    })
  }

  it('decrypts every single-block vector back to its plaintext', () => {
    for (const vector of SINGLE_BLOCK_VECTORS) {
      const key = hexToBytes(vector.keyHex)
      const config = vectorConfig(vector)
      const result = decryptBytes(hexToBytes(vector.ciphertextHex), key, config, 'raw')
      expect(bytesToHex(result.output)).toBe(vector.plaintextHex)
    }
  })
})

/* ------------------------------------------------------- implementation agreement */

describe('implementation agreement', () => {
  const configs: Rc5Config[] = []
  for (const w of ALL_WORD_SIZES) {
    for (const r of [0, 1, 2, 8, 12, 32]) {
      for (const b of [1, 4, 5, 16, 32]) {
        configs.push({ w, r, b })
      }
    }
  }

  it('the specialised number schedules equal the width-generic BigInt schedule', () => {
    for (const config of configs) {
      if (config.w === 64) continue
      const key = deterministicBytes(config.b, config.r + config.b * 7)
      const special = config.w === 32 ? expandKey32(key, config.r, config.b) : expandKey16(key, config.r, config.b)
      const generic = expandKeyBigInt(key, config)
      expect(special.length).toBe(generic.length)
      for (let i = 0; i < special.length; i++) {
        expect(BigInt(special[i] >>> 0)).toBe(generic[i])
      }
    }
  })

  it('the traced BigInt round matches the optimised number path byte for byte', () => {
    for (const config of configs) {
      const key = deterministicBytes(config.b, config.r * 31 + config.w)
      const blockSize = blockSizeBytes(config.w)
      const block = deterministicBytes(blockSize, config.r + 1)

      const traced = encryptBlockTraced(block, 0, key, config)
      const finalWords = traceFinalWords(traced)
      const tracedBytes = hexWordsToBlock(finalWords.a, finalWords.b, config.w)

      const schedule = expandKey(key, config)
      const reference = new Uint8Array(blockSize)
      encryptBuffer(config.w, block, reference, schedule.s, config.r)

      expect(bytesToHex(tracedBytes)).toBe(bytesToHex(reference))
    }
  })

  it('the two buffer directions are inverses for every word size', () => {
    for (const config of configs) {
      const key = deterministicBytes(config.b, config.b + 3)
      const blockSize = blockSizeBytes(config.w)
      const blocks = 4
      const input = deterministicBytes(blockSize * blocks, config.w)
      const schedule = expandKey(key, config)
      const ciphertext = new Uint8Array(input.length)
      encryptBuffer(config.w, input, ciphertext, schedule.s, config.r)
      const recovered = new Uint8Array(input.length)
      decryptBuffer(config.w, ciphertext, recovered, schedule.s, config.r)
      expect(bytesToHex(recovered)).toBe(bytesToHex(input))
    }
  })

  it('produces different ciphertext under every round count for the same key and block', () => {
    const key = deterministicBytes(16, 9)
    const block = deterministicBytes(8, 11)
    const seen = new Set<string>()
    for (const r of [0, 1, 2, 4, 8, 12, 16, 20]) {
      const result = encryptBytes(block, key, { w: 32, r, b: 16 }, 'raw')
      seen.add(bytesToHex(result.output))
    }
    expect(seen.size).toBe(8)
  })
})

/* ------------------------------------------------------------------ round trips */

describe('round trips', () => {
  const lengths = [0, 1, 7, 8, 9, 63, 64, 65, 1000]

  for (const w of ALL_WORD_SIZES) {
    it(`recovers every payload length with PKCS#7 at w=${w}`, () => {
      const config: Rc5Config = { w, r: 12, b: 16 }
      const key = deterministicBytes(16, 21)
      for (const length of lengths) {
        const plaintext = deterministicBytes(length, length + 1)
        const encrypted = encryptBytes(plaintext, key, config, 'pkcs7')
        expect(encrypted.output.length % blockSizeBytes(w)).toBe(0)
        expect(encrypted.output.length).toBeGreaterThan(plaintext.length)
        const decrypted = decryptBytes(encrypted.output, key, config, 'pkcs7')
        expect(bytesToHex(decrypted.output)).toBe(bytesToHex(plaintext))
        expect(compareBytes(decrypted.output, plaintext).equal).toBe(true)
        expect(decrypted.paddingBytes).toBe(encrypted.paddingBytes)
      }
    })

    it(`recovers aligned payloads with the raw-block policy at w=${w}`, () => {
      const config: Rc5Config = { w, r: 8, b: 16 }
      const key = deterministicBytes(16, 22)
      const blockSize = blockSizeBytes(w)
      for (const blocks of [1, 2, 8]) {
        const plaintext = deterministicBytes(blockSize * blocks, blocks)
        const encrypted = encryptBytes(plaintext, key, config, 'raw')
        expect(encrypted.output.length).toBe(plaintext.length)
        expect(encrypted.paddingBytes).toBe(0)
        const decrypted = decryptBytes(encrypted.output, key, config, 'raw')
        expect(bytesToHex(decrypted.output)).toBe(bytesToHex(plaintext))
      }
    })
  }

  it('encrypts an empty message to exactly one block of padding', () => {
    const config: Rc5Config = { w: 32, r: 12, b: 16 }
    const key = deterministicBytes(16, 5)
    const encrypted = encryptBytes(new Uint8Array(0), key, config, 'pkcs7')
    expect(encrypted.output.length).toBe(8)
    expect(encrypted.paddingBytes).toBe(8)
    expect(encrypted.blocks).toBe(1)
    expect(bytesToHex(decryptBytes(encrypted.output, key, config, 'pkcs7').output)).toBe('')
  })

  it('round-trips UTF-8 text beyond one block', () => {
    const text = 'RC5 CipherLab — measured, not certified. Δοκιμή, тест, 试验, 🌱'
    const config: Rc5Config = { w: 32, r: 12, b: 16 }
    const key = utf8Encode('sixteen-byte-key')
    const encrypted = encryptBytes(utf8Encode(text), key, config, 'pkcs7')
    const decrypted = decryptBytes(encrypted.output, key, config, 'pkcs7')
    expect(utf8Decode(decrypted.output)).toBe(text)
  })

  it('gives a different result under a different key', () => {
    const config: Rc5Config = { w: 32, r: 12, b: 16 }
    const block = deterministicBytes(32, 77)
    const first = bytesToHex(encryptBytes(block, deterministicBytes(16, 1), config, 'pkcs7').output)
    const second = bytesToHex(encryptBytes(block, deterministicBytes(16, 2), config, 'pkcs7').output)
    expect(first).not.toBe(second)
  })
})

/* ------------------------------------------------------------ rotation boundaries */

describe('rotation boundaries', () => {
  it('32-bit rotation is the inverse of its counterpart for every amount', () => {
    const samples = [0x00000000, 0x00000001, 0x80000000, 0xffffffff, 0x12345678, 0xdeadbeef]
    for (const value of samples) {
      for (let n = 0; n <= 34; n++) {
        expect(rotr32(rotl32(value, n), n)).toBe(value >>> 0)
        expect(rotl32(rotr32(value, n), n)).toBe(value >>> 0)
      }
      expect(rotl32(value, 0)).toBe(value >>> 0)
      expect(rotl32(value, 32)).toBe(value >>> 0)
      expect(rotr32(value, 0)).toBe(value >>> 0)
      expect(rotr32(value, 32)).toBe(value >>> 0)
    }
    expect(rotl32(0x80000000, 1)).toBe(0x00000001)
    expect(rotl32(0x12345678, 4)).toBe(0x23456781)
    expect(rotl32(0x12345678, 31)).toBe(0x091a2b3c)
    expect(rotr32(0x00000001, 1)).toBe(0x80000000)
  })

  it('16-bit rotation is the inverse of its counterpart for every amount', () => {
    const samples = [0x0000, 0x0001, 0x8000, 0xffff, 0x1234, 0xbeef]
    for (const value of samples) {
      for (let n = 0; n <= 18; n++) {
        expect(rotr16(rotl16(value, n), n)).toBe(value & 0xffff)
        expect(rotl16(rotr16(value, n), n)).toBe(value & 0xffff)
      }
      expect(rotl16(value, 0)).toBe(value & 0xffff)
      expect(rotl16(value, 16)).toBe(value & 0xffff)
    }
    expect(rotl16(0x8001, 1)).toBe(0x0003)
    expect(rotl16(0x0fff, 4)).toBe(0xfff0)
  })

  it('64-bit rotation is the inverse of its counterpart for every amount', () => {
    const samples = [
      0n,
      1n,
      0x8000000000000000n,
      0xffffffffffffffffn,
      0x0123456789abcdefn,
      0xfedcba9876543210n,
    ]
    for (const value of samples) {
      for (let n = 0; n <= 66; n++) {
        expect(rotr64(rotl64(value, BigInt(n)), BigInt(n))).toBe(value)
        expect(rotl64(rotr64(value, BigInt(n)), BigInt(n))).toBe(value)
      }
      expect(rotl64(value, 0n)).toBe(value)
      expect(rotl64(value, 64n)).toBe(value)
    }
    expect(rotl64(0x8000000000000001n, 1n)).toBe(0x0000000000000003n)
    expect(rotr64(0x0000000000000001n, 1n)).toBe(0x8000000000000000n)
  })

  it('addition wraps at the word boundary and never leaves the word', () => {
    expect(add32(0xffffffff, 1)).toBe(0)
    expect(add32(0xffffffff, 0xffffffff)).toBe(0xfffffffe)
    expect(add16(0xffff, 1)).toBe(0)
    expect(add16(0xffff, 0xffff)).toBe(0xfffe)
    expect(add64(0xffffffffffffffffn, 1n)).toBe(0n)
    expect(add64(0xffffffffffffffffn, 0xffffffffffffffffn)).toBe(0xfffffffffffffffen)
  })
})

/* ------------------------------------------------------------------ padding */

describe('padding policy', () => {
  it('always adds between one byte and one whole block', () => {
    for (const length of [0, 1, 7, 8, 9, 15, 16, 17]) {
      const padded = padPkcs7(new Uint8Array(length), 8)
      const added = padded.length - length
      expect(added).toBeGreaterThanOrEqual(1)
      expect(added).toBeLessThanOrEqual(8)
      expect(padded.length % 8).toBe(0)
      for (let i = padded.length - added; i < padded.length; i++) {
        expect(padded[i]).toBe(added)
      }
    }
  })

  it('adds a whole block when the input is already aligned', () => {
    const padded = padPkcs7(deterministicBytes(8, 3), 8)
    expect(padded.length).toBe(16)
    expect(Array.from(padded.subarray(8))).toEqual([8, 8, 8, 8, 8, 8, 8, 8])
  })

  it('removes exactly what it added', () => {
    for (const length of [0, 1, 7, 8, 9, 100]) {
      const input = deterministicBytes(length, length)
      const recovered = unpadPkcs7(padPkcs7(input, 8), 8)
      expect(bytesToHex(recovered)).toBe(bytesToHex(input))
    }
  })

  it('rejects a last byte of zero', () => {
    const padded = new Uint8Array(8)
    padded[7] = 0
    try {
      unpadPkcs7(padded, 8)
      expect.unreachable('expected invalid padding to be rejected')
    } catch (error) {
      expect(isRc5ErrorCode(error, 'invalid-padding')).toBe(true)
      expect((error as Rc5Error).message).toContain('0x00')
    }
  })

  it('rejects a padding length larger than the block', () => {
    const padded = new Uint8Array(8).fill(0x09)
    expect(() => unpadPkcs7(padded, 8)).toThrowError(/expected 1 to 8/)
  })

  it('rejects inconsistent padding bytes', () => {
    const padded = new Uint8Array(8)
    padded.fill(0x03)
    padded[5] = 0x02
    try {
      unpadPkcs7(padded, 8)
      expect.unreachable('expected inconsistent padding to be rejected')
    } catch (error) {
      expect(isRc5ErrorCode(error, 'invalid-padding')).toBe(true)
    }
  })

  it('rejects a padded length that is not a whole number of blocks', () => {
    expect(() => unpadPkcs7(new Uint8Array(5), 8)).toThrowError(/multiple of the 8-byte block/)
    expect(() => unpadPkcs7(new Uint8Array(0), 8)).toThrowError(/non-zero multiple/)
  })

  it('refuses unaligned input in raw-block mode with an actionable message', () => {
    try {
      assertBlockAligned(9, 8)
      expect.unreachable('expected unaligned input to be rejected')
    } catch (error) {
      expect(isRc5ErrorCode(error, 'not-block-aligned')).toBe(true)
      expect((error as Rc5Error).message).toContain('1 bytes left over')
      expect((error as Rc5Error).detail.remainder).toBe(1)
    }
  })

  it('rejects unaligned input through the public encrypt path in raw mode', () => {
    const config: Rc5Config = { w: 32, r: 12, b: 16 }
    expect(() => encryptBytes(deterministicBytes(9, 1), deterministicBytes(16, 2), config, 'raw')).toThrowError(
      /whole number of blocks|not a multiple/,
    )
  })
})

/* ------------------------------------------------------------------ validation */

describe('configuration and input validation', () => {
  it('rejects an unsupported word size', () => {
    const config = { w: 48, r: 12, b: 16 } as unknown as Rc5Config
    try {
      validateConfig(config)
      expect.unreachable('expected the word size to be rejected')
    } catch (error) {
      expect(isRc5ErrorCode(error, 'unsupported-word-size')).toBe(true)
      expect((error as Rc5Error).message).toContain('16, 32, and 64')
    }
  })

  it('rejects round counts outside the supported range', () => {
    for (const r of [-1, 33, 1.5, Number.NaN]) {
      expect(() => validateConfig({ w: 32, r, b: 16 })).toThrowError(Rc5Error)
    }
    expect(() => validateConfig({ w: 32, r: 0, b: 16 })).not.toThrow()
    expect(() => validateConfig({ w: 32, r: 32, b: 16 })).not.toThrow()
  })

  it('rejects key lengths outside the supported range', () => {
    expect(() => validateConfig({ w: 32, r: 12, b: 0 })).toThrowError(/Key length must be/)
    expect(() => validateConfig({ w: 32, r: 12, b: 33 })).toThrowError(/Key length must be/)
    expect(() => validateConfig({ w: 32, r: 12, b: 16 })).not.toThrow()
  })

  it('requires the key to be exactly b bytes and says both lengths', () => {
    const config: Rc5Config = { w: 32, r: 12, b: 16 }
    try {
      validateKey(deterministicBytes(8, 1), config)
      expect.unreachable('expected the short key to be rejected')
    } catch (error) {
      expect(isRc5ErrorCode(error, 'key-length-mismatch')).toBe(true)
      const message = (error as Rc5Error).message
      expect(message).toContain('is 8 bytes')
      expect(message).toContain('16-byte key')
      expect((error as Rc5Error).detail).toMatchObject({ keyLength: 8, expected: 16 })
    }
    expect(() => validateKey(deterministicBytes(16, 1), config)).not.toThrow()
  })

  it('zero-extends a key only when asked, and refuses to trim one', () => {
    const short = deterministicBytes(5, 1)
    const padded = padKeyToLength(short, 16)
    expect(padded.length).toBe(16)
    expect(bytesToHex(padded.subarray(0, 5))).toBe(bytesToHex(short))
    expect(Array.from(padded.subarray(5))).toEqual(new Array(11).fill(0))
    expect(() => padKeyToLength(padded, 8)).toThrowError(/Trimming a key would discard key material/)
  })

  it('rejects an oversized interactive payload', () => {
    const config: Rc5Config = { w: 32, r: 12, b: 16 }
    const tooBig = new Uint8Array(MAX_INPUT_BYTES + 8)
    try {
      encryptBytes(tooBig, deterministicBytes(16, 1), config, 'pkcs7')
      expect.unreachable('expected the payload to be rejected')
    } catch (error) {
      expect(isRc5ErrorCode(error, 'payload-too-large')).toBe(true)
      expect((error as Rc5Error).message).toContain('interactive limit')
    }
  })

  it('refuses to decrypt nothing', () => {
    const config: Rc5Config = { w: 32, r: 12, b: 16 }
    try {
      decryptBytes(new Uint8Array(0), deterministicBytes(16, 1), config, 'pkcs7')
      expect.unreachable('expected empty ciphertext to be rejected')
    } catch (error) {
      expect(isRc5ErrorCode(error, 'payload-empty')).toBe(true)
      expect((error as Rc5Error).message).toContain('no ciphertext to decrypt')
    }
  })

  it('reports malformed hex with the offending position and character', () => {
    try {
      hexToBytes('12g4')
      expect.unreachable('expected invalid hex to be rejected')
    } catch (error) {
      expect(isRc5ErrorCode(error, 'invalid-hex')).toBe(true)
      expect((error as Rc5Error).detail).toMatchObject({ position: 3, character: 'g' })
    }
    expect(() => hexToBytes('abc')).toThrowError(/odd/)
    expect(() => hexToBytes('ab cd:ef_01,23')).not.toThrow()
    expect(bytesToHex(hexToBytes('AB CD'))).toBe('abcd')
    expect(bytesToHex(hexToBytes('0xABCD'))).toBe('abcd')
  })

  it('reports bytes that are not valid UTF-8 instead of guessing', () => {
    try {
      utf8Decode(new Uint8Array([0xff, 0xfe, 0x01]))
      expect.unreachable('expected invalid UTF-8 to be rejected')
    } catch (error) {
      expect(isRc5ErrorCode(error, 'invalid-utf8')).toBe(true)
      expect((error as Rc5Error).message).toContain('hex')
    }
  })

  it('reports the first differing byte so a mismatch is actionable', () => {
    expect(compareBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toEqual({
      equal: true,
      firstDifference: null,
      lengthDelta: 0,
    })
    expect(compareBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 9, 3]))).toEqual({
      equal: false,
      firstDifference: 1,
      lengthDelta: 0,
    })
    expect(compareBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toEqual({
      equal: false,
      firstDifference: 2,
      lengthDelta: -1,
    })
  })
})

/* ------------------------------------------------------------------ schedule and trace */

describe('key schedule and traced round', () => {
  it('has t = 2(r + 1) words', () => {
    for (const r of [0, 1, 12, 32]) {
      const schedule = expandKey(deterministicBytes(16, 1), { w: 32, r, b: 16 })
      expect(schedule.s.length).toBe(2 * (r + 1))
      expect(scheduleToHex(schedule).length).toBe(2 * (r + 1))
      expect(scheduleToHex(schedule)[0]).toMatch(/^[0-9A-F]{8}$/)
    }
  })

  it('derives P and Q from e and the golden ratio as RFC 2040 §5.4 defines them', () => {
    // P_w = Odd((e - 2) · 2^w) and Q_w = Odd((φ - 1) · 2^w). Double precision resolves the
    // fraction exactly enough at w = 16 and w = 32 to identify the nearest odd integer; at w = 64
    // the spacing between representable doubles is far larger than 1, so it is not checked here.
    const eMinus2 = Math.E - 2
    const phiMinus1 = (1 + Math.sqrt(5)) / 2 - 1
    for (const w of [16, 32] as const) {
      const scale = 2 ** w
      const cases: Array<[number, bigint]> = [
        [eMinus2, MAGIC_CONSTANTS[w].p],
        [phiMinus1, MAGIC_CONSTANTS[w].q],
      ]
      for (const [fraction, expected] of cases) {
        const derived = Number(expected)
        expect(derived % 2).toBe(1)
        expect(Math.abs(derived - fraction * scale)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('is deterministic and sensitive to the word size', () => {
    const key = deterministicBytes(16, 12)
    const first = scheduleToHex(expandKey(key, { w: 32, r: 8, b: 16 }))
    const second = scheduleToHex(expandKey(key, { w: 32, r: 8, b: 16 }))
    expect(first).toEqual(second)
    const otherWordSize = scheduleToHex(expandKey(key, { w: 16, r: 8, b: 16 }))
    expect(otherWordSize[0]).not.toBe(first[0])
    expect(otherWordSize[0]).toMatch(/^[0-9A-F]{4}$/)
  })

  it('is not the raw arithmetic progression once the key is mixed in', () => {
    const schedule = expandKeyBigInt(deterministicBytes(16, 4), { w: 32, r: 2, b: 16 })
    const unmixedSecond = (0xb7e15163n + 0x9e3779b9n) & 0xffffffffn
    expect(schedule[1]).not.toBe(unmixedSecond)
  })

  it('reports one trace step per round, with w-bit values and in-range rotations', () => {
    for (const w of ALL_WORD_SIZES) {
      const config: Rc5Config = { w, r: 12, b: 16 }
      const key = deterministicBytes(16, 6)
      const trace = encryptBlockTraced(deterministicBytes(blockSizeBytes(w), 7), 0, key, config)
      expect(trace.steps.length).toBe(12)
      const digits = w / 4
      for (const step of trace.steps) {
        for (const value of [step.aBefore, step.bBefore, step.aAfter, step.bAfter, step.s2i, step.s2i1]) {
          expect(value).toMatch(new RegExp(`^[0-9A-F]{${digits}}$`))
        }
        expect(step.rotA).toBeGreaterThanOrEqual(0)
        expect(step.rotA).toBeLessThan(w)
        expect(step.rotB).toBeGreaterThanOrEqual(0)
        expect(step.rotB).toBeLessThan(w)
      }
      expect(trace.a0).toMatch(new RegExp(`^[0-9A-F]{${digits}}$`))
    }
  })

  it('produces no trace steps when there are no rounds', () => {
    const config: Rc5Config = { w: 32, r: 0, b: 16 }
    const trace = encryptBlockTraced(deterministicBytes(8, 1), 0, deterministicBytes(16, 2), config)
    expect(trace.steps.length).toBe(0)
  })

  it('stops the traced read at the end of the buffer instead of reading past it', () => {
    expect(() =>
      encryptBlockTraced(new Uint8Array(4), 0, deterministicBytes(16, 1), { w: 32, r: 12, b: 16 }),
    ).toThrowError(/past the end/)
  })

  it('formats grouped hex for display', () => {
    expect(groupHex('a1b2c3d4e5f60718')).toBe('A1B2 C3D4 E5F6 0718')
    expect(groupHex('a1b2c3')).toBe('A1B2 C3')
  })
})
