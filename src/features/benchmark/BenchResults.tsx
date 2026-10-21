import { useEffect, useState } from 'react'

import { PAYLOAD_PATTERN_LABELS } from '@/lib/benchmark/prepare'
import { BENCH_METHODOLOGY_LABELS } from '@/lib/benchmark/protocol'
import type { BenchGroupResult } from '@/lib/benchmark/protocol'
import {
  byteParts,
  formatConfigLabel,
  formatCount,
  formatLatency,
  formatMilliseconds,
  formatPercent,
  formatThroughput,
  formatTimestamp,
} from '@/lib/format'
import { DataTable, Readout, ReadoutCell, ReadoutGrid, StatusFlag, Badge } from '@/components/ui/Data'
import { DistributionKey, DistributionStrip } from '@/components/charts/DistributionStrip'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Form'
import { EmptyState, InlineError, Notice } from '@/components/ui/Feedback'
import { MetaList, MetaListItem, Stack, StackHead, StackRow } from '@/components/ui/Surface'
import { Hint, Label, Meta } from '@/components/ui/Text'
import { useBenchmarkStore } from '@/state/benchmark.store'
import { useExperiments } from '@/state/experiments.store'
import type { BenchForm } from './useBenchForm'

/**
 * Results.
 *
 * The statistics are shown together with the method that produced them — batch size, timer
 * resolution, iteration counts, and what was inside the timed region — because a mean latency without
 * those is not a result, it is a rumour. Warnings are given the same weight as the numbers.
 */

