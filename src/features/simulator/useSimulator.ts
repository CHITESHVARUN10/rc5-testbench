import { useCallback, useMemo, useState } from 'react'

import { bytesToHex, compareBytes, hexToBytes, utf8Decode, utf8Encode } from '@/lib/rc5/bytes'
import { blockSizeBytes } from '@/lib/rc5/constants'
import { decryptBytes, encryptBytes, padKeyToLength, scheduleToHex, traceBlock } from '@/lib/rc5/engine'
import { padPkcs7 } from '@/lib/rc5/padding'
import { isRc5Error } from '@/lib/rc5/errors'
import type { BlockTrace, PaddingPolicy, Rc5Config } from '@/lib/rc5/types'
import { useSettings } from '@/state/settings.store'

/**
 * Simulator state.
 *
 * Everything here lives in memory and only for as long as the page is open: the plaintext, the secret
 * key, and the derived round keys are never written to storage, never put in the URL, and never
 * logged. Clearing the inputs drops the key material first.
 *
 * Results carry the configuration that produced them, so a result cannot be misread after the
 * configuration changes: the panel says it is stale instead of quietly re-labelling old output with
 * new parameters.
 */

export interface EncryptOutcome {
  readonly ciphertextHex: string
  readonly config: Rc5Config
  readonly padding: PaddingPolicy
  readonly inputBytes: number
  readonly outputBytes: number
  readonly blocks: number
  readonly paddingBytes: number
  readonly elapsedNs: number
  readonly scheduleHex: readonly string[]
  /** The exact bytes that were encrypted, kept to compare against a later decryption. */
  readonly input: Uint8Array
}

export interface VerifyOutcome {
  readonly matches: boolean
  readonly recoveredText: string | null
  readonly recoveredHex: string
  readonly firstDifference: number | null
  readonly paddingBytes: number
  readonly elapsedNs: number
  readonly error: string | null
}

export interface DecryptOutcome {
  readonly text: string | null
  readonly hex: string
  readonly byteLength: number
  readonly elapsedNs: number
  readonly error: string | null
}

export interface SimulatorState {
  readonly config: Rc5Config
  readonly padding: PaddingPolicy
  readonly inputMode: 'text' | 'hex'
  readonly keyInputMode: 'text' | 'hex'
  readonly plaintext: string
  readonly keyText: string
  readonly decryptInput: string
  readonly inputBytes: Uint8Array | null
  readonly inputError: string | null
  readonly keyBytes: Uint8Array | null
  readonly keyError: string | null
  readonly keyReady: boolean
  readonly plaintextByteCount: number
  readonly blockSize: number
  readonly plannedBlocks: number
  readonly plannedPaddingBytes: number
  readonly encrypted: EncryptOutcome | null
  readonly verified: VerifyOutcome | null
  readonly decrypted: DecryptOutcome | null
  readonly trace: BlockTrace | null
  readonly traceError: string | null
  readonly error: string | null
  readonly encryptedIsStale: boolean
  readonly verifiedIsStale: boolean
  setPlaintext: (value: string) => void
  setKeyText: (value: string) => void
  setDecryptInput: (value: string) => void
  padKey: () => void
  encrypt: () => void
  verify: () => void
  decryptPasted: () => void
  clearAll: () => void
  requestTrace: () => void
}

function messageOf(error: unknown, fallback: string): string {
  if (isRc5Error(error) || error instanceof Error) return error.message
  return fallback
}

