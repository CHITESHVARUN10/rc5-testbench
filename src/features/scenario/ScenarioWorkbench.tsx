import { useMemo, useState } from 'react'

import {
  SCENARIO_PRESETS,
  estimateScenario,
  type ScenarioInput,
  type ScenarioMode,
} from '@/lib/scenario/estimate'
import { formatByteCount, formatConfigLabel, formatMilliseconds, formatBitsPerSecond } from '@/lib/format'
import { latencyParts } from '@/lib/format'
import { BudgetBar, type BudgetSegment } from '@/components/charts/BudgetBar'
import { Button } from '@/components/ui/Button'
import { DataTable, StatusFlag } from '@/components/ui/Data'
import { Field, Segmented, Select, TextInput } from '@/components/ui/Form'
import { Notice } from '@/components/ui/Feedback'
import { Stack, StackHead, StackRow } from '@/components/ui/Surface'
import { Hint, Label, Meta } from '@/components/ui/Text'
import type { SavedRun } from '@/lib/storage/experiments'

/**
 * Scenario workbench.
 *
 * The form collects assumptions, and the result prints every component with where it came from. The
 * measured figures cannot be typed in by hand — they come from a saved run or they do not appear — so
 * there is no way for a measured number and a guess to become indistinguishable in the output.
 */

const LINK_PRESETS: readonly { label: string; bitsPerSecond: number }[] = [
  { label: '9.6 kbit/s', bitsPerSecond: 9_600 },
  { label: '115 kbit/s', bitsPerSecond: 115_200 },
  { label: '1 Mbit/s', bitsPerSecond: 1_000_000 },
  { label: '10 Mbit/s', bitsPerSecond: 10_000_000 },
  { label: '100 Mbit/s', bitsPerSecond: 100_000_000 },
]

interface ConfigChoice {
  readonly key: string
  readonly run: SavedRun
  readonly label: string
  readonly encryptNs: number | null
  readonly decryptNs: number | null
  readonly measuredPayloadBytes: number
}

