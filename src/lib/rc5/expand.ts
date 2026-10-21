import { MAGIC_CONSTANTS } from './constants'
import type { Rc5Config, WordSize } from './types'
import { add16, add32, maskFor, rotl16, rotl32, rotlBig } from './words'

/**
 * Key expansion, RFC 2040 §5.4 and §5.5.
 *
 * Three implementations are written out in full rather than sharing one parameterised loop. The
 * reason is measurement integrity: this is a benchmarking tool, so the arithmetic that runs inside
 * the timed region must be the cipher's own arithmetic, not an interpreter over a word-operations
 * table. The masking primitives in words.ts are shared, so the semantics still have one home, and
 * the tests assert that these three implementations agree with each other and with the RFC vectors.
 *
 * Structure of the schedule:
 *   u  = w / 8                      bytes per word
 *   c  = max(1, ceil(b / u))        words in the user key table L
 *   t  = 2(r + 1)                   words in the expanded table S
 *   mixing runs 3 · max(t, c) times
 */

/** The generic BigInt path. Handles all three word sizes, and is the oracle the tests compare to. */
export function expandKeyBigInt(key: Uint8Array, config: Rc5Config): bigint[] {
  const { w, b } = config
  const u = w >> 3
  const c = Math.max(1, Math.ceil(b / u))
  const t = 2 * (config.r + 1)
  const mask = maskFor(w)
  const { p, q } = MAGIC_CONSTANTS[w]

  const L = new Array<bigint>(c).fill(0n)
  for (let i = 0; i < b; i++) {
    const word = (i / u) | 0
    L[word] = (L[word] | (BigInt(key[i]) << BigInt(8 * (i % u)))) & mask
  }

  const S = new Array<bigint>(t)
  S[0] = p
  for (let i = 1; i < t; i++) {
    S[i] = (S[i - 1] + q) & mask
  }

  let A = 0n
  let B = 0n
  let i = 0
  let j = 0
  const iterations = 3 * Math.max(t, c)
  for (let n = 0; n < iterations; n++) {
    A = S[i] = rotlBig((S[i] + A + B) & mask, 3n, w)
    B = L[j] = rotlBig((L[j] + A + B) & mask, (A + B) & mask, w)
    if (++i === t) i = 0
    if (++j === c) j = 0
  }

  return S
}

export function expandKey16(key: Uint8Array, r: number, b: number): number[] {
  const c = Math.max(1, Math.ceil(b / 2))
  const t = 2 * (r + 1)

  const L = new Array<number>(c).fill(0)
  for (let i = 0; i < b; i++) {
    const word = (i / 2) | 0
    L[word] = (L[word] | (key[i] << (8 * (i % 2)))) & 0xffff
  }

  const S = new Array<number>(t)
  S[0] = 0xb7e1
  for (let i = 1; i < t; i++) {
    S[i] = (S[i - 1] + 0x9e37) & 0xffff
  }

  let A = 0
  let B = 0
  let i = 0
  let j = 0
  const iterations = 3 * Math.max(t, c)
  for (let n = 0; n < iterations; n++) {
    A = S[i] = rotl16(add16(add16(S[i], A), B), 3)
    B = L[j] = rotl16(add16(add16(L[j], A), B), add16(A, B))
    if (++i === t) i = 0
    if (++j === c) j = 0
  }

  return S
}

export function expandKey32(key: Uint8Array, r: number, b: number): number[] {
  const c = Math.max(1, Math.ceil(b / 4))
  const t = 2 * (r + 1)

  const L = new Array<number>(c).fill(0)
  for (let i = 0; i < b; i++) {
    const word = (i / 4) | 0
    L[word] = (L[word] | (key[i] << (8 * (i % 4)))) >>> 0
  }

  const S = new Array<number>(t)
  S[0] = 0xb7e15163
  for (let i = 1; i < t; i++) {
    S[i] = (S[i - 1] + 0x9e3779b9) >>> 0
  }

  let A = 0
  let B = 0
  let i = 0
  let j = 0
  const iterations = 3 * Math.max(t, c)
  for (let n = 0; n < iterations; n++) {
    A = S[i] = rotl32(add32(add32(S[i], A), B), 3)
    B = L[j] = rotl32(add32(add32(L[j], A), B), add32(A, B))
    if (++i === t) i = 0
    if (++j === c) j = 0
  }

  return S
}

/** Word table length `c` for a configuration: how many words the key occupies. */
export function keyWords(w: WordSize, b: number): number {
  return Math.max(1, Math.ceil(b / (w >> 3)))
}
