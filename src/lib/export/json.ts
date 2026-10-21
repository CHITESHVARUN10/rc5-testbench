import { SCHEMA_VERSION, APP_VERSION, ENGINE_VERSION, METHODOLOGY_VERSION } from '../versions'
import type { SavedRun } from '../storage/experiments'

/**
 * JSON export and import.
 *
 * The envelope carries the versions alongside the records, so an imported file can be checked against
 * what this build understands instead of being trusted blindly. Import validates shape and rejects
 * rather than repairing: a half-understood benchmark record is worse than a refused one.
 */

export interface ExportEnvelope {
  readonly app: string
  readonly appVersion: string
  readonly schemaVersion: number
  readonly engineVersion: string
  readonly methodologyVersion: string
  readonly exportedAt: string
  readonly recordCount: number
  readonly runs: readonly SavedRun[]
}

export function runsToJson(runs: readonly SavedRun[]): string {
  const envelope: ExportEnvelope = {
    app: 'RC5 CipherLab',
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
    exportedAt: new Date().toISOString(),
    recordCount: runs.length,
    runs,
  }
  return `${JSON.stringify(envelope, null, 2)}\n`
}

export type ParseOutcome =
  | { readonly ok: true; readonly runs: unknown[]; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly error: string }

export function parseRunsFile(text: string): ParseOutcome {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      ok: false,
      error: 'That file is not valid JSON, so it cannot be read as an export.',
    }
  }

  const warnings: string[] = []

  if (Array.isArray(parsed)) {
    warnings.push('The file was a bare list of runs with no version information.')
    return { ok: true, runs: parsed, warnings }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'That file does not contain run records.' }
  }

  const envelope = parsed as Partial<ExportEnvelope>

  if (!Array.isArray(envelope.runs)) {
    return {
      ok: false,
      error: 'That file has no "runs" list. It may not be an RC5 CipherLab export.',
    }
  }

  if (typeof envelope.schemaVersion === 'number' && envelope.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `That file was written by a newer version of this tool (schema ${envelope.schemaVersion}; this build reads up to ${SCHEMA_VERSION}). Update before importing it.`,
    }
  }

  if (envelope.methodologyVersion && envelope.methodologyVersion !== METHODOLOGY_VERSION) {
    warnings.push(
      `The file was recorded with methodology ${envelope.methodologyVersion}; this build uses ${METHODOLOGY_VERSION}. Timings from the two are not directly comparable.`,
    )
  }

  if (envelope.engineVersion && envelope.engineVersion !== ENGINE_VERSION) {
    warnings.push(
      `The file was recorded with engine ${envelope.engineVersion}; this build uses ${ENGINE_VERSION}.`,
    )
  }

  return { ok: true, runs: envelope.runs, warnings }
}