export function ScenarioWorkbench({ runs }: { runs: readonly SavedRun[] }) {
  const choices = useMemo<ConfigChoice[]>(() => {
    const out: ConfigChoice[] = []
    for (const run of runs) {
      for (const result of run.results) {
        const encrypt = run.results.find(
          (candidate) => candidate.target === 'encrypt' && sameConfig(candidate.config, result.config),
        )
        const decrypt = run.results.find(
          (candidate) => candidate.target === 'decrypt' && sameConfig(candidate.config, result.config),
        )
        const key = `${run.id}:${result.config.w}-${result.config.r}-${result.config.b}`
        if (out.some((choice) => choice.key === key)) continue
        out.push({
          key,
          run,
          label: `${formatConfigLabel(result.config)} · ${run.name}`,
          encryptNs: encrypt?.metrics.medianNs ?? null,
          decryptNs: decrypt?.metrics.medianNs ?? null,
          measuredPayloadBytes: run.payloadBytes,
        })
      }
    }
    return out
  }, [runs])

  const [choiceKey, setChoiceKey] = useState(choices[0]?.key ?? '')
  const choice = choices.find((candidate) => candidate.key === choiceKey) ?? choices[0] ?? null

  const [name, setName] = useState('Sensor telemetry')
  const [payloadBytes, setPayloadBytes] = useState(choice?.measuredPayloadBytes ?? 64)
  const [messageCount, setMessageCount] = useState(1)
  const [budgetMs, setBudgetMs] = useState(20_000)
  const [bandwidthBitsPerSecond, setBandwidthBitsPerSecond] = useState<number | ''>(100_000)
  const [networkOverheadMs, setNetworkOverheadMs] = useState<number | ''>(50)
  const [serializationOverheadMs, setSerializationOverheadMs] = useState<number | ''>(0.2)
  const [framingBytes, setFramingBytes] = useState(16)
  const [mode, setMode] = useState<ScenarioMode>('one-way')

  const payloadMatchesMeasurement = choice !== null && choice.measuredPayloadBytes === payloadBytes

  const input: ScenarioInput = {
    name,
    payloadBytes,
    messageCount,
    budgetMs,
    bandwidthBitsPerSecond: bandwidthBitsPerSecond === '' ? null : bandwidthBitsPerSecond,
    networkOverheadMs: networkOverheadMs === '' ? null : networkOverheadMs,
    serializationOverheadMs: serializationOverheadMs === '' ? null : serializationOverheadMs,
    framingBytes,
    mode,
    encryptNs: payloadMatchesMeasurement ? choice.encryptNs : null,
    decryptNs: payloadMatchesMeasurement ? choice.decryptNs : null,
    sourceLabel: choice ? choice.label : null,
  }

  const result = estimateScenario(input)

  const segments: BudgetSegment[] = result.components
    .filter((component) => component.applies && component.valueMs > 0)
    .map((component) => ({
      id: component.id,
      label: component.label,
      valueNs: component.valueMs * 1e6,
      provenance: component.provenance,
    }))

  const applyPreset = (presetId: string) => {
    const preset = SCENARIO_PRESETS.find((candidate) => candidate.id === presetId)
    if (!preset) return
    setName(preset.label)
    setPayloadBytes(preset.values.payloadBytes)
    setMessageCount(preset.values.messageCount)
    setBudgetMs(preset.values.budgetMs)
    setBandwidthBitsPerSecond(preset.values.bandwidthBitsPerSecond ?? '')
    setNetworkOverheadMs(preset.values.networkOverheadMs ?? '')
    setSerializationOverheadMs(preset.values.serializationOverheadMs ?? '')
    setFramingBytes(preset.values.framingBytes)
    setMode(preset.values.mode)
  }

  if (choices.length === 0) {
    return (
      <Stack>
        <StackHead index="06.1" title="Assumptions" />
        <StackRow>
          <Hint>
            A scenario needs at least one saved measurement to place inside the budget. Run something in
            the Benchmark Lab first.
          </Hint>
        </StackRow>
      </Stack>
    )
  }

  return (
    <>
      <Stack>
        <StackHead index="06.1" title="Assumptions" note="everything you supply is labelled as yours" />
        <StackRow className="space-y-5">
          <div className="space-y-2">
            <Label>Starting points</Label>
            <div className="flex flex-wrap gap-1.5">
              {SCENARIO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="min-h-9 rounded-hair border border-rule-2 px-2 py-1.5 font-mono text-label text-ink-2 transition-colors duration-150 ease-instrument hover:border-rule-3 hover:bg-well"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <Hint>
              Presets fill the form with assumptions, not measurements. Every value they set remains
              yours to change.
            </Hint>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Scenario name">
              <TextInput value={name} onChange={(event) => setName(event.target.value)} />
            </Field>

            <Field
              label="Measured configuration"
              hint={
                choice
                  ? `Measured at ${formatByteCount(choice.measuredPayloadBytes)} in "${choice.run.name}".`
                  : 'No saved run selected.'
              }
            >
              <Select value={choice?.key ?? ''} onChange={(event) => setChoiceKey(event.target.value)}>
                {choices.map((candidate) => (
                  <option key={candidate.key} value={candidate.key}>
                    {candidate.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Payload size"
              hint={`The cipher figures only apply when this matches the measured payload size (${choice ? formatByteCount(choice.measuredPayloadBytes) : '—'}).`}
            >
              <TextInput
                mono
                type="number"
                min={1}
                value={payloadBytes}
                onChange={(event) => setPayloadBytes(Number(event.target.value))}
              />
            </Field>

            <Field label="Messages" hint="Used for the aggregate figure. The deadline is per message.">
              <TextInput
                mono
                type="number"
                min={1}
                value={messageCount}
                onChange={(event) => setMessageCount(Number(event.target.value))}
              />
            </Field>

            <Field label="Deadline per message" hint="In milliseconds. A 20-second deadline is 20000.">
              <TextInput
                mono
                type="number"
                min={0}
                value={budgetMs}
                onChange={(event) => setBudgetMs(Number(event.target.value))}
              />
            </Field>

            <Field label="Framing bytes" hint="Protocol overhead added to each transmission. Your estimate.">
              <TextInput
                mono
                type="number"
                min={0}
                value={framingBytes}
                onChange={(event) => setFramingBytes(Number(event.target.value))}
              />
            </Field>

            <Field
              label="Link rate"
              hint="Leave empty to exclude transmission from the estimate."
            >
              <span className="space-y-2">
                <TextInput
                  mono
                  type="number"
                  min={1}
                  placeholder="bits per second"
                  value={bandwidthBitsPerSecond}
                  onChange={(event) =>
                    setBandwidthBitsPerSecond(event.target.value === '' ? '' : Number(event.target.value))
                  }
                />
                <span className="flex flex-wrap gap-1.5">
                  {LINK_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setBandwidthBitsPerSecond(preset.bitsPerSecond)}
                      className="min-h-9 rounded-hair border border-rule-2 px-2 py-1 font-mono text-label text-ink-3 hover:border-rule-3 hover:text-ink"
                    >
                      {preset.label}
                    </button>
                  ))}
                </span>
              </span>
            </Field>

            <Field label="Network delay" hint="One-way delay in milliseconds. Your estimate.">
              <TextInput
                mono
                type="number"
                min={0}
                placeholder="one-way, ms"
                value={networkOverheadMs}
                onChange={(event) =>
                  setNetworkOverheadMs(event.target.value === '' ? '' : Number(event.target.value))
                }
              />
            </Field>

            <Field label="Serialization overhead" hint="Per message, in milliseconds. Your estimate.">
              <TextInput
                mono
                type="number"
                min={0}
                placeholder="ms"
                value={serializationOverheadMs}
                onChange={(event) =>
                  setSerializationOverheadMs(event.target.value === '' ? '' : Number(event.target.value))
                }
              />
            </Field>
          </div>

          <Segmented
            legend="Traffic shape"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'one-way', label: 'One way' },
              { value: 'request-response', label: 'Request and reply' },
            ]}
            hint={
              mode === 'one-way'
                ? 'The message travels once: encrypt at the sender, transmit, decrypt at the receiver.'
                : 'The path is modelled twice, assuming a reply of similar size handled the same way.'
            }
          />

          {!payloadMatchesMeasurement ? (
            <Notice tone="caution" title="No measurement at this payload size">
              <p>
                {choice ? `The selected run was measured at ${formatByteCount(choice.measuredPayloadBytes)}.` : ''}{' '}
                The estimate cannot use a cipher time for {formatByteCount(payloadBytes)} because none
                has been measured, and substituting one would make the result look more supported than
                it is.
              </p>
              <div className="pt-2">
                <Button
                  variant="secondary"
                  compact
                  onClick={() => setPayloadBytes(choice.measuredPayloadBytes)}
                >
                  Use the measured payload size ({formatByteCount(choice.measuredPayloadBytes)})
                </Button>
              </div>
            </Notice>
          ) : null}
        </StackRow>
      </Stack>

      <Stack>
        <StackHead
          index="06.2"
          title="Estimate"
          note={result.hasMeasuredEncryption ? 'measured cipher time, assumed link' : 'no measurement'}
          actions={
            <StatusFlag
              status={
                result.status === 'within-budget'
                  ? 'within-budget'
                  : result.status === 'over-budget'
                    ? 'over-budget'
                    : 'insufficient-data'
              }
            />
          }
        />

        {result.status === 'insufficient-data' ? (
          <StackRow className="space-y-4">
            <Notice tone="caution" title="There is not enough measured data to estimate this">
              <ul className="list-disc space-y-1 pl-4">
                {result.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Notice>
          </StackRow>
        ) : (
          <StackRow className="space-y-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Per message</Label>
                <p className="font-mono text-2xl tabular-nums text-ink">
                  {formatMilliseconds(result.perMessageMs)}
                </p>
                <Hint>Along the whole path, once.</Hint>
              </div>
              <div className="space-y-1.5">
                <Label>Deadline</Label>
                <p className="font-mono text-2xl tabular-nums text-ink-2">
                  {formatMilliseconds(result.budgetMs)}
                </p>
                <Hint>As entered, per message.</Hint>
              </div>
              <div className="space-y-1.5">
                <Label>{result.remainingMs >= 0 ? 'Remaining' : 'Over budget by'}</Label>
                <p
                  className={
                    result.remainingMs >= 0
                      ? 'font-mono text-2xl tabular-nums text-ok'
                      : 'font-mono text-2xl tabular-nums text-err'
                  }
                >
                  {formatMilliseconds(Math.abs(result.remainingMs))}
                </p>
                <Hint>
                  {result.messagesPerBudget > 0
                    ? `${result.messagesPerBudget} message${result.messagesPerBudget === 1 ? '' : 's'} of this size would fit in one deadline.`
                    : 'Less than one message fits in the deadline.'}
                </Hint>
              </div>
              <div className="space-y-1.5">
                <Label>All messages</Label>
                <p className="font-mono text-2xl tabular-nums text-ink-2">
                  {formatMilliseconds(result.totalMs)}
                </p>
                <Hint>
                  {result.messageCount} message{result.messageCount === 1 ? '' : 's'} end to end. Not what
                  the deadline is compared against.
                </Hint>
              </div>
            </div>

            <BudgetBar
              ariaLabel={`Estimated per-message time of ${formatMilliseconds(result.perMessageMs)} against a deadline of ${formatMilliseconds(result.budgetMs)}`}
              segments={segments}
              budgetNs={result.budgetMs * 1e6}
            />

            <div className="rounded-hair border border-rule bg-sheet">
              <DataTable
                caption="Estimated per-message time by component, with the origin of each value"
                rows={result.components.map((component, index) => ({ id: component.id, component, index }))}
                getRowKey={(row) => row.id}
                columns={[
                  {
                    key: 'component',
                    header: 'Component',
                    render: (row) => <span className="text-ink">{row.component.label}</span>,
                  },
                  {
                    key: 'value',
                    header: 'Time',
                    align: 'right',
                    render: (row) =>
                      row.component.applies ? (
                        <span className="text-ink">{formatMilliseconds(row.component.valueMs)}</span>
                      ) : (
                        <span className="text-ink-4">not included</span>
                      ),
                  },
                  {
                    key: 'source',
                    header: 'Origin',
                    render: (row) => <StatusFlag status={row.component.provenance} />,
                  },
                  {
                    key: 'note',
                    header: 'Note',
                    render: (row) => <span className="text-ink-3">{row.component.note}</span>,
                  },
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Meta>
                link rate {input.bandwidthBitsPerSecond ? formatBitsPerSecond(input.bandwidthBitsPerSecond) : 'not modelled'}
              </Meta>
              {choice ? <Meta>cipher figures from {choice.label}</Meta> : null}
              {choice?.encryptNs !== null && choice?.encryptNs !== undefined ? (
                <Meta>
                  measured encrypt {latencyParts(choice.encryptNs).value} {latencyParts(choice.encryptNs).unit}
                </Meta>
              ) : null}
            </div>
          </StackRow>
        )}
      </Stack>

      <Stack>
        <StackHead index="06.3" title="What this estimate cannot tell you" />
        <StackRow>
          <ul className="space-y-2.5">
            {result.notes.map((note) => (
              <li key={note} className="flex gap-3 text-sm text-ink-2">
                <span aria-hidden="true" className="pt-1.5 text-ink-4">
                  —
                </span>
                <span className="max-w-[76ch]">{note}</span>
              </li>
            ))}
          </ul>
        </StackRow>
      </Stack>
    </>
  )
}

function sameConfig(a: { w: number; r: number; b: number }, b: { w: number; r: number; b: number }): boolean {
  return a.w === b.w && a.r === b.r && a.b === b.b
}
