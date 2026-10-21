import { useMemo, useState } from 'react'

import { PADDING_LABELS } from '@/lib/rc5/constants'
import { PageHeader } from '@/components/shell/PageHeader'
import { useSpecItems } from '@/components/shell/specs'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, Notice } from '@/components/ui/Feedback'
import { useExperiments } from '@/state/experiments.store'
import { useSettings } from '@/state/settings.store'
import {
  CompareDistribution,
  DirectionBarsChart,
  LatencyRoundsChart,
  ThroughputPayloadChart,
} from '@/features/compare/CompareCharts'
import {
  CompareMatrix,
  CompatibilityPanel,
  SelectionPanel,
  type SelectionState,
} from '@/features/compare/ComparePanels'
import { InterpretationPanel } from '@/features/compare/InterpretationPanel'
import { analyseComparability, payloadSizesIn, type ResultEntry } from '@/features/compare/compatibility'

/**
 * Compare configurations.
 *
 * The page is built around one rule: measurements are only ranked when they were taken under the same
 * conditions. Anything that does not qualify keeps its absolute values in the table and is excluded
 * from the charts and the interpretation, with the reason printed. The alternative — ranking whatever
 * is selected and letting the reader assume it is fair — is the failure mode this section exists to
 * prevent.
 */
export function ComparePage() {
  const runs = useExperiments((state) => state.runs)
  const padding = useSettings((state) => state.padding)
  const [selection, setSelection] = useState<SelectionState | null>(null)

  const specs = useSpecItems([{ label: 'padding', value: PADDING_LABELS[padding] }])

  const effectiveSelection: SelectionState = selection ?? {
    selectedRunIds: runs.map((run) => run.id),
    payload: 'all',
    target: 'all',
  }

  const selectedEntries = useMemo<ResultEntry[]>(() => {
    const selectedRuns = runs.filter((run) => effectiveSelection.selectedRunIds.includes(run.id))
    return selectedRuns
      .flatMap((run) => run.results.map((result) => ({ run, result })))
      .filter(
        (entry) =>
          effectiveSelection.payload === 'all' || entry.run.payloadBytes === effectiveSelection.payload,
      )
      .filter(
        (entry) => effectiveSelection.target === 'all' || entry.result.target === effectiveSelection.target,
      )
  }, [runs, effectiveSelection.payload, effectiveSelection.target, effectiveSelection.selectedRunIds])

  const allEntries = useMemo<ResultEntry[]>(
    () => runs.flatMap((run) => run.results.map((result) => ({ run, result }))),
    [runs],
  )

  const report = useMemo(() => analyseComparability(selectedEntries), [selectedEntries])
  const rankedIds = useMemo(
    () => new Set(report.ranked.map((entry) => entry.result.id)),
    [report.ranked],
  )
  const excludedIds = useMemo(
    () => new Set(report.excluded.map((entry) => entry.result.id)),
    [report.excluded],
  )

  if (runs.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          index="05"
          category="Measurement"
          title="Compare configurations"
          lead="Put measured configurations side by side, and see when a difference is real."
          specs={specs}
        />
        <EmptyState
          label="No measurements yet"
          title="Comparison needs at least one saved run"
          action={
            <ButtonLink to="/benchmark" variant="primary" glyphAfter="arrow-right">
              Open the Benchmark Lab
            </ButtonLink>
          }
        >
          Run a configuration, save it, then measure a second one under the same workload. Comparison
          holds the payload size, direction and methodology fixed so that the only thing changing is the
          configuration.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        index="05"
        category="Measurement"
        title="Compare configurations"
        lead="Results measured under the same payload, direction and methodology are ranked against each other. Everything else stays visible with its absolute values and is kept out of the ranking, with the reason stated."
        specs={specs}
        actions={
          <ButtonLink to="/benchmark" variant="secondary">
            Run another measurement
          </ButtonLink>
        }
      />

      <SelectionPanel
        runs={runs}
        selection={effectiveSelection}
        onChange={(next) => setSelection({ ...effectiveSelection, ...next })}
        availablePayloads={payloadSizesIn(allEntries)}
      />

      <CompatibilityPanel report={report} />

      <section className="space-y-4">
        <div className="rounded-hair border border-rule bg-sheet">
          <CompareMatrix
            entries={selectedEntries}
            rankedIds={rankedIds}
            excludedIds={excludedIds}
          />
        </div>
        {report.ranked.length > 1 && report.excluded.length > 0 ? (
          <Notice tone="note" title="Sorting does not make rows comparable">
            Rows marked <span className="font-mono">Not ranked</span> were measured under different
            conditions, so their position in this table reflects the sort column only, not a fair
            comparison with the rows around them.
          </Notice>
        ) : null}
      </section>

      <LatencyRoundsChart entries={report.ranked.length > 0 ? report.ranked : selectedEntries} />
      <DirectionBarsChart entries={selectedEntries} />
      <ThroughputPayloadChart entries={selectedEntries} />
      <CompareDistribution entries={report.ranked} />
      <InterpretationPanel ranked={report.ranked} />
    </div>
  )
}
