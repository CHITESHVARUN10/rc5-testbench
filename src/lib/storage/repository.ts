/**
 * Versioned local storage.
 *
 * There is no server and no database: everything the tool remembers lives in this browser, under a
 * versioned key prefix, and only experiment records are written. Secret keys, plaintext, and derived
 * round keys are never persisted, which is why nothing in this module takes them.
 *
 * Every operation is failure-tolerant: storage can be unavailable (private browsing, disabled
 * cookies) or full, and neither case may take the interface down.
 */

export const STORAGE_PREFIX = 'rc5cipherlab.v1'

export const STORAGE_KEYS = {
  experiments: `${STORAGE_PREFIX}.experiments`,
  scenarios: `${STORAGE_PREFIX}.scenarios`,
  settings: `${STORAGE_PREFIX}.settings`,
} as const

export interface StorageStatus {
  readonly available: boolean
  readonly usedBytes: number
  readonly quotaHintBytes: number
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const probe = `${STORAGE_PREFIX}.probe`
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}

export function isStorageAvailable(): boolean {
  return storage() !== null
}

export function readJson<T>(key: string, fallback: T): T {
  const store = storage()
  if (!store) return fallback
  try {
    const raw = store.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export interface WriteResult {
  readonly ok: boolean
  readonly message?: string
}

export function writeJson(key: string, value: unknown): WriteResult {
  const store = storage()
  if (!store) {
    return {
      ok: false,
      message:
        'This browser is not allowing local storage, so nothing can be saved. Experiment history is unavailable in this session.',
    }
  }
  try {
    store.setItem(key, JSON.stringify(value))
    return { ok: true }
  } catch (error) {
    const isQuota =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    return {
      ok: false,
      message: isQuota
        ? 'Local storage is full. Delete some saved runs before saving another.'
        : 'The save failed because storage could not be written. Experiment history is unavailable in this session.',
    }
  }
}

export function removeKey(key: string): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(key)
  } catch {
    // nothing useful to do: the key will be overwritten or ignored
  }
}

/** Total bytes this application occupies in local storage, for the data controls on the Method page. */
export function storageUsageBytes(): number {
  const store = storage()
  if (!store) return 0
  let total = 0
  try {
    for (let index = 0; index < store.length; index++) {
      const key = store.key(index)
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue
      const value = store.getItem(key)
      total += key.length + (value?.length ?? 0)
    }
  } catch {
    return total
  }
  return total
}

export function storageStatus(): StorageStatus {
  return {
    available: isStorageAvailable(),
    usedBytes: storageUsageBytes(),
    // Browsers allow roughly 5 MiB per origin; the exact figure is not exposed, so this is stated as
    // a hint rather than presented as a measurement.
    quotaHintBytes: 5 * 1024 * 1024,
  }
}

/** Remove every key this application owns, leaving other sites' data alone. */
export function clearApplicationStorage(): void {
  const store = storage()
  if (!store) return
  const keys: string[] = []
  try {
    for (let index = 0; index < store.length; index++) {
      const key = store.key(index)
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key)
    }
    for (const key of keys) store.removeItem(key)
  } catch {
    // best effort
  }
}
