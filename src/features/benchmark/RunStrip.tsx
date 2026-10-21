import { useEffect, useState } from 'react'

import { formatConfigLabel, formatCount, formatMilliseconds, formatPercent } from '@/lib/format'
import { formatByteCount } from '@/lib/format'
import { BENCH_LIMITS } from '@/lib/benchmark/protocol'
import { Button } from '@/components/ui/Button'
import { Readout, ReadoutCell, ReadoutGrid } from '@/components/ui/Data'
import { InlineError, LiveRegion, Notice, ProgressBar } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/Overlay'
import { Stack, StackHead, StackRow } from '@/components/ui/Surface'
import { Hint, Label, Meta } from '@/components/ui/Text'
import {
  cancelBenchmarkRun,
  probeBenchmarkSpec,
  startBenchmarkRun,
  useBenchmarkStore,
} from '@/state/benchmark.store'
import type { BenchForm } from './useBenchForm'

/**
 * Run control.
 *
 * The estimate comes from a pilot measurement in the worker rather than a guess, and it is labelled as
 * an estimate. A long run asks for confirmation before it starts, because a benchmark that quietly
 * takes ten minutes is a benchmark nobody trusts.
 *
 * While a run is in progress the page streams the sample count and the running coefficient of
 * variation. Watching that number settle — or fail to settle — is the whole point of doing this in the
 * interface rather than printing a result at the end.
 */

