import { useMemo, useRef, useState } from 'react'

import {
  formatByteCount,
  formatCount,
  formatConfigLabel,
  formatLatency,
  formatRelative,
  formatTimestamp,
} from '@/lib/format'
import { PAYLOAD_PATTERN_LABELS } from '@/lib/benchmark/prepare'
import { BENCH_METHODOLOGY_LABELS } from '@/lib/benchmark/protocol'
import { PADDING_LABELS } from '@/lib/rc5/constants'
import { runsToCsv, samplesToCsv } from '@/lib/export/csv'
import { parseRunsFile, runsToJson } from '@/lib/export/json'
import { runToMarkdown } from '@/lib/export/markdown'
import type { SavedRun } from '@/lib/storage/experiments'
import { storageStatus } from '@/lib/storage/repository'
import { Button } from '@/components/ui/Button'
import { CopyButton, DownloadButton } from '@/components/ui/Code'
import { Badge, DataTable, StatusFlag } from '@/components/ui/Data'
import { CheckboxField, Field, Select, TextArea, TextInput } from '@/components/ui/Form'
import { EmptyState, InlineError, Notice } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/Overlay'
import { MetaList, MetaListItem, Stack, StackHead, StackRow } from '@/components/ui/Surface'
import { Hint, Label, Meta } from '@/components/ui/Text'
import { Glyph } from '@/components/ui/Glyph'
import { PageHeader } from '@/components/shell/PageHeader'
import { useSpecItems } from '@/components/shell/specs'
import { useExperiments } from '@/state/experiments.store'

/**
 * Experiments and reports.
 *
 * The saved-run library, the full method record behind each run, and the exports. Export formats are
 * chosen so that each one is the right tool for a different job: CSV for a spreadsheet or a statistics
 * package, JSON for a re-import or a script, Markdown for a report that has to be handed in.
 */
