/**
 * Types for the RC5 engine.
 *
 * The engine is deliberately free of any DOM, React, or storage concerns: it is the same code that
 * runs in the UI thread for a single encryption and inside the benchmark worker for millions of
 * block operations.
 */

/** Word size in bits. RC5 version 16 covers all three (RFC 2040 §6). */
export type WordSize = 16 | 32 | 64

/**
 * How input that does not fill a whole block is handled.
 *
 * - `pkcs7`: pad to the next block boundary, always adding between 1 and `blockSize` bytes.
 *   Identical to the CBC-Pad padding of RFC 2040 §7, which is PKCS#5.
 * - `raw`: reject any input that is not an exact multiple of the block size.
 *
 * Padding is not authentication. It does not detect tampering and must not be presented as if it did.
 */
export type PaddingPolicy = 'pkcs7' | 'raw'

/**
 * Which arithmetic the run used.
 *
 * `number` is 32-bit integer arithmetic with explicit masking. `bigint` is arbitrary-precision
 * arithmetic masked to the word size; it is used both for w=64 and as an independent oracle for
 * w=16/32 in the tests. Timings from the two paths are not comparable.
 */
export type ImplPath = 'number' | 'bigint'

export interface Rc5Config {
  /** Word size in bits: 16, 32, or 64. Block size is 2w bits. */
  w: WordSize
  /** Number of rounds, r. */
  r: number
  /** Secret key length in bytes, b. Must match the supplied key exactly. */
  b: number
}

/** The expanded key table S, of length t = 2(r + 1). */
export interface KeySchedule {
  readonly config: Rc5Config
  readonly implPath: ImplPath
  readonly s: readonly number[] | readonly bigint[]
}

/** One round of encryption, captured for teaching and step-through display. All values are hex. */
export interface RoundTraceStep {
  readonly round: number
  readonly aBefore: string
  readonly bBefore: string
  /** Rotation amount applied to A, already reduced modulo w. */
  readonly rotA: number
  readonly aRotated: string
  readonly s2i: string
  readonly aAfter: string
  readonly rotB: number
  readonly bRotated: string
  readonly s2i1: string
  readonly bAfter: string
}

export interface BlockTrace {
  readonly config: Rc5Config
  readonly implPath: ImplPath
  readonly a0: string
  readonly b0: string
  readonly s0: string
  readonly s1: string
  readonly aAfterInit: string
  readonly bAfterInit: string
  readonly steps: readonly RoundTraceStep[]
}
