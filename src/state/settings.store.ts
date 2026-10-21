import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { PaddingPolicy, Rc5Config } from '@/lib/rc5/types'
import type { BenchMethodology, BenchTarget } from '@/lib/benchmark/protocol'
import type { PayloadPattern } from '@/lib/benchmark/prepare'

/**
 * Interface preferences.
 *
 * Only settings live here. Secret keys, plaintext, and derived round keys are held in component state
 * and never written to storage, which is why nothing in this store can hold them by type.
 */

export type MotionPreference = 'standard' | 'reduced' | 'none'

export interface SettingsState {
  readonly motion: MotionPreference
  readonly config: Rc5Config
  readonly padding: PaddingPolicy
  readonly keyInputMode: 'text' | 'hex'
  readonly inputMode: 'text' | 'hex'
  readonly benchPayloadBytes: number
  readonly benchWarmupIterations: number
  readonly benchMeasuredIterations: number
  readonly benchTarget: BenchTarget
  readonly benchMethodology: BenchMethodology
  readonly benchPattern: PayloadPattern
  setMotion: (motion: MotionPreference) => void
  setConfig: (config: Rc5Config) => void
  setPadding: (padding: PaddingPolicy) => void
  setKeyInputMode: (mode: 'text' | 'hex') => void
  setInputMode: (mode: 'text' | 'hex') => void
  setBenchPayloadBytes: (bytes: number) => void
  setBenchIterations: (measured: number, warmup: number) => void
  setBenchTarget: (target: BenchTarget) => void
  setBenchMethodology: (methodology: BenchMethodology) => void
  setBenchPattern: (pattern: PayloadPattern) => void
}

export const DEFAULT_CONFIG: Rc5Config = { w: 32, r: 12, b: 16 }

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      motion: 'standard',
      config: DEFAULT_CONFIG,
      padding: 'pkcs7',
      keyInputMode: 'text',
      inputMode: 'text',
      benchPayloadBytes: 4096,
      benchWarmupIterations: 200,
      benchMeasuredIterations: 200,
      benchTarget: 'encrypt',
      benchMethodology: 'steady-state',
      benchPattern: 'prng',
      setMotion: (motion) => set({ motion }),
      setConfig: (config) => set({ config }),
      setPadding: (padding) => set({ padding }),
      setKeyInputMode: (keyInputMode) => set({ keyInputMode }),
      setInputMode: (inputMode) => set({ inputMode }),
      setBenchPayloadBytes: (benchPayloadBytes) => set({ benchPayloadBytes }),
      setBenchIterations: (benchMeasuredIterations, benchWarmupIterations) =>
        set({ benchMeasuredIterations, benchWarmupIterations }),
      setBenchTarget: (benchTarget) => set({ benchTarget }),
      setBenchMethodology: (benchMethodology) => set({ benchMethodology }),
      setBenchPattern: (benchPattern) => set({ benchPattern }),
    }),
    {
      name: 'rc5cipherlab.v1.settings',
      version: 1,
    },
  ),
)
