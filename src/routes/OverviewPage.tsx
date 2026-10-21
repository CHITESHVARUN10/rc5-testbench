import { Link } from 'react-router-dom'

import { formatConfigLabel, formatRelative, latencyParts, throughputParts } from '@/lib/format'
import { NAV_ENTRIES } from '@/lib/navigation'
import { ButtonLink } from '@/components/ui/Button'
import { DataTable, Readout, ReadoutCell, ReadoutGrid, StatusFlag } from '@/components/ui/Data'
import { EmptyState, Notice } from '@/components/ui/Feedback'
import { SectionHead } from '@/components/ui/Surface'
import { Label, Lead, Meta } from '@/components/ui/Text'
import { Glyph } from '@/components/ui/Glyph'
import { Stack, StackRow } from '@/components/ui/Surface'
import { useExperiments } from '@/state/experiments.store'
import { useSpecItems } from '@/components/shell/specs'
import { PageHeader } from '@/components/shell/PageHeader'
import type { SavedResult, SavedRun } from '@/lib/storage/experiments'

/**
 * Overview.
 *
 * The start of the tool: what it is for, where to go next, what was measured last, and — stated before
 * anything else — the difference between a measured number, an assumed one, and a computed estimate.
 * A reader should be able to leave this page knowing what the tool will not tell them.
 */

const START_HERE: readonly { index: string; path: string; label: string; detail: string }[] = [
  {
    index: '01',
    path: '/simulator',
    label: 'Encrypt a message',
    detail: 'Choose the parameters, encrypt text or hex, and check the round trip',
  },
  {
    index: '02',
    path: '/benchmark',
    label: 'Measure this machine',
    detail: 'Time a configuration across payload sizes, with warm-up and repeated samples',
  },
  {
    index: '03',
    path: '/compare',
    label: 'Compare configurations',
    detail: 'Hold the workload constant and see which differences are larger than the noise',
  },
]

export function OverviewPage() {
  const runs = useExperiments((state) => state.runs)
  const specs = useSpecItems()
  const latest = runs[0]

  return (
    <div className="space-y-10">
      <PageHeader
        index="01"
        category="RC5 CipherLab"
        title="Interactive RC5 analysis and benchmarking"
        lead="Configure the cipher, watch it encrypt and decrypt real bytes, measure what it costs on this machine, and see how that measured cost fits a timing budget you define. Every number is produced here, in your browser, and every number says where it came from."
        specs={specs}
        actions={
          <>
            <ButtonLink to="/simulator" variant="primary" glyphAfter="arrow-right">
              Open the simulator
            </ButtonLink>
            <ButtonLink to="/learn" variant="secondary">
              Learn RC5 first
            </ButtonLink>
          </>
        }
      />

      <Notice tone="caution" title="What this tool is not">
        RC5 is a legacy cipher and nothing here establishes that any configuration is safe for
        protecting real data. Speed is not strength, key length is not strength, and round count is not
        strength on its own. This is a measurement and learning tool; a security verdict is the one
        thing it will not give you.
      </Notice>

      <section className="space-y-4">
        <SectionHead index="01.1" title="Where to start" />
        <Stack>
          {START_HERE.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="group flex items-start gap-4 px-4 py-4 transition-colors duration-150 ease-instrument hover:bg-well sm:px-5"
            >
              <Meta className="pt-0.5 text-ink-4">{item.index}</Meta>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-ink">{item.label}</span>
                <span className="mt-0.5 block text-sm text-ink-3">{item.detail}</span>
              </span>
              <Glyph
                name="arrow-right"
                size={16}
                className="mt-1 text-ink-4 transition-transform duration-200 ease-instrument group-hover:translate-x-0.5 group-hover:text-signal-ink"
              />
            </Link>
          ))}
        </Stack>
      </section>

      <section className="space-y-4">
        <SectionHead
          index="01.2"
          title="Last experiment"
          note={latest ? formatRelative(latest.createdAt) : undefined}
          actions={<ButtonLink to="/reports" variant="ghost" compact>All experiments</ButtonLink>}
        />
        {latest ? (
          <LatestRun run={latest} />
        ) : (
          <EmptyState
            label="No measurements yet"
            title="Nothing has been benchmarked in this browser"
            action={
              <ButtonLink to="/benchmark" variant="primary" glyphAfter="arrow-right">
                Run the first measurement
              </ButtonLink>
            }
          >
            Saved runs appear here with their parameters, payload size, and method. Experiments live in
            this browser only: there is no account and no server, which also means clearing site data
            removes them.
          </EmptyState>
        )}
      </section>

      {runs.length > 1 ? (
        <section className="space-y-4">
          <SectionHead index="01.3" title="Recent runs" note={`${runs.length} saved in this browser`} />
          <div className="rounded-hair border border-rule bg-sheet">
            <DataTable<SavedRun>
              caption="Recently saved benchmark runs"
              stickyHeader
              rows={runs.slice(0, 6)}
              getRowKey={(run) => run.id}
              columns={[
                {
                  key: 'name',
                  header: 'Run',
                  render: (run) => (
                    <Link to="/reports" className="text-ink hover:text-signal-ink">
                      {run.name}
                    </Link>
                  ),
                },
                {
                  key: 'config',
                  header: 'Configuration',
                  render: (run) => (
                    <span className="font-mono text-ink-2">
                      {run.results[0] ? formatConfigLabel(run.results[0].config) : '—'}
                      {run.results.length > 1 ? <span className="text-ink-4"> +{run.results.length - 1}</span> : null}
                    </span>
                  ),
                },
                {
                  key: 'payload',
                  header: 'Payload',
                  align: 'right',
                  render: (run) => <span className="text-ink-2">{run.payloadBytes.toLocaleString('en-US')} B</span>,
                },
                {
                  key: 'median',
                  header: 'Median',
                  align: 'right',
                  render: (run) => {
                    const first = run.results[0]
                    if (!first) return '—'
                    const { value, unit } = latencyParts(first.metrics.medianNs)
                    return (
                      <span>
                        {value} <span className="text-label text-ink-3">{unit}</span>
                      </span>
                    )
                  },
                },
                {
                  key: 'correctness',
                  header: 'Round trip',
                  render: (run) => (
                    <StatusFlag
                      status={run.results.every((result) => result.correctnessStatus === 'verified') ? 'verified' : 'mismatch'}
                    />
                  ),
                },
                {
                  key: 'when',
                  header: 'Saved',
                  align: 'right',
                  render: (run) => <Meta>{formatRelative(run.createdAt)}</Meta>,
                },
              ]}
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHead index="01.4" title="Measured, assumed, or estimated" />
        <Stack>
          <StackRow className="space-y-3">
            <Lead>
              Every figure in this tool is one of three things, and the interface labels which. Mixing
              them is the most common way a performance claim goes wrong.
            </Lead>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
              <Provenance
                status="measured"
                title="Measured"
                detail="Taken from the clock on this machine during a run: latency samples, throughput, the key schedule timing. Carries a sample count and a spread, and means nothing without them."
              />
              <Provenance
                status="assumed"
                title="User-entered"
                detail="Values you supply: payload size, link bandwidth, network delay, a deadline. They are assumptions about a scenario, not observations."
              />
              <Provenance
                status="estimated"
                title="Estimated"
                detail="Computed from measurements plus assumptions, such as a transmission time or a total budget. Arithmetic on a measured number is still an estimate."
              />
            </div>
          </StackRow>
        </Stack>
      </section>
    </div>
  )
}

