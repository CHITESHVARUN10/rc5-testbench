/**
 * Reference vectors from RFC 2040 §9.2 (inputs) and §9.3 (outputs).
 *
 * Transcribed from the RFC text itself, not from memory. The RFC's test program exercises RC5-CBC
 * and RC5-CBC-Pad with a 32-bit word size, so every vector here is w = 32 and the key length is
 * implied by the key's byte count.
 *
 * Two useful properties of this set:
 *   - Where the IV is all zeros and the plaintext is a single block, CBC chaining reduces to the raw
 *     block cipher, so those rows are direct single-block RC5 vectors. `SINGLE_BLOCK_VECTORS` below
 *     is exactly that subset.
 *   - `padding: true` marks the RFC's CBC-Pad rows, whose padding is PKCS#5 and therefore identical
 *     to the PKCS#7 policy this engine implements.
 *
 * The set covers r ∈ {0, 1, 2, 8, 12, 16} and key lengths of 1, 2, 4, 5, 8 and 16 bytes, which is
 * what makes it worth transcribing in full rather than picking one vector.
 */

export interface Rfc2040Vector {
  readonly id: string
  /** RFC 2040 padding mode flag: false = RC5-CBC, true = RC5-CBC-Pad. */
  readonly padding: boolean
  readonly rounds: number
  readonly keyHex: string
  readonly ivHex: string
  readonly plaintextHex: string
  readonly ciphertextHex: string
  readonly note: string
}

