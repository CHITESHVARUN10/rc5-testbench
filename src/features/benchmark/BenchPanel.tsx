import {
  MAX_BENCH_PAYLOAD_BYTES,
  PAYLOAD_PRESETS,
  ROUND_SWEEP_VALUES,
  blockSizeBytes,
} from '@/lib/rc5/constants'
import { PAYLOAD_PATTERNS, PAYLOAD_PATTERN_LABELS, PAYLOAD_PATTERN_NOTES } from '@/lib/benchmark/prepare'
import { BENCH_LIMITS } from '@/lib/benchmark/protocol'
import { cn } from '@/lib/cn'
import { Field, RangeField, Segmented, Select, TextInput } from '@/components/ui/Form'
import { InlineError } from '@/components/ui/Feedback'
import { Stack, StackHead, StackRow } from '@/components/ui/Surface'
import { Hint, Label, Meta } from '@/components/ui/Text'
import type { BenchForm } from './useBenchForm'

/**
 * The workload and method panels.
 *
 * Everything that changes the meaning of a result is chosen here and stated rather than defaulted
 * invisibly: how many configurations, how much data, which direction, whether the key schedule is
 * inside the timed region, and how many samples are taken before and after warm-up.
 *
 * Warm-up iterations exist because the first executions of any function in a JavaScript engine run
 * interpreted, then get optimised. Including them would measure the optimiser warming up.
 */

function Chip({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-h-9 rounded-hair border px-2 py-1.5 font-mono text-label tabular-nums',
        'transition-colors duration-150 ease-instrument disabled:opacity-45',
        selected
          ? 'border-ink bg-ink text-paper'
          : 'border-rule-2 text-ink-2 hover:border-rule-3 hover:bg-well',
      )}
    >
      {children}
    </button>
  )
}

export function WorkloadPanel({ form }: { form: BenchForm }) {
  const state = form.form
  const blockSize = blockSizeBytes(
    state.mode === 'sweep' ? 32 : form.spec.configs[0].w,
  )

  return (
    <Stack>
      <StackHead index="04.1" title="Workload" note="what gets measured" />
      <StackRow className="space-y-5">
        <Segmented
          legend="Configurations"
          value={state.mode}
          onChange={form.setMode}
          options={[
            { value: 'single', label: 'One' },
            { value: 'sweep', label: 'Rounds sweep' },
          ]}
          hint={
            state.mode === 'sweep'
              ? 'The same word size and key length at several round counts, which is what the latency-versus-rounds chart needs.'
              : 'The configuration selected in the strip above. Change it on the Simulator page.'
          }
        />

        {state.mode === 'sweep' ? (
          <div className="space-y-2">
            <Label>Round counts</Label>
            <div className="flex flex-wrap gap-1.5">
              {ROUND_SWEEP_VALUES.map((rounds) => (
                <Chip
                  key={rounds}
                  selected={state.sweepRounds.includes(rounds)}
                  onClick={() => form.toggleSweepRound(rounds)}
                >
                  {rounds}
                </Chip>
              ))}
            </div>
            <Hint>
              {state.sweepRounds.length} configuration{state.sweepRounds.length === 1 ? '' : 's'} selected.
              Round counts between these values are not measured, so the chart will show only the points
              you pick here.
            </Hint>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Label>Payload size</Label>
            <Meta>
              {state.payloadBytes.toLocaleString('en-US')} B ·{' '}
              {Math.max(1, Math.ceil(state.payloadBytes / blockSize))} blocks
            </Meta>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PAYLOAD_PRESETS.map((bytes) => (
              <Chip key={bytes} selected={state.payloadBytes === bytes} onClick={() => form.setPayloadBytes(bytes)}>
                {bytes < 1024 ? `${bytes} B` : `${bytes / 1024} KiB`}
              </Chip>
            ))}
          </div>
          <Field
            label="Custom payload size"
            hint={`1 byte to ${MAX_BENCH_PAYLOAD_BYTES.toLocaleString('en-US')} bytes (1 MiB). These are test sizes, not claims about the size of a real message.`}
          >
            <TextInput
              mono
              type="number"
              min={1}
              max={MAX_BENCH_PAYLOAD_BYTES}
              value={state.payloadBytes}
              onChange={(event) => form.setPayloadBytes(Number(event.target.value))}
            />
          </Field>
        </div>

        <Field
          label="Payload pattern"
          hint={PAYLOAD_PATTERN_NOTES[state.pattern]}
        >
          <Select
            value={state.pattern}
            onChange={(event) => form.setPattern(event.target.value as typeof state.pattern)}
          >
            {PAYLOAD_PATTERNS.map((pattern) => (
              <option key={pattern} value={pattern}>
                {PAYLOAD_PATTERN_LABELS[pattern]}
              </option>
            ))}
          </Select>
        </Field>
      </StackRow>
      {form.validationError ? (
        <StackRow>
          <InlineError>{form.validationError}</InlineError>
        </StackRow>
      ) : null}
    </Stack>
  )
}

export function MethodPanel({ form }: { form: BenchForm }) {
  const state = form.form
  const groups = form.spec.configs.length * (state.target === 'both' ? 2 : 1)
  const totalOperations = (state.warmupIterations + state.measuredIterations) * groups

  return (
    <Stack>
      <StackHead index="04.2" title="Method" note="how it is measured" />
      <StackRow className="space-y-5">
        <Segmented
          legend="Direction"
          value={state.target}
          onChange={form.setTarget}
          options={[
            { value: 'encrypt', label: 'Encrypt' },
            { value: 'decrypt', label: 'Decrypt' },
            { value: 'both', label: 'Both' },
          ]}
          hint="Encryption and decryption are timed separately, never averaged together."
        />

        <Segmented
          legend="Methodology"
          value={state.methodology}
          onChange={form.setMethodology}
          options={[
            { value: 'steady-state', label: 'Steady state' },
            { value: 'key-setup-included', label: 'Cipher call' },
          ]}
          hint={
            state.methodology === 'steady-state'
              ? 'The key schedule is prepared outside the timed region, so this measures repeated block processing. Key setup is timed separately and reported on its own.'
              : 'The key schedule is included in every timed operation, which is what a fresh message under a fresh key costs. Results here are not comparable with steady-state results.'
          }
        />

        <RangeField
          label="Warm-up iterations"
          value={state.warmupIterations}
          min={0}
          max={2000}
          step={10}
          stops={[0, 100, 200, 500, 1000]}
          onChange={form.setWarmup}
          hint="Run first and discarded from the results, so the engine's optimiser is not part of the measurement."
        />

        <RangeField
          label="Measured iterations"
          value={state.measuredIterations}
          min={5}
          max={10000}
          step={5}
          stops={[50, 100, 200, 500, 1000]}
          onChange={form.setMeasured}
          hint="The number of samples the statistics are computed from. Thirty is the minimum for a p95 to mean anything; more samples reduce the effect of other work on this machine."
        />

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-rule pt-3">
          <Meta>
            {groups} result group{groups === 1 ? '' : 's'}
          </Meta>
          <Meta>{totalOperations.toLocaleString('en-US')} operations in total</Meta>
          {BENCH_LIMITS.maxMeasuredIterations < totalOperations ? (
            <Meta className="text-warn">above the engine limit of {BENCH_LIMITS.maxMeasuredIterations.toLocaleString('en-US')}</Meta>
          ) : null}
        </div>
      </StackRow>
    </Stack>
  )
}
