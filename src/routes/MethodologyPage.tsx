import { useState, type ReactNode } from 'react'

import { BENCH_LIMITS, BENCH_METHODOLOGY_LABELS } from '@/lib/benchmark/protocol'
import { PAYLOAD_PATTERN_NOTES } from '@/lib/benchmark/prepare'
import { getTimerResolutionMs } from '@/lib/env'
import { MAX_KEY_BYTES, MAX_ROUNDS, PAYLOAD_PRESETS } from '@/lib/rc5/constants'
import { RFC2040_VECTORS } from '@/lib/rc5/vectors'
import { APP_VERSION, ENGINE_VERSION, METHODOLOGY_VERSION, SCHEMA_VERSION } from '@/lib/versions'
import { formatMilliseconds } from '@/lib/format'
import { clearApplicationStorage, storageStatus } from '@/lib/storage/repository'
import { PageHeader } from '@/components/shell/PageHeader'
import { MotionControl } from '@/components/shell/MotionControl'
import { useSpecItems } from '@/components/shell/specs'
import { Button } from '@/components/ui/Button'
import { Badge, DataTable } from '@/components/ui/Data'
import { Notice } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/Overlay'
import { Rule, Stack, StackHead, StackRow, Well } from '@/components/ui/Surface'
import { Hint, Label, Prose } from '@/components/ui/Text'
import { useExperiments } from '@/state/experiments.store'

/**
 * Methodology and about.
 *
 * The page a reader lands on when they want to know whether to believe a number. It states the timing
 * method, the exact statistical definitions, what the environment record can and cannot identify, what
 * the test suite actually covers, and what none of it entitles anyone to conclude. The data controls
 * live here too, because they belong with the explanation of what is stored.
 *
 * Several statements here are weaker than they could be — the 64-bit correctness claim, the
 * environment record, the absence of any hardware measurement — and they are written that way
 * deliberately. A methodology page that overstates its own evidence is worse than no page.
 */