export function RunStrip({ form }: { form: BenchForm }) {
  const status = useBenchmarkStore((state) => state.status)
  const probing = useBenchmarkStore((state) => state.probing)
  const probe = useBenchmarkStore((state) => state.probe)
  const probeError = useBenchmarkStore((state) => state.probeError)
  const error = useBenchmarkStore((state) => state.error)
  const progress = useBenchmarkStore((state) => state.progress)
  const liveSampleCount = useBenchmarkStore((state) => state.liveSamples.length)
  const liveCvPercent = useBenchmarkStore((state) => state.liveCvPercent)
  const opsPerBatch = useBenchmarkStore((state) => state.opsPerBatch)
  const elapsedMs = useBenchmarkStore((state) => state.elapsedMs)
  const estimateMs = useBenchmarkStore((state) => state.estimateMs)
  const result = useBenchmarkStore((state) => state.result)
  const summary = result?.groups[0]

  const [confirmLargeRun, setConfirmLargeRun] = useState(false)

  const running = status === 'running' || status === 'cancelling'
  const blocked = form.validationError !== null

  // Re-probe whenever the workload changes, and never while a run is in progress.
  useEffect(() => {
    if (running) return
    const timer = window.setTimeout(() => probeBenchmarkSpec(form.spec), 450)
    return () => window.clearTimeout(timer)
  }, [form.specKey, form.spec, running])

  const estimate = probing ? null : probe?.estimatedTotalMs ?? null
  const isLarge = estimate !== null && estimate > BENCH_LIMITS.confirmAboveMs

  const defaultName = buildRunName(form)

  const begin = () => {
    startBenchmarkRun(form.spec, defaultName)
  }

  const handleStart = () => {
    if (isLarge) {
      setConfirmLargeRun(true)
      return
    }
    begin()
  }

  const phaseWord = progress ? phaseLabel(progress.phase) : null

  return (
    <>
      <Stack>
        <StackHead
          index="04.3"
          title="Run"
          note={running ? phaseWord ?? 'in progress' : 'measure, then read'}
          actions={
            running ? (
              <Button variant="danger" glyph="stop" onClick={cancelBenchmarkRun} disabled={status === 'cancelling'}>
                {status === 'cancelling' ? 'Cancelling' : 'Cancel run'}
              </Button>
            ) : (
              <Button variant="primary" glyph="play" onClick={handleStart} disabled={blocked}>
                Start run
              </Button>
            )
          }
        />

        <StackRow className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Estimated duration</Label>
              <p className="font-mono text-xl tabular-nums text-ink">
                {running && estimateMs !== null
                  ? formatMilliseconds(estimateMs)
                  : probing
                    ? 'Measuring…'
                    : estimate !== null
                      ? formatMilliseconds(estimate)
                      : '—'}
              </p>
              <Hint>
                {probing
                  ? 'Running a short pilot to work out how long the full workload will take.'
                  : estimate !== null
                    ? `From a pilot on ${formatConfigLabel(form.spec.configs[0])}: ${formatCount(probe?.opsPerBatch ?? 0)} operations per sample, about ${probe ? formatMilliseconds(probe.nsPerOp / 1e6) : '—'} per operation. An estimate, not a measurement.`
                    : 'Waiting for the workload to settle before estimating.'}
              </Hint>
            </div>

            <div className="space-y-1.5">
              <Label>Workload</Label>
              <p className="font-mono text-sm text-ink">
                {form.spec.configs.length} × {form.spec.target} · {formatByteCount(form.spec.payloadBytes)}
              </p>
              <Hint>
                {form.spec.measuredIterations} measured samples after {form.spec.warmupIterations} warm-up
                iterations per group.
              </Hint>
            </div>
          </div>

          {running ? (
            <div className="space-y-3">
              <ProgressBar
                label="Benchmark progress"
                value={progress?.done ?? 0}
                max={progress?.total ?? form.spec.measuredIterations}
              />
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <Meta>
                  {phaseWord} · sample {formatCount(progress?.done ?? 0)} of{' '}
                  {formatCount(progress?.total ?? form.spec.measuredIterations)}
                </Meta>
                <Meta>elapsed {formatMilliseconds(elapsedMs)}</Meta>
              </div>
            </div>
          ) : null}
        </StackRow>

        {running || status === 'done' ? (
          <StackRow>
            <ReadoutGrid>
              <ReadoutCell>
                <Readout
                  label="Samples taken"
                  value={formatCount(running ? liveSampleCount : summary?.rawSampleCount ?? null)}
                  note={running ? 'streaming as they are measured' : 'the samples the statistics came from'}
                />
              </ReadoutCell>
              <ReadoutCell>
                <Readout
                  label={running ? 'Running variation' : 'Spread'}
                  value={
                    running
                      ? formatPercent(liveCvPercent)
                      : summary
                        ? formatPercent(summary.metrics.cvPercent)
                        : '—'
                  }
                  note={running ? 'spread of the samples so far' : 'standard deviation over the mean'}
                  tone={
                    (running ? liveCvPercent : summary?.metrics.cvPercent ?? 0) > 25
                      ? 'signal'
                      : 'default'
                  }
                />
              </ReadoutCell>
              <ReadoutCell>
                <Readout
                  label="Operations per sample"
                  value={formatCount(running ? opsPerBatch : summary?.opsPerBatch ?? null)}
                  note="batch size chosen for the timer"
                />
              </ReadoutCell>
              <ReadoutCell>
                <Readout
                  label="Elapsed"
                  value={formatMilliseconds(running ? elapsedMs : result?.durationMs ?? null)}
                  note="wall clock"
                />
              </ReadoutCell>
            </ReadoutGrid>
          </StackRow>
        ) : null}

        {error ? (
          <StackRow>
            <InlineError>{error}</InlineError>
          </StackRow>
        ) : null}

        {probeError && !running ? (
          <StackRow>
            <Notice tone="caution" title="The duration estimate failed">
              {probeError} You can still start the run; the estimate is a convenience, not a requirement.
            </Notice>
          </StackRow>
        ) : null}

        {blocked ? null : (
          <StackRow>
            <Hint>
              The run happens in a worker thread, so the interface stays usable and the run can be
              cancelled between samples. Every sample is a batch of operations timed as a unit and
              divided by the batch size, because a browser clock cannot resolve a single operation this
              short.
            </Hint>
          </StackRow>
        )}
      </Stack>

      <LiveRegion>
        {running
          ? `Benchmark running. ${phaseWord}. ${liveSampleCount} samples taken.`
          : status === 'done'
            ? 'Benchmark complete.'
            : ''}
      </LiveRegion>

      <ConfirmDialog
        open={confirmLargeRun}
        onClose={() => setConfirmLargeRun(false)}
        onConfirm={begin}
        title="This run will take a while"
        confirmLabel="Start the run anyway"
      >
        <p>
          The pilot suggests about {estimate !== null ? formatMilliseconds(estimate) : 'a long time'} for{' '}
          {formatCount(
            (form.spec.warmupIterations + form.spec.measuredIterations) *
              form.spec.configs.length *
              (form.spec.target === 'both' ? 2 : 1),
          )}{' '}
          operations. The page stays usable and the run can be cancelled, but the machine will be busy.
        </p>
      </ConfirmDialog>
    </>
  )
}

function phaseLabel(phase: 'prepare' | 'warmup' | 'measure' | 'verify'): string {
  switch (phase) {
    case 'prepare':
      return 'Preparing'
    case 'warmup':
      return 'Warming up'
    case 'measure':
      return 'Measuring'
    case 'verify':
      return 'Verifying'
  }
}

export function buildRunName(form: BenchForm): string {
  const first = form.spec.configs[0]
  const configLabel =
    form.spec.configs.length > 1
      ? `${formatConfigLabel(first)} ×${form.spec.configs.length} rounds`
      : formatConfigLabel(first)
  return `${configLabel} · ${formatByteCount(form.spec.payloadBytes)} · ${form.spec.measuredIterations} samples`
}
