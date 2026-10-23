import {
  MAX_INPUT_BYTES,
  MAX_KEY_BYTES,
  MAX_ROUNDS,
  MIN_KEY_BYTES,
  MIN_ROUNDS,
  blockSizeBytes,
  implPathFor,
  isWordSize,
  scheduleLength,
} from './constants'
import { decryptBuffer, encryptBuffer, encryptBlockTraced } from './block'
import { Rc5Error } from './errors'
import { expandKey16, expandKey32, expandKeyBigInt } from './expand'
import { assertBlockAligned, padPkcs7, unpadPkcs7 } from './padding'
import type { BlockTrace, KeySchedule, PaddingPolicy, Rc5Config } from './types'
import { wordToHex } from './words'

/**
 * The public RC5 API.
 *
 * Everything above this layer (React, the worker, storage, exports) goes through these functions.
 * Nothing here touches the DOM, so the whole engine is testable in isolation, and the same code runs
 * in the UI thread and in the benchmark worker.
 *
 * Two rules this layer enforces on purpose:
 *   1. The key must be exactly `b` bytes. Nothing is silently truncated or extended; the caller has
 *      to ask for zero-extension explicitly through `padKeyToLength`.
 *   2. Failed work throws before any partial result can be mistaken for a successful one.
 */

export function validateConfig(config: Rc5Config): void {
  if (!isWordSize(config.w)) {
    throw new Rc5Error(
      'unsupported-word-size',
      `A word size of ${String(config.w)} bits is not supported. Supported sizes are 16, 32, and 64 bits.`,
      { w: String(config.w) },
    )
  }
  const r = config.r
  if (!Number.isInteger(r) || r < MIN_ROUNDS || r > MAX_ROUNDS) {
    throw new Rc5Error(
      'rounds-out-of-range',
      `Rounds must be a whole number from ${MIN_ROUNDS} to ${MAX_ROUNDS}; this configuration uses ${String(r)}.`,
      { r: String(r) },
    )
  }
  const b = config.b
  if (!Number.isInteger(b) || b < MIN_KEY_BYTES || b > MAX_KEY_BYTES) {
    throw new Rc5Error(
      'key-length-out-of-range',
      `Key length must be a whole number of bytes from ${MIN_KEY_BYTES} to ${MAX_KEY_BYTES}; this configuration uses ${String(b)}.`,
      { b: String(b) },
    )
  }
}

export function validateKey(key: Uint8Array, config: Rc5Config): void {
  if (key.length !== config.b) {
    throw new Rc5Error(
      'key-length-mismatch',
      `The key is ${key.length} byte${key.length === 1 ? '' : 's'} but RC5-${config.w}/${config.r}/${config.b} is defined with a ${config.b}-byte key. Pad it to ${config.b} bytes, or change the key length to ${key.length}.`,
      { keyLength: key.length, expected: config.b },
    )
  }
}

export function keyByteLength(config: Rc5Config): number {
  return config.b
}

/** Expand the secret key into the round key table S. Requires a key of exactly `b` bytes. */
export function expandKey(key: Uint8Array, config: Rc5Config): KeySchedule {
  validateConfig(config)
  validateKey(key, config)
  const implPath = implPathFor(config.w)
  const s =
    config.w === 64
      ? expandKeyBigInt(key, config)
      : config.w === 32
        ? expandKey32(key, config.r, config.b)
        : expandKey16(key, config.r, config.b)
  return { config, implPath, s }
}

export interface CipherResult {
  readonly output: Uint8Array
  readonly schedule: KeySchedule
  readonly inputBytes: number
  readonly outputBytes: number
  readonly blocks: number
  /** Bytes of padding that were added, or removed during decryption. */
  readonly paddingBytes: number
}

