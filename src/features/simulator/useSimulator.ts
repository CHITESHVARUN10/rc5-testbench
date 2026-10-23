import { useCallback, useMemo, useState } from 'react'

import { bytesToHex, compareBytes, hexToBytes, utf8Decode, utf8Encode } from '@/lib/rc5/bytes'
import { blockSizeBytes } from '@/lib/rc5/constants'
import { decryptBytes, encryptBytes, padKeyToLength } from '@/lib/rc5/engine'
import { isRc5Error } from '@/lib/rc5/errors'
import type { PaddingPolicy, Rc5Config } from '@/lib/rc5/types'
import { useSettings } from '@/state/settings.store'

/**
 * Simulator state.
 *
 * Everything here lives in memory and only for as long as the page is open: the plaintext and the
 * secret key are never written to storage, never put in the URL, and never logged. Clearing the inputs
 * drops the key material first.
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
  /** The exact bytes that were encrypted, kept to compare against a later decryption. */
  readonly input: Uint8Array
}

export interface VerifyOutcome {
  readonly matches: boolean
  readonly recoveredText: string | null
  readonly recoveredHex: string
  readonly firstDifference: number | null
  readonly paddingBytes: number
  readonly error: string | null
}

export interface SimulatorState {
  readonly config: Rc5Config
  readonly padding: PaddingPolicy
  readonly inputMode: 'text' | 'hex'
  readonly keyInputMode: 'text' | 'hex'
  readonly plaintext: string
  readonly keyText: string
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
  readonly error: string | null
  readonly encryptedIsStale: boolean
  readonly verifiedIsStale: boolean
  setPlaintext: (value: string) => void
  setKeyText: (value: string) => void
  padKey: () => void
  encrypt: () => void
  verify: () => void
  clearAll: () => void
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
  const [encrypted, setEncrypted] = useState<EncryptOutcome | null>(null)
  const [verified, setVerified] = useState<VerifyOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)

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

      const result = encryptBytes(parsed.inputBytes, parsed.keyBytes, config, padding)

      setEncrypted({
        ciphertextHex: bytesToHex(result.output),
        config,
        padding,
        inputBytes: parsed.inputBytes.length,
        outputBytes: result.outputBytes,
        blocks: result.blocks,
        paddingBytes: result.paddingBytes,
        input: parsed.inputBytes.slice(),
      })
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
      const result = decryptBytes(ciphertext, parsed.keyBytes, encrypted.config, encrypted.padding)
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
        error: null,
      })
    } catch (caught) {
      setVerified({
        matches: false,
        recoveredText: null,
        recoveredHex: '',
        firstDifference: null,
        paddingBytes: 0,
        error: messageOf(caught, 'Decryption failed.'),
      })
    }
  }, [encrypted, parsed.keyBytes])

  const clearAll = useCallback(() => {
    // Key material is dropped first.
    setKeyTextState('')
    setPlaintextState('')
    setEncrypted(null)
    setVerified(null)
    setError(null)
  }, [])

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
    error,
    encryptedIsStale,
    verifiedIsStale,
    setPlaintext,
    setKeyText,
    padKey,
    encrypt,
    verify,
    clearAll,
  }
}