export function MethodologyPage() {
  const specs = useSpecItems()
  const runs = useExperiments((state) => state.runs)
  const clearAll = useExperiments((state) => state.clearAll)
  const [confirmReset, setConfirmReset] = useState(false)

  const timerResolutionMs = getTimerResolutionMs()
  const storage = storageStatus()

  const resetEverything = () => {
    clearApplicationStorage()
    clearAll()
  }

  return (
    <div className="space-y-10">
      <PageHeader
        index="08"
        category="Method"
        title="Methodology and about"
        lead="How every number in this tool is produced, what it can support, and what it cannot. If a result here matters to a decision or a mark, this is the page that says whether it should."
        specs={specs}
      />

      <Notice tone="caution" title="The standing statement">
        RC5 CipherLab is a measurement and learning tool, not a security-certification tool. Nothing in
        it establishes that a configuration is suitable for protecting real data, and no measurement it
        produces is evidence about cryptographic strength.
      </Notice>

      <section className="space-y-4">
        <StackHead index="08.1" title="Measured, assumed, estimated" />
        <Prose>
          <p>Three kinds of number appear in this application, and each one is labelled where it is shown:</p>
          <ul>
            <li>
              <strong>Measured</strong>: taken from the clock during a run on this machine — per-operation
              latency samples, throughput, key schedule time. A measured value always has a sample count
              and a spread attached, and it means nothing without them.
            </li>
            <li>
              <strong>User-entered</strong>: values you supply, such as a payload size, a link rate, a
              network delay or a deadline. They are assumptions about a scenario, and the Scenario Planner
              labels them as yours precisely so they cannot be mistaken for observations.
            </li>
            <li>
              <strong>Estimated</strong>: computed from the other two, such as a transmission time or a
              total against a budget. Arithmetic on a measured number is still an estimate.
            </li>
          </ul>
          <p>
            The Scenario Planner is built around this distinction. Its budget bar draws measured segments
            solid and assumed or estimated segments hatched, and its breakdown table carries an origin
            column on every row.
          </p>
        </Prose>
      </section>

      <section className="space-y-4">
        <StackHead index="08.2" title="How timing works" />
        <NumberedProse>
          <p>
            A benchmark run happens in a Web Worker, so that rendering the interface is not inside the
            timed region. Within a run, the procedure for each configuration is:
          </p>
          <ol>
            <li>Generate the payload and allocate the input and output buffers once, before timing.</li>
            <li>
              Expand the key schedule before the first timed operation. In steady-state mode it stays
              outside the timed region for the whole run; in cipher-call mode it is inside it.
            </li>
            <li>
              Run the configured number of warm-up iterations and discard every one of them. The first
              executions of any function in a JavaScript engine are interpreted before the optimiser
              replaces them, and including them would measure the optimiser.
            </li>
            <li>
              Measure the configured number of samples, each one a batch of operations timed as a unit and
              divided by the number of operations in it.
            </li>
            <li>
              Check correctness after the timed region, never inside it, by running the output back through
              the opposite direction and comparing bytes.
            </li>
            <li>Record the environment, the batch size, the measured timer resolution, and any warnings.</li>
          </ol>
          <p>
            The batch size is not a constant. A browser coarsens its clock as a side-channel mitigation, so
            a single block operation finishes inside one timer step and appears to take no time at all.
            Before measuring, the runner doubles the batch size until one batch spans at least{' '}
            {BENCH_LIMITS.minSampleDurationMs} ms, then divides each sample by that batch size. The chosen
            size is reported with the results, which is why a result can say that one sample covered, for
            instance, 64 operations.
          </p>
        </NumberedProse>

        <Well className="p-4">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt>
                <Label>Timer resolution on this machine</Label>
              </dt>
              <dd className="font-mono text-sm tabular-nums text-ink">
                {timerResolutionMs > 0 ? formatMilliseconds(timerResolutionMs) : 'could not be measured'}
              </dd>
            </div>
            <div>
              <dt>
                <Label>Cross-origin isolated</Label>
              </dt>
              <dd className="font-mono text-sm text-ink">
                {typeof globalThis.crossOriginIsolated === 'boolean' && globalThis.crossOriginIsolated
                  ? 'yes'
                  : 'no'}
              </dd>
            </div>
          </dl>
          <Hint className="mt-3">
            Measured live in this session, the same way every run measures it. A coarse clock is not a
            failure: it is the reason batching exists.
          </Hint>
        </Well>

        <Stack>
          <StackRow className="space-y-3">
            <Label>The two methodologies, kept apart on purpose</Label>
            <Prose>
              <p>
                <strong>{BENCH_METHODOLOGY_LABELS['steady-state']}.</strong> Measures repeated block
                processing. Key setup is timed separately and reported as its own figure. This is the right
                choice when a key is used for many messages.
              </p>
              <p>
                <strong>{BENCH_METHODOLOGY_LABELS['key-setup-included']}.</strong> Measures a whole cipher
                call, key schedule included. This is the right choice when a key is used once, or when the
                message is short enough that setup dominates.
              </p>
              <p>
                The two produce different numbers for the same configuration, so the Compare page refuses
                to rank results recorded under different methodologies and states which ones it excluded.
              </p>
            </Prose>
          </StackRow>
        </Stack>
      </section>

      <section className="space-y-4">
        <StackHead index="08.3" title="The statistical definitions" />
        <Prose>
          <p>
            Every statistic shown in this tool is defined here, so that it can be reproduced by hand from
            the sample list. The raw samples are available as a CSV export.
          </p>
        </Prose>
        <Definitions />
      </section>

      <section className="space-y-4">
        <StackHead index="08.4" title="What the environment record can identify" />
        <Prose>
          <p>
            Each run records the browser, the reported operating system, the number of logical cores, the
            language, whether the page was cross-origin isolated, and the full user agent string. It also
            records the payload digest, pattern and seed, the iteration counts and the batch size, so that
            a run can be reproduced exactly.
          </p>
          <p>
            What it cannot identify is the processor. No browser exposes the CPU model, and several freeze
            parts of the user agent: on macOS, browsers have reported a fixed version string for years.
            Treat the environment record as identifying a runtime approximately, not as identifying
            hardware.
          </p>
        </Prose>
      </section>

      <section className="space-y-4">
        <StackHead index="08.5" title="What the correctness evidence covers" />
        <Prose>
          <p>
            Correctness is established by tests, not by a successful demonstration. The engine's test suite
            runs the full set of reference vectors from RFC 2040 §9.2 and §9.3 — {RFC2040_VECTORS.length}{' '}
            vectors covering round counts from 0 to 16 and key lengths from 1 to 16 bytes — plus:
          </p>
          <ul>
            <li>
              Agreement between two independent arithmetic implementations: the 32-bit integer path used
              for speed, and a width-generic arbitrary-precision path. Any divergence fails the build.
            </li>
            <li>
              Round trips across all three word sizes, six round counts and five key lengths, for payload
              lengths from zero bytes to a kilobyte.
            </li>
            <li>Rotation at its boundaries: amounts of zero, one, w−1, w and beyond, in both directions.</li>
            <li>
              Padding behaviour: the always-adds-something rule, alignment, and each way malformed padding
              can be rejected.
            </li>
            <li>
              Validation: unsupported parameters, key length mismatches, malformed hex with the offending
              character reported, invalid UTF-8, oversized input, and empty ciphertext.
            </li>
          </ul>
          <p>
            The 64-bit configuration has no published reference vectors, because RFC 2040's test set covers
            only 32-bit words. Its correctness rests on the same agreement and round-trip tests, on a shared
            implementation structure that the 32-bit vectors exercise, and on the fact that it is never used
            for a timing comparison. That is a weaker claim than the 32-bit path can make, and it is stated
            here rather than glossed over.
          </p>
        </Prose>
      </section>

      <section className="space-y-4">
        <StackHead index="08.6" title="Limits, stated plainly" />
        <Prose>
          <ul>
            <li>
              Browser timings describe a browser. They do not predict a microcontroller, a server or a
              different browser, and no measurement here models thermal behaviour or power consumption.
            </li>
            <li>
              Nothing in this tool is measured at the hardware level. There is no CPU counter, no power
              meter and no memory profiler: figures that would require them are reported as not measured,
              never estimated and presented as data.
            </li>
            <li>
              The first run on a machine after a cold start differs from later runs. Warm-up iterations
              reduce this but do not eliminate it.
            </li>
            <li>
              Long runs are more exposed to thermal throttling and to other work on the machine. A run that
              processed several gigabytes will say so.
            </li>
            <li>
              Defaults are not recommendations. The preset profiles exist to be compared, and the round
              counts they use are starting points for an experiment.
            </li>
          </ul>
        </Prose>
      </section>

      <section className="space-y-4">
        <StackHead index="08.7" title="Supported ranges and workload limits" />
        <Stack>
          <StackRow className="p-0 sm:p-0">
            <DataTable
              caption="What this implementation supports and what it refuses"
              rows={[
                {
                  key: 'words',
                  limit: 'Word sizes',
                  value: '16, 32 and 64 bits',
                  note: 'Any other word size is rejected before any work is done.',
                },
                {
                  key: 'rounds',
                  limit: 'Rounds',
                  value: `0 to ${MAX_ROUNDS}`,
                  note: 'Zero is accepted by the engine, which the RFC uses in its vectors, but is not offered in the interface.',
                },
                {
                  key: 'keys',
                  limit: 'Key length',
                  value: `1 to ${MAX_KEY_BYTES} bytes`,
                  note: 'The key must match the configured length exactly. Zero-extension is an explicit action, never automatic.',
                },
                {
                  key: 'padding',
                  limit: 'Padding',
                  value: 'PKCS#7 or raw blocks',
                  note: 'Raw mode rejects a partial block instead of padding it silently.',
                },
                {
                  key: 'interactive',
                  limit: 'Simulator input',
                  value: '256 KiB',
                  note: 'Larger inputs belong in the Benchmark Lab, which runs in a worker.',
                },
                {
                  key: 'bench',
                  limit: 'Benchmark payload',
                  value: '1 MiB',
                  note: `Above this the run is refused rather than allowed to become unresponsive. Presets run from ${PAYLOAD_PRESETS[0]} B to ${PAYLOAD_PRESETS[PAYLOAD_PRESETS.length - 1] / 1024} KiB.`,
                },
                {
                  key: 'iterations',
                  limit: 'Measured iterations',
                  value: '5 to 10,000 in the interface',
                  note: `The engine accepts up to ${BENCH_LIMITS.maxMeasuredIterations.toLocaleString('en-US')}.`,
                },
                {
                  key: 'storage',
                  limit: 'Saved runs',
                  value: '80',
                  note: 'The oldest run is dropped when the limit is reached, so a save never fails silently at the storage quota.',
                },
              ]}
              getRowKey={(row) => row.key}
              columns={[
                { key: 'limit', header: 'Limit', render: (row) => <span className="text-ink-2">{row.limit}</span> },
                { key: 'value', header: 'Value', render: (row) => <span className="font-mono text-ink">{row.value}</span> },
                { key: 'note', header: 'Note', render: (row) => <span className="text-ink-3">{row.note}</span> },
              ]}
            />
          </StackRow>
          <StackRow className="space-y-3">
            <Label>Benchmark payload patterns</Label>
            <ul className="space-y-2">
              {Object.entries(PAYLOAD_PATTERN_NOTES).map(([pattern, note]) => (
                <li key={pattern} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <Badge>{pattern}</Badge>
                  <span className="max-w-[76ch] text-ink-2">{note}</span>
                </li>
              ))}
            </ul>
          </StackRow>
        </Stack>
      </section>

      <section className="space-y-4">
        <StackHead index="08.8" title="Your data" note="this browser, no account, no server" />
        <Stack>
          <StackRow className="space-y-4">
            <Prose>
              <p>
                There is no backend and no database. The RC5 cipher and the benchmark runner are the same
                TypeScript code running in your browser, which is also why nothing needs a server to be
                trustworthy: plaintext and keys never leave the tab.
              </p>
              <p>
                Experiment records are held in this browser's local storage. They contain parameters,
                workload details, statistics and the environment — never plaintext, never a secret key, and
                never a derived round key. Clearing site data for this origin deletes them permanently, so
                export anything you need to keep.
              </p>
            </Prose>
            <MetaRows
              rows={[
                ['Runs stored', String(runs.length)],
                [
                  'Storage used',
                  `${Math.round(storage.usedBytes / 1024)} KiB of roughly ${Math.round(storage.quotaHintBytes / 1024)} KiB available`,
                ],
                [
                  'Storage available',
                  storage.available ? 'yes' : 'no — records cannot be saved in this session',
                ],
                ['Simulator inputs', 'never stored, cleared when the tab closes'],
              ]}
            />
          </StackRow>

          <StackRow className="space-y-5">
            <MotionControl className="max-w-md" />
            <Rule />
            <div className="space-y-3">
              <Label>Reset everything</Label>
              <Hint>
                Removes every key this application owns from local storage, including saved runs and
                preferences. Other sites on this origin are untouched. There is no undo and no server copy.
              </Hint>
              <Button variant="danger" glyph="trash" onClick={() => setConfirmReset(true)}>
                Delete all local data
              </Button>
            </div>
          </StackRow>
        </Stack>
      </section>

      <section className="space-y-4">
        <StackHead index="08.9" title="Versions" />
        <MetaRows
          rows={[
            ['Application', APP_VERSION],
            ['Engine', ENGINE_VERSION],
            ['Methodology', METHODOLOGY_VERSION],
            ['Record schema', String(SCHEMA_VERSION)],
            ['Specification', 'RFC 2040 §5, §6, §9'],
          ]}
        />
        <Hint>
          Versions are recorded with every saved run. An export made under a different methodology version
          says so on import, because results from two methodologies are not directly comparable.
        </Hint>
      </section>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetEverything}
        title="Delete all local data?"
        confirmLabel="Delete everything"
        tone="danger"
      >
        <p>
          {runs.length} saved run{runs.length === 1 ? '' : 's'}, every stored preference, and the motion
          setting will be removed from this browser. There is no undo and no server copy to restore from.
        </p>
      </ConfirmDialog>
    </div>
  )
}