function runCipher(
  direction: 'encrypt' | 'decrypt',
  input: Uint8Array,
  key: Uint8Array,
  config: Rc5Config,
  padding: PaddingPolicy,
): CipherResult {
  validateConfig(config)
  validateKey(key, config)

  const blockSize = blockSizeBytes(config.w)

  if (direction === 'decrypt' && input.length === 0) {
    throw new Rc5Error(
      'payload-empty',
      'There is no ciphertext to decrypt. Enter or paste the ciphertext first.',
    )
  }

  if (input.length > MAX_INPUT_BYTES) {
    throw new Rc5Error(
      'payload-too-large',
      `This input is ${input.length} bytes; the interactive limit is ${MAX_INPUT_BYTES} bytes (${Math.floor(MAX_INPUT_BYTES / 1024)} KiB). Shorten the message to encrypt it here.`,
      { inputBytes: input.length, limit: MAX_INPUT_BYTES },
    )
  }

  let prepared: Uint8Array
  let paddingBytes = 0

  if (direction === 'encrypt') {
    if (padding === 'pkcs7') {
      prepared = padPkcs7(input, blockSize)
      paddingBytes = prepared.length - input.length
    } else {
      assertBlockAligned(input.length, blockSize)
      prepared = input
    }
  } else {
    assertBlockAligned(input.length, blockSize)
    prepared = input
  }

  const schedule = expandKey(key, config)
  const raw = new Uint8Array(prepared.length)
  if (direction === 'encrypt') {
    encryptBuffer(config.w, prepared, raw, schedule.s, config.r)
  } else {
    decryptBuffer(config.w, prepared, raw, schedule.s, config.r)
  }

  let output: Uint8Array = raw
  if (direction === 'decrypt' && padding === 'pkcs7') {
    output = unpadPkcs7(raw, blockSize)
    paddingBytes = raw.length - output.length
  }

  return {
    output,
    schedule,
    inputBytes: input.length,
    outputBytes: output.length,
    blocks: prepared.length / blockSize,
    paddingBytes,
  }
}

export function encryptBytes(
  plaintext: Uint8Array,
  key: Uint8Array,
  config: Rc5Config,
  padding: PaddingPolicy = 'pkcs7',
): CipherResult {
  return runCipher('encrypt', plaintext, key, config, padding)
}

export function decryptBytes(
  ciphertext: Uint8Array,
  key: Uint8Array,
  config: Rc5Config,
  padding: PaddingPolicy = 'pkcs7',
): CipherResult {
  return runCipher('decrypt', ciphertext, key, config, padding)
}

/**
 * Zero-extend a key to the configured length.
 *
 * This exists so that extending key material is always an explicit, visible action: the caller has to
 * invoke it, and the UI labels the button that does. Extending is not a repair for a wrong key, which
 * is why a key that is already long enough is rejected rather than trimmed.
 */
export function padKeyToLength(key: Uint8Array, targetLength: number): Uint8Array {
  if (key.length === targetLength) return key.slice()
  if (key.length > targetLength) {
    throw new Rc5Error(
      'key-length-mismatch',
      `The key is ${key.length} bytes, longer than the ${targetLength} bytes requested. Trimming a key would discard key material, so it is refused; shorten the key yourself or raise the key length.`,
      { keyLength: key.length, targetLength },
    )
  }
  const out = new Uint8Array(targetLength)
  out.set(key, 0)
  return out
}

/** Round key table as fixed-width uppercase hex, for display only. */
export function scheduleToHex(schedule: KeySchedule): string[] {
  const { w } = schedule.config
  const count = scheduleLength(schedule.config.r)
  const out: string[] = new Array(count)
  for (let i = 0; i < count; i++) {
    out[i] = wordToHex(schedule.s[i], w)
  }
  return out
}

export function traceBlock(
  block: Uint8Array,
  offset: number,
  key: Uint8Array,
  config: Rc5Config,
): BlockTrace {
  validateConfig(config)
  validateKey(key, config)
  return encryptBlockTraced(block, offset, key, config)
}

export { blockSizeBytes, scheduleLength }