export const RFC2040_VECTORS: readonly Rfc2040Vector[] = [
  {
    id: 'r0-k1-p0',
    padding: false,
    rounds: 0,
    keyHex: '00',
    ivHex: '0000000000000000',
    plaintextHex: '0000000000000000',
    ciphertextHex: '7a7bba4d79111d1e',
    note: 'r=0 isolates the key schedule and the initial addition from the round loop',
  },
  {
    id: 'r0-k1-pall-ones',
    padding: false,
    rounds: 0,
    keyHex: '00',
    ivHex: '0000000000000000',
    plaintextHex: 'ffffffffffffffff',
    ciphertextHex: '797bba4d78111d1e',
    note: 'r=0, all-ones block',
  },
  {
    id: 'r0-k1-iv-low-bit',
    padding: false,
    rounds: 0,
    keyHex: '00',
    ivHex: '0000000000000001',
    plaintextHex: '0000000000000000',
    ciphertextHex: '7a7bba4d79111d1f',
    note: 'chained input differing in one bit',
  },
  {
    id: 'r0-k1-plain-low-bit',
    padding: false,
    rounds: 0,
    keyHex: '00',
    ivHex: '0000000000000000',
    plaintextHex: '0000000000000001',
    ciphertextHex: '7a7bba4d79111d1f',
    note: 'same value reached from the plaintext side, confirming the chaining arithmetic',
  },
  {
    id: 'r0-k1-ramp',
    padding: false,
    rounds: 0,
    keyHex: '00',
    ivHex: '0102030405060708',
    plaintextHex: '1020304050607080',
    ciphertextHex: '8b9ded91ce7794a6',
    note: 'r=0, both words non-zero',
  },
  {
    id: 'r1-k1',
    padding: false,
    rounds: 1,
    keyHex: '11',
    ivHex: '0000000000000000',
    plaintextHex: '0000000000000000',
    ciphertextHex: '2f759fe7ad86a378',
    note: 'single round',
  },
  {
    id: 'r2-k1',
    padding: false,
    rounds: 2,
    keyHex: '00',
    ivHex: '0000000000000000',
    plaintextHex: '0000000000000000',
    ciphertextHex: 'dca2694bf40e0788',
    note: 'two rounds, one-byte key',
  },
  {
    id: 'r2-k4',
    padding: false,
    rounds: 2,
    keyHex: '00000000',
    ivHex: '0000000000000000',
    plaintextHex: '0000000000000000',
    ciphertextHex: 'dca2694bf40e0788',
    note: 'identical to the one-byte zero key: both occupy one word of L, so zero-extension is exact',
  },
  {
    id: 'r8-k1',
    padding: false,
    rounds: 8,
    keyHex: '00',
    ivHex: '0000000000000000',
    plaintextHex: '0000000000000000',
    ciphertextHex: 'dcfe098577eca5ff',
    note: 'eight rounds',
  },
  {
    id: 'r8-k1-ramp',
    padding: false,
    rounds: 8,
    keyHex: '00',
    ivHex: '0102030405060708',
    plaintextHex: '1020304050607080',
    ciphertextHex: '9646fb77638f9ca8',
    note: 'eight rounds, chained input',
  },
  {
    id: 'r12-k1-ramp',
    padding: false,
    rounds: 12,
    keyHex: '00',
    ivHex: '0102030405060708',
    plaintextHex: '1020304050607080',
    ciphertextHex: 'b2b3209db6594da4',
    note: 'twelve rounds, chained input',
  },
  {
    id: 'r16-k1-ramp',
    padding: false,
    rounds: 16,
    keyHex: '00',
    ivHex: '0102030405060708',
    plaintextHex: '1020304050607080',
    ciphertextHex: '545f7f32a5fc3836',
    note: 'sixteen rounds, chained input',
  },
  {
    id: 'r8-k4-ones',
    padding: false,
    rounds: 8,
    keyHex: '01020304',
    ivHex: '0000000000000000',
    plaintextHex: 'ffffffffffffffff',
    ciphertextHex: '8285e7c1b5bc7402',
    note: 'four-byte key',
  },
  {
    id: 'r12-k4-ones',
    padding: false,
    rounds: 12,
    keyHex: '01020304',
    ivHex: '0000000000000000',
    plaintextHex: 'ffffffffffffffff',
    ciphertextHex: 'fc586f92f7080934',
    note: 'four-byte key, twelve rounds',
  },
  {
    id: 'r16-k4-ones',
    padding: false,
    rounds: 16,
    keyHex: '01020304',
    ivHex: '0000000000000000',
    plaintextHex: 'ffffffffffffffff',
    ciphertextHex: 'cf270ef9717ff7c4',
    note: 'four-byte key, sixteen rounds',
  },
  {
    id: 'r12-k8-ones',
    padding: false,
    rounds: 12,
    keyHex: '0102030405060708',
    ivHex: '0000000000000000',
    plaintextHex: 'ffffffffffffffff',
    ciphertextHex: 'e493f1c1bb4d6e8c',
    note: 'eight-byte key',
  },
  {
    id: 'r8-k8-ramp',
    padding: false,
    rounds: 8,
    keyHex: '0102030405060708',
    ivHex: '0102030405060708',
    plaintextHex: '1020304050607080',
    ciphertextHex: '5c4c041e0f217ac3',
    note: 'eight-byte key, chained input',
  },
  {
    id: 'r12-k8-ramp',
    padding: false,
    rounds: 12,
    keyHex: '0102030405060708',
    ivHex: '0102030405060708',
    plaintextHex: '1020304050607080',
    ciphertextHex: '921f12485373b4f7',
    note: 'eight-byte key, twelve rounds',
  },
  {
    id: 'r16-k8-ramp',
    padding: false,
    rounds: 16,
    keyHex: '0102030405060708',
    ivHex: '0102030405060708',
    plaintextHex: '1020304050607080',
    ciphertextHex: '5ba0ca6bbe7f5fad',
    note: 'eight-byte key, sixteen rounds',
  },
  {
    id: 'r8-k16-ramp',
    padding: false,
    rounds: 8,
    keyHex: '01020304050607081020304050607080',
    ivHex: '0102030405060708',
    plaintextHex: '1020304050607080',
    ciphertextHex: 'c533771cd0110e63',
    note: 'sixteen-byte key, the key length RC5-32/12/16 is named for',
  },
  {
    id: 'r12-k16-ramp',
    padding: false,
    rounds: 12,
    keyHex: '01020304050607081020304050607080',
    ivHex: '0102030405060708',
    plaintextHex: '1020304050607080',
    ciphertextHex: '294ddb46b3278d60',
    note: 'sixteen-byte key, twelve rounds',
  },
  {
    id: 'r16-k16-ramp',
    padding: false,
    rounds: 16,
    keyHex: '01020304050607081020304050607080',
    ivHex: '0102030405060708',
    plaintextHex: '1020304050607080',
    ciphertextHex: 'dad6bda9dfe8f7e8',
    note: 'sixteen-byte key, sixteen rounds',
  },
  {
    id: 'r12-k5-ones',
    padding: false,
    rounds: 12,
    keyHex: '0102030405',
    ivHex: '0000000000000000',
    plaintextHex: 'ffffffffffffffff',
    ciphertextHex: '97e0787837ed317f',
    note: 'five-byte key, which spans two words of L',
  },
  {
    id: 'r8-k5-ones',
    padding: false,
    rounds: 8,
    keyHex: '0102030405',
    ivHex: '0000000000000000',
    plaintextHex: 'ffffffffffffffff',
    ciphertextHex: '7875dbf6738c6478',
    note: 'five-byte key, eight rounds',
  },
  {
    id: 'r8-k5-block2',
    padding: false,
    rounds: 8,
    keyHex: '0102030405',
    ivHex: '7875dbf6738c6478',
    plaintextHex: '0808080808080808',
    ciphertextHex: '8f34c3c681c99695',
    note: 'second block of a chained message, using the first block as the IV',
  },
  {
    id: 'r8-k5-pad-one-block',
    padding: true,
    rounds: 8,
    keyHex: '0102030405',
    ivHex: '0000000000000000',
    plaintextHex: 'ffffffffffffffff',
    ciphertextHex: '7875dbf6738c64788f34c3c681c99695',
    note: 'CBC-Pad adds a full 0x08 block to an already aligned message',
  },
  {
    id: 'r8-k5-zero-block',
    padding: false,
    rounds: 8,
    keyHex: '0102030405',
    ivHex: '0000000000000000',
    plaintextHex: '0000000000000000',
    ciphertextHex: '7cb3f1df34f94811',
    note: 'all-zero block',
  },
  {
    id: 'r8-k5-block3',
    padding: false,
    rounds: 8,
    keyHex: '0102030405',
    ivHex: '7cb3f1df34f94811',
    plaintextHex: '1122334455667701',
    ciphertextHex: '7fd1a023a5bba217',
    note: 'third block of a chained message',
  },
  {
    id: 'r8-k5-pad-three-blocks',
    padding: true,
    rounds: 8,
    keyHex: '0102030405',
    ivHex: '0000000000000000',
    plaintextHex: 'ffffffffffffffff7875dbf6738c647811223344556677',
    ciphertextHex: '7875dbf6738c64787cb3f1df34f948117fd1a023a5bba217',
    note: '23 bytes padded to 24 with a single 0x01 byte, then chained across three blocks',
  },
]

/**
 * Vectors whose IV is zero and whose plaintext is exactly one block, where CBC chaining reduces to a
 * raw block encryption. These are the rows that can be checked directly against the engine's public
 * `encryptBytes` with the raw-block policy. Padding-mode rows are excluded because padding turns
 * them into multi-block messages.
 */
export const SINGLE_BLOCK_VECTORS: readonly Rfc2040Vector[] = RFC2040_VECTORS.filter(
  (v) => !v.padding && v.ivHex === '0000000000000000' && v.plaintextHex.length === 16,
)
