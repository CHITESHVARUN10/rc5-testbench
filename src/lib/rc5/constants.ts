import type { PaddingPolicy, Rc5Config, WordSize } from './types'

/**
 * The single source of truth for what the engine supports.
 *
 * The UI must not offer a value outside these ranges, and these ranges must not be widened without
 * test coverage for the new values.
 */

export const WORD_SIZES: readonly WordSize[] = [16, 32, 64]

/**
 * The engine accepts r = 0, which RFC 2040 §9.2 exercises, because it isolates the key schedule and
 * the initial addition from the round loop. The UI does not offer it: an unkeyed-round cipher is a
 * teaching case, not a configuration.
 */
export const MIN_ROUNDS = 0
export const MAX_ROUNDS = 32
export const UI_MIN_ROUNDS = 1

export const MIN_KEY_BYTES = 1
export const MAX_KEY_BYTES = 32

/** Interactive inputs are capped well below what the engine can handle, to keep the UI responsive. */
export const MAX_INPUT_BYTES = 256 * 1024
/** Benchmarks run in a worker, so they can carry a larger payload. */
export const MAX_BENCH_PAYLOAD_BYTES = 1024 * 1024

/** Payload sizes offered as benchmarks and checks. Test sizes, not promises about real messages. */
export const PAYLOAD_PRESETS: readonly number[] = [
  16, 64, 256, 1024, 4096, 16384, 65536,
]

/**
 * Magic constants P_w and Q_w, from RFC 2040 §5.4: P_w = Odd((e - 2) · 2^w) and
 * Q_w = Odd((φ - 1) · 2^w), where e is the base of the natural logarithm and φ is the golden ratio.
 */
export const MAGIC_CONSTANTS: Record<WordSize, { p: bigint; q: bigint }> = {
  16: { p: 0xb7e1n, q: 0x9e37n },
  32: { p: 0xb7e15163n, q: 0x9e3779b9n },
  64: { p: 0xb7e151628aed2a6bn, q: 0x9e3779b97f4a7c15n },
}

export const PADDING_POLICIES: readonly PaddingPolicy[] = ['pkcs7', 'raw']

export const PADDING_LABELS: Record<PaddingPolicy, string> = {
  pkcs7: 'PKCS#7',
  raw: 'Raw blocks',
}

/** Educational starting points. These are comparison profiles, not deployment recommendations. */
export interface PresetProfile {
  readonly id: string
  readonly label: string
  readonly config: Rc5Config
  readonly purpose: string
}

export const PRESET_PROFILES: readonly PresetProfile[] = [
  {
    id: 'rc5-32-12-16',
    label: 'RC5-32/12/16',
    config: { w: 32, r: 12, b: 16 },
    purpose: 'Baseline for correctness and timing comparisons',
  },
  {
    id: 'rc5-32-16-16',
    label: 'RC5-32/16/16',
    config: { w: 32, r: 16, b: 16 },
    purpose: 'What more rounds cost on the same block size',
  },
  {
    id: 'rc5-32-20-16',
    label: 'RC5-32/20/16',
    config: { w: 32, r: 20, b: 16 },
    purpose: 'A higher round count on the same block size',
  },
  {
    id: 'rc5-16-12-16',
    label: 'RC5-16/12/16',
    config: { w: 16, r: 12, b: 16 },
    purpose: 'Half-size block: 32-bit blocks instead of 64',
  },
  {
    id: 'rc5-64-12-16',
    label: 'RC5-64/12/16',
    config: { w: 64, r: 12, b: 16 },
    purpose: 'BigInt path, quarantined from timing rankings',
  },
]

/** Round values used by the latency-versus-rounds sweep. */
export const ROUND_SWEEP_VALUES: readonly number[] = [8, 10, 12, 14, 16, 20, 24]

export function blockSizeBytes(w: WordSize): number {
  return (2 * w) / 8
}

export function blockSizeBits(w: WordSize): number {
  return 2 * w
}

/** Number of words in the expanded key table: t = 2(r + 1). */
export function scheduleLength(r: number): number {
  return 2 * (r + 1)
}

/** Number of words in the user key table: c = max(1, ceil(b / u)) where u = w / 8. */
export function keyWordCount(w: WordSize, b: number): number {
  return Math.max(1, Math.ceil(b / (w / 8)))
}

export function isWordSize(value: unknown): value is WordSize {
  return value === 16 || value === 32 || value === 64
}

export function implPathFor(w: WordSize): 'number' | 'bigint' {
  return w === 64 ? 'bigint' : 'number'
}