export function ReportsPage() {
  const runs = useExperiments((state) => state.runs)
  const removeRun = useExperiments((state) => state.removeRun)
  const updateNotes = useExperiments((state) => state.updateNotes)
  const addTag = useExperiments((state) => state.addTag)
  const removeTag = useExperiments((state) => state.removeTag)
  const importRuns = useExperiments((state) => state.importRuns)
  const clearAll = useExperiments((state) => state.clearAll)
  const lastError = useExperiments((state) => state.lastError)

  const specs = useSpecItems()

  const [search, setSearch] = useState('')
  const [methodologyFilter, setMethodologyFilter] = useState<'all' | 'steady-state' | 'key-setup-included'>('all')
  const [payloadFilter, setPayloadFilter] = useState<'all' | number>('all')
  const [onlyVerified, setOnlyVerified] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importWarnings, setImportWarnings] = useState<readonly string[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const payloads = useMemo(
    () => Array.from(new Set(runs.map((run) => run.payloadBytes))).sort((a, b) => a - b),
    [runs],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return runs.filter((run) => {
      if (methodologyFilter !== 'all' && run.methodology !== methodologyFilter) return false
      if (payloadFilter !== 'all' && run.payloadBytes !== payloadFilter) return false
      if (onlyVerified && run.results.some((result) => result.correctnessStatus !== 'verified')) return false
      if (!needle) return true
      return (
        run.name.toLowerCase().includes(needle) ||
        run.notes.toLowerCase().includes(needle) ||
        run.tags.some((tag) => tag.toLowerCase().includes(needle))
      )
    })
  }, [runs, search, methodologyFilter, payloadFilter, onlyVerified])

  const selected = runs.find((run) => run.id === selectedId) ?? null
  const storage = storageStatus()

  const handleImport = async (file: File) => {
    setImportMessage(null)
    setImportError(null)
    setImportWarnings([])
    const text = await file.text()
    const outcome = parseRunsFile(text)
    if (!outcome.ok) {
      setImportError(outcome.error)
      return
    }
    const result = importRuns(outcome.runs)
    setImportWarnings(outcome.warnings)
    if (result.message) {
      setImportMessage(result.message)
      return
    }
    setImportMessage(
      `Imported ${result.imported} run${result.imported === 1 ? '' : 's'}${result.skipped > 0 ? `, skipped ${result.skipped} record${result.skipped === 1 ? '' : 's'} that did not match the expected shape` : ''}.`,
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        index="07"
        category="Record"
        title="Experiments and reports"
        lead="Every run saved in this browser, with the record of how it was produced. Exports carry the parameters, the workload, the method, the environment and the limitations with them, so a result cannot be separated from what it means."
        specs={specs}
        actions={
          <>
            <DownloadButton
              text={runsToCsv(runs)}
              filename="rc5-cipherlab-runs.csv"
              mime="text/csv"
              label="Export all as CSV"
              disabled={runs.length === 0}
            />
            <DownloadButton
              text={runsToJson(runs)}
              filename="rc5-cipherlab-experiments.json"
              mime="application/json"
              label="Export all as JSON"
              disabled={runs.length === 0}
            />
          </>
        }
        aside={
          lastError ? (
            <Notice tone="caution" title="Storage problem">
              {lastError}
            </Notice>
          ) : null
        }
      />

      {runs.length === 0 ? (
        <EmptyState
          label="Nothing saved yet"
          title="Saved runs appear here"
          action={
            <Button
              variant="primary"
              onClick={() => fileInput.current?.click()}
            >
              Import a run file
            </Button>
          }
        >
          A saved run keeps its parameters, workload, statistics, environment and warnings. Keys and
          plaintext are never saved, and there is no server or account: these records live in this
          browser only.
        </EmptyState>
      ) : (
        <>
          <Stack data-print-hide>
            <StackHead index="07.1" title="Library" note={`${filtered.length} of ${runs.length} runs`} />
            <StackRow className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Search">
                  <TextInput
                    value={search}
                    placeholder="name, note or tag"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </Field>
                <Field label="Methodology">
                  <Select
                    value={methodologyFilter}
                    onChange={(event) =>
                      setMethodologyFilter(event.target.value as typeof methodologyFilter)
                    }
                  >
                    <option value="all">All methodologies</option>
                    <option value="steady-state">Steady state</option>
                    <option value="key-setup-included">Cipher call</option>
                  </Select>
                </Field>
                <Field label="Payload size">
                  <Select
                    value={String(payloadFilter)}
                    onChange={(event) =>
                      setPayloadFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))
                    }
                  >
                    <option value="all">All sizes</option>
                    {payloads.map((bytes) => (
                      <option key={bytes} value={bytes}>
                        {formatByteCount(bytes)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex items-end pb-2">
                  <CheckboxField
                    label="Only runs that verified"
                    checked={onlyVerified}
                    onChange={(event) => setOnlyVerified(event.target.checked)}
                  />
                </div>
              </div>
            </StackRow>

            <StackRow className="p-0 sm:p-0">
              {filtered.length === 0 ? (
                <div className="p-6">
                  <Hint>No saved run matches these filters.</Hint>
                </div>
              ) : (
                <DataTable<SavedRun>
                  caption="Saved benchmark runs"
                  stickyHeader
                  rows={filtered}
                  getRowKey={(run) => run.id}
                  columns={[
                    {
                      key: 'name',
                      header: 'Run',
                      render: (run) => (
                        <span className="flex flex-col gap-1">
                          <span className="text-ink">{run.name}</span>
                          {run.tags.length > 0 ? (
                            <span className="flex flex-wrap gap-1">
                              {run.tags.map((tag) => (
                                <Badge key={tag}>{tag}</Badge>
                              ))}
                            </span>
                          ) : null}
                        </span>
                      ),
                    },
                    {
                      key: 'config',
                      header: 'Configurations',
                      render: (run) => (
                        <span className="font-mono text-ink-2">
                          {Array.from(
                            new Set(run.results.map((result) => formatConfigLabel(result.config))),
                          ).join(', ')}
                        </span>
                      ),
                    },
                    {
                      key: 'payload',
                      header: 'Payload',
                      align: 'right',
                      render: (run) => <span className="text-ink-2">{formatByteCount(run.payloadBytes)}</span>,
                    },
                    {
                      key: 'method',
                      header: 'Method',
                      render: (run) => (
                        <span className="text-ink-3">
                          {run.methodology === 'steady-state' ? 'Steady state' : 'Cipher call'}
                        </span>
                      ),
                    },
                    {
                      key: 'samples',
                      header: 'Samples',
                      align: 'right',
                      render: (run) => (
                        <span className="text-ink-3">{formatCount(run.measuredIterations)}</span>
                      ),
                    },
                    {
                      key: 'median',
                      header: 'Median',
                      align: 'right',
                      render: (run) => {
                        const first = run.results[0]
                        return <span className="text-ink">{first ? formatLatency(first.metrics.medianNs) : '—'}</span>
                      },
                    },
                    {
                      key: 'correct',
                      header: 'Round trip',
                      render: (run) => (
                        <StatusFlag
                          status={
                            run.results.every((result) => result.correctnessStatus === 'verified')
                              ? 'verified'
                              : 'mismatch'
                          }
                        />
                      ),
                    },
                    {
                      key: 'created',
                      header: 'Saved',
                      align: 'right',
                      render: (run) => <Meta>{formatRelative(run.createdAt)}</Meta>,
                    },
                    {
                      key: 'actions',
                      header: 'Record',
                      render: (run) => (
                        <Button
                          compact
                          variant="secondary"
                          glyphAfter="chevron-right"
                          onClick={() => setSelectedId(selectedId === run.id ? null : run.id)}
                        >
                          {selectedId === run.id ? 'Close' : 'Open'}
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </StackRow>
          </Stack>

          {selected ? (
            <RunDetail
              run={selected}
              onDelete={() => setConfirmDelete(selected.id)}
              onNotes={(notes) => updateNotes(selected.id, notes)}
              onAddTag={(tag) => addTag(selected.id, tag)}
              onRemoveTag={(tag) => removeTag(selected.id, tag)}
              onClose={() => setSelectedId(null)}
            />
          ) : null}
        </>
      )}

      <Stack data-print-hide>
        <StackHead index="07.2" title="Data" note="this browser only" />
        <StackRow className="space-y-4">
          <MetaList>
            <MetaListItem term="Runs stored">{runs.length}</MetaListItem>
            <MetaListItem term="Records">
              {runs.reduce((total, run) => total + run.results.length, 0)} measured results
            </MetaListItem>
            <MetaListItem term="Storage used">
              {`${formatByteCount(storage.usedBytes)} of roughly ${formatByteCount(storage.quotaHintBytes)} available`}
            </MetaListItem>
            <MetaListItem term="Storage available">{storage.available ? 'yes' : 'no'}</MetaListItem>
          </MetaList>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" glyph="download" onClick={() => fileInput.current?.click()}>
              Import runs from JSON
            </Button>
            <Button
              variant="danger"
              glyph="trash"
              onClick={() => setConfirmClearAll(true)}
              disabled={runs.length === 0}
            >
              Delete every saved run
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImport(file)
                event.target.value = ''
              }}
            />
          </div>

          {importMessage ? <Hint>{importMessage}</Hint> : null}
          {importWarnings.map((warning) => (
            <Hint key={warning}>{warning}</Hint>
          ))}
          {importError ? <InlineError>{importError}</InlineError> : null}

          <Hint>
            Deleting a run removes it from this browser permanently. Export anything you need to keep:
            there is no server copy and nothing to restore from.
          </Hint>
        </StackRow>
      </Stack>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) removeRun(confirmDelete)
          setSelectedId(null)
        }}
        title="Delete this run?"
        confirmLabel="Delete the run"
        tone="danger"
      >
        <p>
          The record is removed from this browser along with its samples. Its exports, if you have
          already downloaded them, are unaffected.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmClearAll}
        onClose={() => setConfirmClearAll(false)}
        onConfirm={() => {
          clearAll()
          setSelectedId(null)
        }}
        title="Delete every saved run?"
        confirmLabel="Delete everything"
        tone="danger"
      >
        <p>
          {runs.length} run{runs.length === 1 ? '' : 's'} will be removed from this browser. There is no
          server copy and no undo. Export first if any of them matter.
        </p>
      </ConfirmDialog>
    </div>
  )
}

function RunDetail({
  run,
  onDelete,
  onNotes,
  onAddTag,
  onRemoveTag,
  onClose,
}: {
  run: SavedRun
  onDelete: () => void
  onNotes: (notes: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onClose: () => void
}) {
  const [tagDraft, setTagDraft] = useState('')

  return (
    <Stack data-print-block>
      <StackHead
        index="07.3"
        title={run.name}
        note={formatTimestamp(run.createdAt)}
        actions={
          <>
            <Button variant="ghost" compact glyph="close" onClick={onClose}>
              Close
            </Button>
            <Button variant="danger" compact glyph="trash" onClick={onDelete}>
              Delete
            </Button>
          </>
        }
        className="gap-2"
      />

      <StackRow className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <DownloadButton
            text={runsToCsv([run])}
            filename={`${slug(run.name)}-results.csv`}
            mime="text/csv"
            label="Results CSV"
            compact
          />
          <DownloadButton
            text={samplesToCsv([run])}
            filename={`${slug(run.name)}-samples.csv`}
            mime="text/csv"
            label="Raw samples CSV"
            compact
          />
          <DownloadButton
            text={runsToJson([run])}
            filename={`${slug(run.name)}.json`}
            mime="application/json"
            label="JSON record"
            compact
          />
          <DownloadButton
            text={runToMarkdown(run)}
            filename={`${slug(run.name)}-report.md`}
            mime="text/markdown"
            label="Markdown report"
            compact
          />
          <CopyButton text={runToMarkdown(run)} label="Copy report" compact />
          <Button variant="secondary" compact glyph="download" onClick={() => window.print()}>
            Print or save as PDF
          </Button>
        </div>

        <MetaList>
          <MetaListItem term="Algorithm">{run.algorithm}</MetaListItem>
          <MetaListItem term="Configurations">
            {Array.from(new Set(run.results.map((result) => formatConfigLabel(result.config)))).join(', ')}
          </MetaListItem>
          <MetaListItem term="Payload">
            {`${formatByteCount(run.payloadBytes)} · ${PAYLOAD_PATTERN_LABELS[run.payloadPattern]}`}
          </MetaListItem>
          <MetaListItem term="Payload digest">{run.payloadDigest}</MetaListItem>
          <MetaListItem term="Block handling">{PADDING_LABELS[run.paddingPolicy]}</MetaListItem>
          <MetaListItem term="Methodology">{BENCH_METHODOLOGY_LABELS[run.methodology]}</MetaListItem>
          <MetaListItem term="Iterations">
            {`${formatCount(run.measuredIterations)} measured after ${formatCount(run.warmupIterations)} warm-up`}
          </MetaListItem>
          <MetaListItem term="Operations per sample">
            {formatCount(run.results[0]?.opsPerBatch ?? 0)}
          </MetaListItem>
          <MetaListItem term="Timer resolution">
            {run.timerResolutionMs > 0 ? `${(run.timerResolutionMs * 1000).toFixed(1)} µs` : 'not measured'}
          </MetaListItem>
          <MetaListItem term="Environment">
            {`${run.environment.browserLabel} · ${run.environment.osLabel} · ${run.environment.logicalCores ?? 'cores not reported'}`}
          </MetaListItem>
          <MetaListItem term="Cross-origin isolated">
            {run.environment.crossOriginIsolated ? 'yes' : 'no'}
          </MetaListItem>
          <MetaListItem term="Versions">
            {`engine ${run.engineVersion} · methodology ${run.methodologyVersion} · schema ${run.schemaVersion}`}
          </MetaListItem>
        </MetaList>

        <div className="space-y-2">
          <Label>Results</Label>
          <div className="rounded-hair border border-rule bg-sheet">
            <DataTable
              caption="Measured results in this run"
              rows={run.results}
              getRowKey={(result) => result.id}
              columns={[
                {
                  key: 'config',
                  header: 'Configuration',
                  render: (result) => (
                    <span className="font-mono text-ink">{formatConfigLabel(result.config)}</span>
                  ),
                },
                { key: 'target', header: 'Direction', render: (result) => result.target },
                {
                  key: 'median',
                  header: 'Median',
                  align: 'right',
                  render: (result) => formatLatency(result.metrics.medianNs),
                },
                {
                  key: 'p95',
                  header: 'p95',
                  align: 'right',
                  render: (result) => formatLatency(result.metrics.p95Ns),
                },
                {
                  key: 'n',
                  header: 'Samples',
                  align: 'right',
                  render: (result) => formatCount(result.metrics.n),
                },
                {
                  key: 'correct',
                  header: 'Round trip',
                  render: (result) => (
                    <StatusFlag
                      status={result.correctnessStatus === 'verified' ? 'verified' : 'mismatch'}
                    />
                  ),
                },
              ]}
            />
          </div>
        </div>

        {run.warnings.length > 0 ? (
          <div className="space-y-3">
            <Label>Warnings recorded with this run</Label>
            {run.warnings.map((warning) => (
              <p key={warning.code} className="max-w-[76ch] text-sm text-ink-2">
                <span className="font-mono text-label uppercase text-warn">{warning.code}</span>{' '}
                {warning.message}
              </p>
            ))}
          </div>
        ) : null}

        <Field
          label="Notes"
          hint="Kept with the run and included when you export it. Useful for recording what you intended to test."
        >
          <TextArea
            rows={3}
            value={run.notes}
            placeholder="What was this run for?"
            onChange={(event) => onNotes(event.target.value)}
          />
        </Field>

        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap items-center gap-2">
            {run.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1">
                <Badge>{tag}</Badge>
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => onRemoveTag(tag)}
                  className="text-ink-4 hover:text-err"
                >
                  <Glyph name="cross" size={12} />
                </button>
              </span>
            ))}
            <span className="flex items-center gap-2">
              <TextInput
                value={tagDraft}
                placeholder="add a tag"
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    onAddTag(tagDraft)
                    setTagDraft('')
                  }
                }}
                className="w-40"
              />
              <Button
                compact
                variant="secondary"
                onClick={() => {
                  onAddTag(tagDraft)
                  setTagDraft('')
                }}
                disabled={tagDraft.trim().length === 0}
              >
                Add
              </Button>
            </span>
          </div>
        </div>
      </StackRow>
    </Stack>
  )
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'rc5-run'
  )
}