/** Prose with numbered steps, measured to a readable line length. */
function NumberedProse({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[76ch] space-y-4 text-read text-ink-2 [&_li]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:pl-5">
      {children}
    </div>
  )
}

function Definitions() {
  return (
    <Stack>
      <StackRow className="p-0 sm:p-0">
        <DataTable
          caption="Exact definitions of every statistic shown in this application"
          rows={[
            {
              key: 'n',
              term: 'n',
              definition:
                'The number of samples. Each sample is one timed batch divided by the number of operations in that batch, so n counts batches, not individual encryptions.',
            },
            { key: 'mean', term: 'Mean', definition: 'The arithmetic mean of the samples, in nanoseconds.' },
            {
              key: 'median',
              term: 'Median',
              definition:
                'The middle sample in ascending order; for an even count, the mean of the two middle samples. Reported alongside the mean because a single slow outlier moves the mean and not the median.',
            },
            {
              key: 'stddev',
              term: 'Standard deviation',
              definition: 'The sample standard deviation, using an n − 1 denominator.',
            },
            {
              key: 'cv',
              term: 'CV',
              definition:
                'Standard deviation divided by the mean, as a percentage. The Compare page uses it to decide whether a difference between two configurations is larger than the variation either showed on its own.',
            },
            {
              key: 'p95',
              term: 'p95',
              definition:
                'Nearest rank: the sample at position ⌈0.95 · n⌉ in ascending order. With fewer than 30 samples this is still reported, but flagged as unreliable, because it is then a small handful of samples wearing a percentile.',
            },
            {
              key: 'q',
              term: 'Q1 and Q3',
              definition:
                'The nearest-rank 25th and 75th percentiles. With the median they form the block in the distribution chart.',
            },
            {
              key: 'throughput',
              term: 'Throughput',
              definition:
                'Bytes processed divided by elapsed time, reported in bytes per second. The byte count is the number of whole blocks the payload occupies, and it is the same for every configuration at a given payload size.',
            },
            {
              key: 'setup',
              term: 'Key schedule time',
              definition:
                'Measured separately in steady-state mode, as the mean of repeated key expansions. In cipher-call mode it is inside the timed region and therefore not reported separately.',
            },
          ]}
          getRowKey={(row) => row.key}
          columns={[
            {
              key: 'term',
              header: 'Statistic',
              render: (row) => <span className="font-mono text-ink">{row.term}</span>,
            },
            {
              key: 'definition',
              header: 'Definition',
              render: (row) => <span className="max-w-[86ch] text-ink-2">{row.definition}</span>,
            },
          ]}
        />
      </StackRow>
    </Stack>
  )
}

function MetaRows({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="grid max-w-md gap-x-6 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt>
            <Label>{term}</Label>
          </dt>
          <dd className="font-mono text-sm text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
