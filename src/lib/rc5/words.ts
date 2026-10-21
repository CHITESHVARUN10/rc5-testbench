import type { WordSize } from './types'

/**
 * Word arithmetic. This module is the single source of truth for masking and rotation behaviour;
 * the hot loops in block.ts and expand.ts call these rather than reimplementing them, so a masking
 * mistake can only exist in one place.
 *
 * Values are kept unsigned at every return. Internal temporaries may be signed int32, because
 * JavaScript's bitwise operators coerce to int32; every function here masks on the way out.
 */

export const MASK64 = 0xffffffffffffffffn

/* ------------------------------------------------------------------ 16-bit */

/** Rotate left on a 16-bit boundary. Amounts are reduced modulo w, so n = 0 and n = 16 are no-ops. */
export function rotl16(x: number, n: number): number {
  const s = n & 15
  return ((x << s) | (x >>> (16 - s))) & 0xffff
}

export function rotr16(x: number, n: number): number {
  const s = n & 15
  return ((x >>> s) | (x << (16 - s))) & 0xffff
}

export function add16(x: number, y: number): number {
  return (x + y) & 0xffff
}

export function sub16(x: number, y: number): number {
  return (x - y) & 0xffff
}

/* ------------------------------------------------------------------ 32-bit */

export function rotl32(x: number, n: number): number {
  const s = n & 31
  return ((x << s) | (x >>> (32 - s))) >>> 0
}

export function rotr32(x: number, n: number): number {
  const s = n & 31
  return ((x >>> s) | (x << (32 - s))) >>> 0
}

export function add32(x: number, y: number): number {
  return (x + y) >>> 0
}

export function sub32(x: number, y: number): number {
  return (x - y) >>> 0
}

/* ------------------------------------------------------------------ 64-bit */

export function rotl64(x: bigint, n: bigint): bigint {
  const s = n & 63n
  return ((x << s) | (x >> (64n - s))) & MASK64
}

export function rotr64(x: bigint, n: bigint): bigint {
  const s = n & 63n
  return ((x >> s) | (x << (64n - s))) & MASK64
}

export function add64(x: bigint, y: bigint): bigint {
  return (x + y) & MASK64
}

export function sub64(x: bigint, y: bigint): bigint {
  return (x - y) & MASK64
}

/* ------------------------------------------------------- Width-generic BigInt */

/**
 * Width-parameterised 64-family rotation, for the paths that must work at every word size: the
 * width-generic BigInt key schedule and the traced round. The block loop has its own 64-bit
 * rotation above so that the hot path does not convert `w` to BigInt on every call.
 */
export function rotlBig(x: bigint, n: bigint, w: WordSize): bigint {
  const width = BigInt(w)
  const s = n & (width - 1n)
  const mask = (1n << width) - 1n
  return ((x << s) | (x >> (width - s))) & mask
}

export function rotrBig(x: bigint, n: bigint, w: WordSize): bigint {
  const width = BigInt(w)
  const s = n & (width - 1n)
  const mask = (1n << width) - 1n
  return ((x >> s) | (x << (width - s))) & mask
}

export function maskFor(w: WordSize): bigint {
  return (1n << BigInt(w)) - 1n
}

/* ------------------------------------------------------------------ Display */

/** Fixed-width, uppercase hex for one word. w=32 gives 8 digits, w=64 sixteen. */
export function wordToHex(value: number | bigint, w: WordSize): string {
  const digits = w / 4
  const raw = typeof value === 'bigint' ? value.toString(16) : value.toString(16)
  return raw.padStart(digits, '0').toUpperCase()
}

/** Any word value reduced to its unsigned representative, for display and comparison. */
export function toUnsignedBigInt(value: number | bigint): bigint {
  return typeof value === 'bigint' ? value : BigInt(value >>> 0)
}
