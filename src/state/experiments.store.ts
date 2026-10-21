import { create } from 'zustand'

import type { BenchRunResult } from '@/lib/benchmark/protocol'
import { isSavedRun, savedRunFrom, type SavedRun } from '@/lib/storage/experiments'
import {
  STORAGE_KEYS,
  isStorageAvailable,
  readJson,
  writeJson,
  type WriteResult,
} from '@/lib/storage/repository'

/**
 * Saved experiments.
 *
 * Storage is read once at start-up and written back on every change, so the store is the single source
 * of truth and the browser copy is a projection of it. A write failure is reported to the caller
 * rather than swallowed: the Experiments page has to be able to say that a save did not happen.
 *
 * The cap protects the user's storage quota. When it is reached the oldest run is dropped, and the
 * caller is told, instead of the save failing silently at the quota boundary.
 */

const MAX_SAVED_RUNS = 80

interface PersistedShape {
  runs: SavedRun[]
}

interface ExperimentsState {
  runs: SavedRun[]
  lastError: string | null
  saveRun: (run: BenchRunResult, options?: { name?: string; notes?: string; tags?: readonly string[] }) => WriteResult
  removeRun: (id: string) => void
  renameRun: (id: string, name: string) => void
  updateNotes: (id: string, notes: string) => void
  addTag: (id: string, tag: string) => void
  removeTag: (id: string, tag: string) => void
  importRuns: (records: unknown) => { imported: number; skipped: number; message?: string }
  clearAll: () => void
}

function loadInitial(): SavedRun[] {
  const stored = readJson<PersistedShape>(STORAGE_KEYS.experiments, { runs: [] })
  if (!Array.isArray(stored.runs)) return []
  return stored.runs.filter(isSavedRun)
}

function persist(runs: SavedRun[]): WriteResult {
  return writeJson(STORAGE_KEYS.experiments, { runs })
}

export const useExperiments = create<ExperimentsState>((set, get) => ({
  runs: loadInitial(),
  lastError: isStorageAvailable()
    ? null
    : 'This browser is not allowing local storage, so runs cannot be saved in this session.',

  saveRun: (run, options) => {
    const record = savedRunFrom(run, options)
    const existing = get().runs.filter((candidate) => candidate.id !== record.id)
    let next = [record, ...existing]

    let message: string | undefined
    if (next.length > MAX_SAVED_RUNS) {
      const dropped = next.length - MAX_SAVED_RUNS
      next = next.slice(0, MAX_SAVED_RUNS)
      message = `Saved. The oldest ${dropped} run${dropped === 1 ? '' : 's'} were dropped to stay inside this browser's storage limit.`
    }

    const outcome = persist(next)
    if (!outcome.ok) {
      set({ lastError: outcome.message ?? 'The run could not be saved.' })
      return outcome
    }

    set({ runs: next, lastError: message ?? null })
    return { ok: true, message }
  },

  removeRun: (id) => {
    const next = get().runs.filter((run) => run.id !== id)
    const outcome = persist(next)
    set({ runs: outcome.ok ? next : get().runs, lastError: outcome.ok ? null : outcome.message ?? null })
  },

  renameRun: (id, name) => {
    const next = get().runs.map((run) => (run.id === id ? { ...run, name } : run))
    const outcome = persist(next)
    set({ runs: outcome.ok ? next : get().runs, lastError: outcome.ok ? null : outcome.message ?? null })
  },

  updateNotes: (id, notes) => {
    const next = get().runs.map((run) => (run.id === id ? { ...run, notes } : run))
    const outcome = persist(next)
    set({ runs: outcome.ok ? next : get().runs, lastError: outcome.ok ? null : outcome.message ?? null })
  },

  addTag: (id, tag) => {
    const cleaned = tag.trim()
    if (!cleaned) return
    const next = get().runs.map((run) =>
      run.id === id && !run.tags.includes(cleaned) ? { ...run, tags: [...run.tags, cleaned] } : run,
    )
    const outcome = persist(next)
    set({ runs: outcome.ok ? next : get().runs, lastError: outcome.ok ? null : outcome.message ?? null })
  },

  removeTag: (id, tag) => {
    const next = get().runs.map((run) =>
      run.id === id ? { ...run, tags: run.tags.filter((existing) => existing !== tag) } : run,
    )
    const outcome = persist(next)
    set({ runs: outcome.ok ? next : get().runs, lastError: outcome.ok ? null : outcome.message ?? null })
  },

  importRuns: (records) => {
    if (!Array.isArray(records)) {
      return { imported: 0, skipped: 0, message: 'The file did not contain a list of runs.' }
    }

    const incoming = records.filter(isSavedRun)
    const skipped = records.length - incoming.length
    const existingIds = new Set(get().runs.map((run) => run.id))
    const fresh = incoming.filter((run) => !existingIds.has(run.id))

    if (fresh.length === 0) {
      return {
        imported: 0,
        skipped,
        message:
          incoming.length > 0
            ? 'Every run in that file is already saved here.'
            : 'No valid run records were found in that file.',
      }
    }

    const next = [...fresh, ...get().runs].slice(0, MAX_SAVED_RUNS)
    const outcome = persist(next)
    if (!outcome.ok) {
      set({ lastError: outcome.message ?? 'The import could not be saved.' })
      return { imported: 0, skipped, message: outcome.message }
    }

    set({ runs: next, lastError: null })
    return { imported: fresh.length, skipped }
  },

  clearAll: () => {
    const outcome = persist([])
    set({ runs: [], lastError: outcome.ok ? null : outcome.message ?? null })
  },
}))

export function findRun(runs: readonly SavedRun[], id: string): SavedRun | undefined {
  return runs.find((run) => run.id === id)
}

export function allResults(runs: readonly SavedRun[]): SavedRun['results'] {
  return runs.flatMap((run) => run.results)
}
