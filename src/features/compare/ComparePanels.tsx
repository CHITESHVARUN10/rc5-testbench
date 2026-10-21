import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { formatByteCount, formatConfigLabel, formatCount, formatLatency, formatPercent, formatThroughput } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge, DataTable, StatusFlag } from '@/components/ui/Data'
import { EmptyState, Notice } from '@/components/ui/Feedback'
import { Stack, StackHead, StackRow } from '@/components/ui/Surface'
import { Hint, Label, Meta } from '@/components/ui/Text'
import { CheckboxField, Select } from '@/components/ui/Form'
import type { SavedRun } from '@/lib/storage/experiments'
import {
  payloadSizesIn,
  sortEntries,
  type CompareSortKey,
  type ComparabilityReport,
  type ResultEntry,
} from './compatibility'

/**
 * Selection, compatibility, and the comparison matrix.
 *
 * The matrix is a table, not a row of cards: comparison work is vertical scanning, and sorting has to
 * keep columns stable. Its sort controls are real buttons inside the header cells, so the table stays
 * operable from a keyboard without inventing a widget.
 */

export interface SelectionState {
  readonly selectedRunIds: readonly string[]
  readonly payload: 'all' | number
  readonly target: 'all' | 'encrypt' | 'decrypt'
}

export function SelectionPanel({
  runs,
  selection,
  onChange,
  availablePayloads,
}: {
  runs: readonly SavedRun[]
  selection: SelectionState
  onChange: (next: Partial<SelectionState>) => void
  availablePayloads: readonly number[]
}) {
  const allSelected = selection.selectedRunIds.length === runs.length

  return (
    <Stack>
      <StackHead
        index="05.1"
        title="Selection"
        note={`${selection.selectedRunIds.length} of ${runs.length} runs`}
        actions={
          <button
            type="button"
            onClick={() =>
              onChange({ selectedRunIds: allSelected ? [] : runs.map((run) => run.id) })
            }
            className="min-h-9 font-mono text-label uppercase text-signal-ink underline decoration-rule-2 underline-offset-4 hover:decoration-signal-ink"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        }
      />
      <StackRow className="space-y-4">
        <div className="space-y-2">
          <Label>Saved runs</Label>
          <div className="space-y-1">
            {runs.map((run) => (
              <CheckboxField
                key={run.id}
                label={
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-ink">{run.name}</span>
                    <Meta>
                      {run.results.length} result{run.results.length === 1 ? '' : 's'} ·{' '}
                      {formatByteCount(run.payloadBytes)} · {run.methodology}
                    </Meta>
                  </span>
                }
                checked={selection.selectedRunIds.includes(run.id)}
                onChange={(event) =>
                  onChange({
                    selectedRunIds: event.target.checked
                      ? [...selection.selectedRunIds, run.id]
                      : selection.selectedRunIds.filter((id) => id !== run.id),
                  })
                }
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 border-t border-rule pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="compare-payload">
              <Label>Payload size</Label>
            </label>
            <Select
              id="compare-payload"
              value={String(selection.payload)}
              onChange={(event) =>
                onChange({
                  payload: event.target.value === 'all' ? 'all' : Number(event.target.value),
                })
              }
            >
              <option value="all">All payload sizes</option>
              {availablePayloads.map((bytes) => (
                <option key={bytes} value={bytes}>
                  {formatByteCount(bytes)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="compare-target">
              <Label>Direction</Label>
            </label>
            <Select
              id="compare-target"
              value={selection.target}
              onChange={(event) =>
                onChange({ target: event.target.value as SelectionState['target'] })
              }
            >
              <option value="all">Both directions</option>
              <option value="encrypt">Encryption only</option>
              <option value="decrypt">Decryption only</option>
            </Select>
          </div>
        </div>
      </StackRow>
    </Stack>
  )
}

export function CompatibilityPanel({ report }: { report: ComparabilityReport }) {
  if (report.ranked.length === 0) return null

  const single = report.ranked.length === 1 && report.excluded.length === 0

  return (
    <Stack>
      <StackHead index="05.2" title="Comparability" note="what may be ranked together" />
      <StackRow className="space-y-4">
        {single ? (
          <Hint>
            One result is selected. Add another run with the same payload size and methodology to see a
            ranking, or run a rounds sweep in the Benchmark Lab.
          </Hint>
        ) : (
          <Hint>
            {report.ranked.length} result{report.ranked.length === 1 ? '' : 's'} share the same payload
            size, direction, methodology and arithmetic path, so they can be ranked against each other.
            The ranking uses the median, and every line of interpretation below is checked against the
            spread those runs actually showed.
          </Hint>
        )}

        {report.excluded.length > 0 ? (
          <Notice tone="caution" title={`${report.excluded.length} result(s) are not ranked`}>
            <p>
              They were measured under different conditions and are shown with their absolute values
              only. What differs: {report.differences.join('; ')}.
            </p>
            <p className="mt-2">
              Use the payload size and direction filters above to bring the set into agreement, or run
              the missing measurements in the Benchmark Lab.
            </p>
          </Notice>
        ) : null}
      </StackRow>
    </Stack>
  )
}

function SortHeader({
  label,
  sortKey,
  active,
  direction,
  onSort,
  align = 'right',
}: {
  label: string
  sortKey: CompareSortKey
  active: boolean
  direction: 'asc' | 'desc'
  onSort: (key: CompareSortKey) => void
  align?: 'left' | 'right'
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'inline-flex min-h-9 w-full items-center gap-1 font-mono text-label uppercase',
        align === 'right' ? 'justify-end' : 'justify-start',
        active ? 'text-signal-ink' : 'text-ink-3 hover:text-ink',
      )}
    >
      {label}
      <span aria-hidden="true" className="text-ink-4">
        {active ? (direction === 'asc' ? '↑' : '↓') : ''}
      </span>
    </button>
  )
}

export function CompareMatrix({
  entries,
  rankedIds,
  excludedIds,
}: {
  entries: readonly ResultEntry[]
  rankedIds: ReadonlySet<string>
  excludedIds: ReadonlySet<string>
}) {
  const [sort, setSort] = useState<{ key: CompareSortKey; direction: 'asc' | 'desc' }>({
    key: 'median',
    direction: 'asc',
  })

  const sorted = useMemo(
    () => sortEntries(entries, sort.key, sort.direction),
    [entries, sort.key, sort.direction],
  )

  const handleSort = (key: CompareSortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'throughput' ? 'desc' : 'asc' },
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        label="Nothing selected"
        title="No saved results match these filters"
        action={
          <Link to="/benchmark" className="font-mono text-label uppercase text-signal-ink underline underline-offset-4">
            Run a measurement
          </Link>
        }
      >
        Select at least one run above, or change the payload size and direction filters to widen the set.
      </EmptyState>
    )
  }

  return (
    <div className="rounded-hair border border-rule bg-sheet">
      <DataTable<ResultEntry>
        caption="Measured configurations, sorted by the selected column"
        stickyHeader
        rows={sorted}
        getRowKey={(entry) => entry.result.id}
        columns={[
          {
            key: 'config',
            header: (
              <SortHeader
                label="Configuration"
                sortKey="config"
                active={sort.key === 'config'}
                direction={sort.direction}
                onSort={handleSort}
                align="left"
              />
            ),
            render: (entry) => (
              <span className="flex items-center gap-2">
                <span className="font-mono text-ink">{formatConfigLabel(entry.result.config)}</span>
                {rankedIds.has(entry.result.id) && entry === sorted[0] ? (
                  <Badge tone="signal">Lowest median</Badge>
                ) : null}
                {excludedIds.has(entry.result.id) ? <Badge tone="warn">Not ranked</Badge> : null}
                {entry.result.implPath === 'bigint' ? <Badge tone="warn">BigInt</Badge> : null}
              </span>
            ),
          },
          {
            key: 'payload',
            header: (
              <SortHeader
                label="Payload"
                sortKey="payload"
                active={sort.key === 'payload'}
                direction={sort.direction}
                onSort={handleSort}
              />
            ),
            align: 'right',
            render: (entry) => <span className="text-ink-2">{formatByteCount(entry.run.payloadBytes)}</span>,
          },
          {
            key: 'direction',
            header: 'Direction',
            render: (entry) => <span className="text-ink-2">{entry.result.target}</span>,
          },
          {
            key: 'median',
            header: (
              <SortHeader
                label="Median"
                sortKey="median"
                active={sort.key === 'median'}
                direction={sort.direction}
                onSort={handleSort}
              />
            ),
            align: 'right',
            render: (entry) => <span className="text-ink">{formatLatency(entry.result.metrics.medianNs)}</span>,
          },
          {
            key: 'mean',
            header: 'Mean',
            align: 'right',
            render: (entry) => <span className="text-ink-2">{formatLatency(entry.result.metrics.meanNs)}</span>,
          },
          {
            key: 'p95',
            header: 'p95',
            align: 'right',
            render: (entry) => <span className="text-ink-2">{formatLatency(entry.result.metrics.p95Ns)}</span>,
          },
          {
            key: 'spread',
            header: 'Spread',
            align: 'right',
            render: (entry) => (
              <span className={entry.result.metrics.cvPercent > 25 ? 'text-warn' : 'text-ink-2'}>
                {formatPercent(entry.result.metrics.cvPercent)}
              </span>
            ),
          },
          {
            key: 'throughput',
            header: (
              <SortHeader
                label="Throughput"
                sortKey="throughput"
                active={sort.key === 'throughput'}
                direction={sort.direction}
                onSort={handleSort}
              />
            ),
            align: 'right',
            render: (entry) => (
              <span className="text-ink-2">{formatThroughput(entry.result.throughputBytesPerSecond)}</span>
            ),
          },
          {
            key: 'batch',
            header: 'Per sample',
            align: 'right',
            render: (entry) => (
              <span className="text-ink-3">{formatCount(entry.result.opsPerBatch)} ops</span>
            ),
          },
          {
            key: 'setup',
            header: 'Key setup',
            align: 'right',
            render: (entry) =>
              entry.result.keySetupNs === null ? (
                <span className="text-ink-4">included</span>
              ) : (
                <span className="text-ink-3">{formatLatency(entry.result.keySetupNs)}</span>
              ),
          },
          {
            key: 'correct',
            header: 'Round trip',
            render: (entry) => (
              <StatusFlag
                status={entry.result.correctnessStatus === 'verified' ? 'verified' : 'mismatch'}
              />
            ),
          },
          {
            key: 'run',
            header: 'Run',
            render: (entry) => (
              <Link to="/reports" className="text-ink-2 underline decoration-rule-2 underline-offset-4 hover:text-signal-ink">
                {entry.run.name}
              </Link>
            ),
          },
          {
            key: 'environment',
            header: 'Measured on',
            render: (entry) => (
              <span className="text-ink-3">
                {entry.run.environment.browserLabel} · {entry.run.environment.osLabel}
              </span>
            ),
          },
        ]}
      />
    </div>
  )
}

export function availablePayloads(entries: readonly ResultEntry[]): number[] {
  return payloadSizesIn(entries)
}