export function BenchResults({ form }: { form: BenchForm }) {
  const result = useBenchmarkStore((state) => state.result)
  const status = useBenchmarkStore((state) => state.status)
  const saveRun = useExperiments((state) => state.saveRun)

  const [name, setName] = useState('')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  useEffect(() => {
    if (result) {
      setName(result.name)
      setSaveMessage(null)
      setSaveError(null)
      setSavedId(null)
    }
  }, [result])

  if (status === 'cancelled') {
    return (
      <Stack>
        <StackHead index="04.4" title="Results" note="the run did not finish" />
        <StackRow>
          <Notice tone="caution" title="Run cancelled">
            A cancelled run produces no result and is not saved. Partial samples are discarded rather
            than reported as if they were a complete measurement.
          </Notice>
        </StackRow>
      </Stack>
    )
  }

  if (!result) {
    return (
      <Stack>
        <StackHead index="04.4" title="Results" />
        <StackRow>
          <EmptyState
            label="Waiting for a run"
            title="Nothing measured yet in this session"
            action={
              <ButtonLink to="/methodology" variant="secondary">
                Read how timing works first
              </ButtonLink>
            }
          >
            A run produces per-operation latency statistics, a distribution, the environment it ran in,
            and any warnings about how much the numbers can be trusted. Saved runs appear under
            Experiments.
          </EmptyState>
        </StackRow>
      </Stack>
    )
  }

  const groups = result.groups
  const fastest = groups
    .filter((group) => group.implPath === 'number')
    .slice()
    .sort((a, b) => a.metrics.medianNs - b.metrics.medianNs)[0]

  const allVerified = groups.every((group) => group.correctnessStatus === 'verified')

  return (
    <>
      <Stack>
        <StackHead
          index="04.4"
          title="Statistics"
          note={`${groups.length} result group${groups.length === 1 ? '' : 's'}`}
          actions={<StatusFlag status={allVerified ? 'verified' : 'mismatch'} />}
        />

        <StackRow className="p-0 sm:p-0">
          <DataTable<BenchGroupResult>
            caption="Measured latency statistics per configuration and direction"
            stickyHeader
            rows={groups}
            getRowKey={(group) => `${group.config.w}-${group.config.r}-${group.config.b}-${group.target}`}
            columns={[
              {
                key: 'config',
                header: 'Configuration',
                render: (group) => (
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-ink">{formatConfigLabel(group.config)}</span>
                    {fastest && group === fastest ? <Badge tone="signal">Quickest here</Badge> : null}
                    {group.implPath === 'bigint' ? <Badge tone="warn">BigInt</Badge> : null}
                  </span>
                ),
              },
              {
                key: 'target',
                header: 'Direction',
                render: (group) => <span className="text-ink-2">{group.target}</span>,
              },
              {
                key: 'mean',
                header: 'Mean',
                align: 'right',
                render: (group) => formatLatency(group.metrics.meanNs),
              },
              {
                key: 'median',
                header: 'Median',
                align: 'right',
                render: (group) => <span className="text-ink">{formatLatency(group.metrics.medianNs)}</span>,
              },
              {
                key: 'min',
                header: 'Min',
                align: 'right',
                render: (group) => <span className="text-ink-2">{formatLatency(group.metrics.minNs)}</span>,
              },
              {
                key: 'p95',
                header: 'p95',
                align: 'right',
                render: (group) => <span className="text-ink-2">{formatLatency(group.metrics.p95Ns)}</span>,
              },
              {
                key: 'cv',
                header: 'Spread',
                align: 'right',
                render: (group) => (
                  <span className={group.metrics.cvPercent > 25 ? 'text-warn' : 'text-ink-2'}>
                    {formatPercent(group.metrics.cvPercent)}
                  </span>
                ),
              },
              {
                key: 'throughput',
                header: 'Throughput',
                align: 'right',
                render: (group) => formatThroughput(group.throughputBytesPerSecond),
              },
              {
                key: 'batch',
                header: 'Per sample',
                align: 'right',
                render: (group) => (
                  <span className="text-ink-3">{formatCount(group.opsPerBatch)} ops</span>
                ),
              },
              {
                key: 'setup',
                header: 'Key setup',
                align: 'right',
                render: (group) =>
                  group.keySetupNs === null ? (
                    <span className="text-ink-4">included</span>
                  ) : (
                    <span className="text-ink-3">{formatLatency(group.keySetupNs)}</span>
                  ),
              },
              {
                key: 'correct',
                header: 'Round trip',
                render: (group) => (
                  <StatusFlag status={group.correctnessStatus === 'verified' ? 'verified' : 'mismatch'} />
                ),
              },
            ]}
          />
        </StackRow>
      </Stack>

      <Stack>
        <StackHead index="04.5" title="Distribution" note="every sample, not just the average" />
        <StackRow className="space-y-4">
          <DistributionStrip
            ariaLabel="Per-operation latency distribution for each measured configuration"
            series={groups.map((group) => ({
              id: `${group.config.w}-${group.config.r}-${group.config.b}-${group.target}-${group.implPath}`,
              label: `${formatConfigLabel(group.config)} ${group.target === 'encrypt' ? 'enc' : 'dec'}`,
              note: `n=${group.rawSampleCount} · ${formatCount(group.opsPerBatch)} ops/sample`,
              summary: group.metrics,
              samples: group.samplesNs,
              accent: fastest !== undefined && group === fastest,
              pattern: group.implPath === 'bigint' ? 'hatch' : 'solid',
            }))}
          />
          <DistributionKey />
        </StackRow>
      </Stack>

      <Stack>
        <StackHead index="04.6" title="Method record" note="what produced these numbers" />
        <StackRow className="space-y-5">
          <ReadoutGrid>
            <ReadoutCell>
              <Readout
                label="Timer resolution"
                value={result.timerResolutionMs > 0 ? String((result.timerResolutionMs * 1000).toFixed(1)) : '—'}
                unit="µs"
                note="smallest step this browser reports"
              />
            </ReadoutCell>
            <ReadoutCell>
              <Readout
                label="Operations per sample"
                value={formatCount(groups[0].opsPerBatch)}
                note="batch size, divided out of each sample"
              />
            </ReadoutCell>
            <ReadoutCell>
              <Readout
                label="Payload"
                value={byteParts(result.spec.payloadBytes).value}
                unit={byteParts(result.spec.payloadBytes).unit}
                note={`${groups[0].blocks} blocks of ${groups[0].bytesProcessed / groups[0].blocks} B`}
              />
            </ReadoutCell>
            <ReadoutCell>
              <Readout
                label="Samples"
                value={formatCount(result.spec.measuredIterations)}
                note={`after ${formatCount(result.spec.warmupIterations)} warm-up iterations`}
              />
            </ReadoutCell>
            <ReadoutCell>
              <Readout
                label="Run duration"
                value={formatMilliseconds(result.durationMs)}
                note="wall clock for the whole run"
              />
            </ReadoutCell>
            <ReadoutCell>
              <Readout
                label="Payload digest"
                value={result.payloadDigest}
                note={PAYLOAD_PATTERN_LABELS[result.spec.pattern]}
              />
            </ReadoutCell>
          </ReadoutGrid>

          <div className="space-y-2">
            <Label>Environment</Label>
            <MetaList>
              <MetaListItem term="Runtime">{result.environment.runtime}</MetaListItem>
              <MetaListItem term="Browser">{result.environment.browserLabel}</MetaListItem>
              <MetaListItem term="System">{result.environment.osLabel}</MetaListItem>
              <MetaListItem term="Logical cores">
                {result.environment.logicalCores ?? 'not reported'}
              </MetaListItem>
              <MetaListItem term="Cross-origin isolated">
                {result.environment.crossOriginIsolated ? 'yes' : 'no'}
              </MetaListItem>
              <MetaListItem term="Methodology">{BENCH_METHODOLOGY_LABELS[result.spec.methodology]}</MetaListItem>
              <MetaListItem term="Timed region">
                {result.spec.methodology === 'steady-state'
                  ? 'block processing and byte conversion; key schedule excluded'
                  : 'key schedule, block processing and byte conversion'}
              </MetaListItem>
              <MetaListItem term="Outside the timed region">
                payload generation, buffer allocation, padding, and the correctness check
              </MetaListItem>
              <MetaListItem term="Finished">{formatTimestamp(result.finishedAt)}</MetaListItem>
              <MetaListItem term="Engine / method">{`${result.engineVersion} / ${result.methodologyVersion}`}</MetaListItem>
            </MetaList>
          </div>

          {result.warnings.length > 0 ? (
            <div className="space-y-3">
              <Label>Warnings</Label>
              {result.warnings.map((warning) => (
                <Notice
                  key={warning.code}
                  tone={warning.code === 'bigint-path' || warning.code === 'noisy' ? 'caution' : 'note'}
                  title={warningTitle(warning.code)}
                >
                  {warning.message}
                </Notice>
              ))}
            </div>
          ) : (
            <Hint>No warnings: the run was long enough, steady enough, and used the expected arithmetic path.</Hint>
          )}
        </StackRow>
      </Stack>

      <Stack>
        <StackHead index="04.7" title="Save this run" note="stored in this browser only" />
        <StackRow className="space-y-4">
          <Field
            label="Run name"
            hint="Saved runs can be compared, exported as CSV, JSON or a Markdown report, and deleted. No key or plaintext is stored: the run records the parameters, the workload, and the numbers."
          >
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={() => {
                const outcome = saveRun(result, { name })
                if (outcome.ok) {
                  setSavedId(result.runId)
                  setSaveMessage(outcome.message ?? 'Saved to Experiments.')
                  setSaveError(null)
                } else {
                  setSaveError(outcome.message ?? 'The run could not be saved.')
                }
              }}
              disabled={savedId === result.runId}
            >
              {savedId === result.runId ? 'Saved' : 'Save run'}
            </Button>
            {savedId ? (
              <ButtonLink to="/reports" variant="secondary" glyphAfter="arrow-right">
                Open in Experiments
              </ButtonLink>
            ) : null}
            <ButtonLink to="/compare" variant="ghost">
              Compare configurations
            </ButtonLink>
          </div>

          {saveMessage ? <Hint>{saveMessage}</Hint> : null}
          {saveError ? <InlineError>{saveError}</InlineError> : null}
          {form.form.mode === 'sweep' ? (
            <Meta>
              A sweep is saved as one experiment containing {groups.length} results, so its
              latency-versus-rounds chart is preserved.
            </Meta>
          ) : null}
        </StackRow>
      </Stack>
    </>
  )
}

function warningTitle(code: string): string {
  switch (code) {
    case 'noisy':
      return 'The run was noisy'
    case 'few-samples':
      return 'Too few samples for p95'
    case 'coarse-timer':
      return 'The timer is coarse'
    case 'max-batch-reached':
      return 'Batch size limit reached'
    case 'bigint-path':
      return 'BigInt arithmetic'
    case 'high-load':
      return 'Other work interfered'
    case 'large-workload':
      return 'Large workload'
    case 'cross-origin-isolated':
      return 'Timer may be coarsened'
    default:
      return 'Note'
  }
}