export function useSimulator(): SimulatorState {
  const config = useSettings((state) => state.config)
  const padding = useSettings((state) => state.padding)
  const inputMode = useSettings((state) => state.inputMode)
  const keyInputMode = useSettings((state) => state.keyInputMode)
  const setKeyInputMode = useSettings((state) => state.setKeyInputMode)

  const [plaintext, setPlaintextState] = useState('')
  const [keyText, setKeyTextState] = useState('')
  const [decryptInput, setDecryptInputState] = useState('')
  const [encrypted, setEncrypted] = useState<EncryptOutcome | null>(null)
  const [verified, setVerified] = useState<VerifyOutcome | null>(null)
  const [decrypted, setDecrypted] = useState<DecryptOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [traceRequested, setTraceRequested] = useState(false)

  const parsed = useMemo(() => {
    let inputBytes: Uint8Array | null = null
    let inputError: string | null = null
    try {
      inputBytes = inputMode === 'hex' ? hexToBytes(plaintext) : utf8Encode(plaintext)
    } catch (caught) {
      inputError = messageOf(caught, 'The input could not be read.')
    }

    let keyBytes: Uint8Array | null = null
    let keyError: string | null = null
    try {
      keyBytes = keyInputMode === 'hex' ? hexToBytes(keyText) : utf8Encode(keyText)
    } catch (caught) {
      keyError = messageOf(caught, 'The key could not be read.')
    }

    return { inputBytes, inputError, keyBytes, keyError }
  }, [plaintext, keyText, inputMode, keyInputMode])

  const blockSize = blockSizeBytes(config.w)

  const { plannedBlocks, plannedPaddingBytes } = useMemo(() => {
    const length = parsed.inputBytes?.length ?? 0
    if (padding === 'raw') {
      return { plannedBlocks: length / blockSize, plannedPaddingBytes: 0 }
    }
    const blocks = Math.ceil(length / blockSize) + (length % blockSize === 0 ? 1 : 0)
    return { plannedBlocks: blocks, plannedPaddingBytes: blocks * blockSize - length }
  }, [parsed.inputBytes, blockSize, padding])

  const keyReady = parsed.keyBytes !== null && parsed.keyBytes.length === config.b

  const setPlaintext = useCallback((value: string) => {
    setPlaintextState(value)
    setError(null)
    setVerified(null)
  }, [])

  const setKeyText = useCallback((value: string) => {
    setKeyTextState(value)
    setError(null)
    setVerified(null)
  }, [])

  const setDecryptInput = useCallback((value: string) => {
    setDecryptInputState(value)
  }, [])

  /**
   * Zero-extension is always an explicit action, and it switches the key field to hex: a key padded
   * with zero bytes is not text, and showing it as text would misrepresent what the key now is.
   */
  const padKey = useCallback(() => {
    if (!parsed.keyBytes || parsed.keyBytes.length >= config.b) return
    try {
      const padded = padKeyToLength(parsed.keyBytes, config.b)
      setKeyInputMode('hex')
      setKeyTextState(bytesToHex(padded))
      setError(null)
    } catch (caught) {
      setError(messageOf(caught, 'The key could not be extended.'))
    }
  }, [parsed.keyBytes, config.b, setKeyInputMode])

  const encrypt = useCallback(() => {
    setError(null)
    setVerified(null)
    try {
      if (parsed.inputError) throw new Error(parsed.inputError)
      if (parsed.keyError) throw new Error(parsed.keyError)
      if (!parsed.inputBytes || !parsed.keyBytes) throw new Error('Enter a message and a key first.')

      const startedAt = performance.now()
      const result = encryptBytes(parsed.inputBytes, parsed.keyBytes, config, padding)
      const elapsedNs = Math.max(0, (performance.now() - startedAt) * 1e6)

      setEncrypted({
        ciphertextHex: bytesToHex(result.output),
        config,
        padding,
        inputBytes: parsed.inputBytes.length,
        outputBytes: result.outputBytes,
        blocks: result.blocks,
        paddingBytes: result.paddingBytes,
        elapsedNs,
        scheduleHex: scheduleToHex(result.schedule),
        input: parsed.inputBytes.slice(),
      })
      setTraceRequested(false)
    } catch (caught) {
      setEncrypted(null)
      setError(messageOf(caught, 'Encryption failed.'))
    }
  }, [parsed.inputBytes, parsed.keyBytes, parsed.inputError, parsed.keyError, config, padding])

  const verify = useCallback(() => {
    if (!encrypted) return
    setError(null)
    try {
      if (!parsed.keyBytes) throw new Error('Enter the key that was used to encrypt.')
      const ciphertext = hexToBytes(encrypted.ciphertextHex)
      const startedAt = performance.now()
      const result = decryptBytes(ciphertext, parsed.keyBytes, encrypted.config, encrypted.padding)
      const elapsedNs = Math.max(0, (performance.now() - startedAt) * 1e6)
      const comparison = compareBytes(result.output, encrypted.input)

      let recoveredText: string | null = null
      try {
        recoveredText = utf8Decode(result.output)
      } catch {
        recoveredText = null
      }

      setVerified({
        matches: comparison.equal,
        recoveredText,
        recoveredHex: bytesToHex(result.output),
        firstDifference: comparison.firstDifference,
        paddingBytes: result.paddingBytes,
        elapsedNs,
        error: null,
      })
    } catch (caught) {
      setVerified({
        matches: false,
        recoveredText: null,
        recoveredHex: '',
        firstDifference: null,
        paddingBytes: 0,
        elapsedNs: 0,
        error: messageOf(caught, 'Decryption failed.'),
      })
    }
  }, [encrypted, parsed.keyBytes])

  const decryptPasted = useCallback(() => {
    setError(null)
    try {
      if (!parsed.keyBytes) throw new Error('Enter the key that was used to encrypt.')
      const ciphertext = hexToBytes(decryptInput)
      const startedAt = performance.now()
      const result = decryptBytes(ciphertext, parsed.keyBytes, config, padding)
      const elapsedNs = Math.max(0, (performance.now() - startedAt) * 1e6)

      let text: string | null = null
      try {
        text = utf8Decode(result.output)
      } catch {
        text = null
      }

      setDecrypted({
        text,
        hex: bytesToHex(result.output),
        byteLength: result.outputBytes,
        elapsedNs,
        error: null,
      })
    } catch (caught) {
      setDecrypted({
        text: null,
        hex: '',
        byteLength: 0,
        elapsedNs: 0,
        error: messageOf(caught, 'Decryption failed.'),
      })
    }
  }, [parsed.keyBytes, decryptInput, config, padding])

  const clearAll = useCallback(() => {
    // Key material is dropped first.
    setKeyTextState('')
    setPlaintextState('')
    setDecryptInputState('')
    setEncrypted(null)
    setVerified(null)
    setDecrypted(null)
    setTraceRequested(false)
    setError(null)
  }, [])

  const trace = useMemo(() => {
    if (!traceRequested || !parsed.inputBytes || !parsed.keyBytes) return null
    try {
      // The trace follows exactly the bytes that encryption would process, padding included.
      const prepared = padding === 'pkcs7' ? padPkcs7(parsed.inputBytes, blockSize) : parsed.inputBytes
      if (prepared.length < blockSize) return null
      return traceBlock(prepared, 0, parsed.keyBytes, config)
    } catch {
      return null
    }
  }, [traceRequested, parsed.inputBytes, parsed.keyBytes, config, padding, blockSize])

  const requestTrace = useCallback(() => setTraceRequested(true), [])

  const encryptedIsStale =
    encrypted !== null &&
    (encrypted.config.w !== config.w ||
      encrypted.config.r !== config.r ||
      encrypted.config.b !== config.b ||
      encrypted.padding !== padding)

  const verifiedIsStale = verified !== null && encryptedIsStale

  return {
    config,
    padding,
    inputMode,
    keyInputMode,
    plaintext,
    keyText,
    decryptInput,
    inputBytes: parsed.inputBytes,
    inputError: parsed.inputError,
    keyBytes: parsed.keyBytes,
    keyError: parsed.keyError,
    keyReady,
    plaintextByteCount: parsed.inputBytes?.length ?? 0,
    blockSize,
    plannedBlocks,
    plannedPaddingBytes,
    encrypted,
    verified,
    decrypted,
    trace,
    traceError: traceRequested && !trace ? 'A trace needs a complete first block and a valid key.' : null,
    error,
    encryptedIsStale,
    verifiedIsStale,
    setPlaintext,
    setKeyText,
    setDecryptInput,
    padKey,
    encrypt,
    verify,
    decryptPasted,
    clearAll,
    requestTrace,
  }
}