function Provenance({
  status,
  title,
  detail,
}: {
  status: 'measured' | 'assumed' | 'estimated'
  title: string
  detail: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <StatusFlag status={status} />
      </div>
      <p className="text-sm text-ink-2">{detail}</p>
      <Label>{title}</Label>
    </div>
  )
}

function LatestRun({ run }: { run: SavedRun }) {
  const first: SavedResult | undefined = run.results[0]
  const { value: medianValue, unit: medianUnit } = latencyParts(first?.metrics.medianNs)
  const { value: throughputValue, unit: throughputUnit } = throughputParts(
    first?.throughputBytesPerSecond,
  )

  return (
    <div className="space-y-4">
      <ReadoutGrid>
        <ReadoutCell>
          <Readout label="Run" value={run.name} note={formatRelative(run.createdAt)} />
        </ReadoutCell>
        <ReadoutCell>
          <Readout
            label="Configuration"
            value={first ? formatConfigLabel(first.config) : '—'}
            note={run.results.length > 1 ? `${run.results.length} configurations measured` : 'Single configuration'}
          />
        </ReadoutCell>
        <ReadoutCell>
          <Readout label="Median latency" value={medianValue} unit={medianUnit} note="per operation, this machine" />
        </ReadoutCell>
        <ReadoutCell>
          <Readout
            label="Throughput"
            value={throughputValue}
            unit={throughputUnit}
            note={`at ${run.payloadBytes.toLocaleString('en-US')} B payload`}
          />
        </ReadoutCell>
        <ReadoutCell>
          <Readout
            label="Samples"
            value={String(run.measuredIterations)}
            note={`after ${run.warmupIterations} warm-up iterations`}
          />
        </ReadoutCell>
        <ReadoutCell>
          <Readout
            label="Batch"
            value={first ? String(first.opsPerBatch) : '—'}
            note="operations per sample"
          />
        </ReadoutCell>
        <ReadoutCell>
          <Readout
            label="Timer"
            value={run.timerResolutionMs > 0 ? String((run.timerResolutionMs * 1000).toFixed(0)) : '—'}
            unit="µs"
            note="reported resolution"
          />
        </ReadoutCell>
        <ReadoutCell>
          <Readout
            label="Round trip"
            value={run.results.every((result) => result.correctnessStatus === 'verified') ? 'verified' : 'failed'}
            note="output recovered from input"
          />
        </ReadoutCell>
      </ReadoutGrid>
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink to="/reports" variant="secondary" glyphAfter="arrow-right">
          Open the full record
        </ButtonLink>
        <ButtonLink to="/compare" variant="ghost">
          Compare with another configuration
        </ButtonLink>
      </div>
    </div>
  )
}

export const OVERVIEW_SECTION_COUNT = NAV_ENTRIES.length
