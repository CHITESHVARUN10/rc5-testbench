import type { BenchGroupResult } from '@/lib/benchmark/protocol'
import { interpretGroups } from '@/lib/benchmark/interpret'
import { Stack, StackHead, StackRow } from '@/components/ui/Surface'
import { Hint } from '@/components/ui/Text'
import { Glyph } from '@/components/ui/Glyph'
import { cn } from '@/lib/cn'
import type { ResultEntry } from './compatibility'

/**
 * Interpretation.
 *
 * Every sentence here is produced by a pure function over the measurements, and the module it comes
 * from is covered by tests that fail if a timing is ever turned into a statement about security. The
 * panel is a reading of the data, not a verdict: it says which differences survived the noise, which
 * did not, and what neither can tell you.
 */

function toGroup(entry: ResultEntry): BenchGroupResult {
  const result = entry.result
  return {
    config: result.config,
    implPath: result.implPath,
    target: result.target,
    payloadBytes: result.payloadBytes,
    blocks: result.blocks,
    bytesProcessed: result.bytesProcessed,
    opsPerBatch: result.opsPerBatch,
    metrics: result.metrics,
    throughputBytesPerSecond: result.throughputBytesPerSecond,
    samplesNs: result.samplesNs,
    rawSampleCount: result.rawSampleCount,
    correctnessStatus: result.correctnessStatus,
    warnings: result.warnings,
    keySetupNs: result.keySetupNs,
  }
}

export function InterpretationPanel({ ranked }: { ranked: readonly ResultEntry[] }) {
  const groups = ranked.map(toGroup)
  const lines = interpretGroups(groups)

  return (
    <Stack>
      <StackHead index="05.7" title="Interpretation" note="what these numbers support" />
      <StackRow className="space-y-4">
        {groups.length === 0 ? (
          <Hint>Select at least one result to read an interpretation of it.</Hint>
        ) : (
          <ul className="space-y-3">
            {lines.map((line, index) => (
              <li key={`${line.kind}-${index}`} className="flex gap-3">
                <Glyph name={glyphFor(line.kind)} size={14} className={cn('mt-1', toneFor(line.kind))} />
                <p className={cn('max-w-[76ch] text-sm', toneFor(line.kind, true))}>{line.text}</p>
              </li>
            ))}
          </ul>
        )}

        <Hint>
          Sentences about rankings are only produced when the difference is wider than the variation the
          runs showed on their own. Where it is not, the panel says so instead of naming a winner.
        </Hint>
      </StackRow>
    </Stack>
  )
}

function glyphFor(kind: 'finding' | 'variability' | 'caveat' | 'insufficient' | 'exclusion') {
  switch (kind) {
    case 'finding':
      return 'dot' as const
    case 'variability':
      return 'warn' as const
    case 'exclusion':
      return 'warn' as const
    case 'caveat':
      return 'info' as const
    case 'insufficient':
      return 'dash' as const
  }
}

function toneFor(kind: 'finding' | 'variability' | 'caveat' | 'insufficient' | 'exclusion', text = false): string {
  switch (kind) {
    case 'finding':
      return text ? 'text-ink' : 'text-signal-ink'
    case 'variability':
      return text ? 'text-ink-2' : 'text-warn'
    case 'exclusion':
      return text ? 'text-ink-2' : 'text-warn'
    case 'caveat':
      return text ? 'text-ink-3' : 'text-ink-4'
    case 'insufficient':
      return text ? 'text-ink-2' : 'text-ink-4'
  }
}
