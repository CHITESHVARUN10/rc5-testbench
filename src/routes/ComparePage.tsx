import { useState } from 'react'

import { formatByteCount, formatConfigLabel, formatLatency, formatPercent } from '@/lib/format'
import { summariseComparison } from '@/lib/comparison'
import { measurementsToCsv, type Measurement } from '@/lib/measurement'
import {
  KEY_SEARCH_GUESS_RATE,
  TIMING_CAVEAT,
  keySearchEstimate,
  scientific,
  securityNote,
} from '@/lib/security'
import { BarGroup } from '@/components/charts/BarGroup'
import { formatMicroTick } from '@/components/charts/Scale'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DownloadButton } from '@/components/ui/Code'
import { DataTable, StatusFlag } from '@/components/ui/Data'
import { EmptyState, Notice } from '@/components/ui/Feedback'
import { Glyph } from '@/components/ui/Glyph'
import { ConfirmDialog } from '@/components/ui/Overlay'
import { PageHeader } from '@/components/shell/PageHeader'
import { Stack, StackHead, StackRow } from '@/components/ui/Surface'
import { Label } from '@/components/ui/Text'
import { useMeasurements } from '@/state/measurements.store'

/**
 * Compare.
 *
 * One table, one chart, one reading of what each configuration is. The measurements are sorted by
 * encryption time because that is the question this page answers first: which of these is quicker,
 * and by how much. The notes below are not sorted — they say what each configuration *is*, which does
 * not change with the speed of the machine that measured it.
 */

interface ChartRow {
  readonly id: string
  readonly cells: readonly string[]
}

function byEncryptTime(a: Measurement, b: Measurement): number {
  return a.encryptNs - b.encryptNs
}

export function ComparePage() {
  const measurements = useMeasurements((state) => state.measurements)
  const remove = useMeasurements((state) => state.remove)
  const clear = useMeasurements((state) => state.clear)
  const [confirmClear, setConfirmClear] = useState(false)

  const rows = measurements.slice().sort(byEncryptTime)
  const summary = summariseComparison(rows)

  return (
    <div className="space-y-10 lg:space-y-12">
      <PageHeader
        index="04"
        category="Measurement"
        title="Compare configurations"
        lead="Encryption and decryption time for every configuration measured in this browser, with the message size held constant. These are measurements of work done, not estimates."
        actions={
          rows.length > 0 ? (
            <>
              <DownloadButton
                text={measurementsToCsv(rows)}
                filename="rc5-comparison.csv"
                label="Download CSV"
                compact
              />
              <Button variant="ghost" compact glyph="trash" onClick={() => setConfirmClear(true)}>
                Clear all
              </Button>
            </>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          label="Nothing measured yet"
          title="Measure a configuration to start a comparison"
          action={
            <ButtonLink to="/simulator" variant="primary" glyphAfter="arrow-right">
              Open the Simulator
            </ButtonLink>
          }
        >
          Encrypt a message there, then choose Measure this configuration. Each measurement is one row
          here, so two or three configurations are enough to see the difference rounds and key length
          make.
        </EmptyState>
      ) : (
        <>
          <Stack>
            <StackHead
              index="04.1"
              title="Measured configurations"
              note={`${rows.length} measured · quickest first`}
            />
            <StackRow>
              <DataTable
                className="-mx-3"
                caption="Encryption and decryption time per measured configuration"
                columns={[
                  {
                    key: 'rank',
                    header: '#',
                    align: 'right',
                    render: (row) => <span className="text-ink-4">{rows.indexOf(row) + 1}</span>,
                  },
                  {
                    key: 'config',
                    header: 'Configuration',
                    render: (row: Measurement) => formatConfigLabel(row.config),
                  },
                  {
                    key: 'message',
                    header: 'Message',
                    render: (row) => formatByteCount(row.payloadBytes),
                  },
                  {
                    key: 'encrypt',
                    header: 'Encrypt',
                    align: 'right',
                    render: (row) => formatLatency(row.encryptNs),
                  },
                  {
                    key: 'decrypt',
                    header: 'Decrypt',
                    align: 'right',
                    render: (row) => formatLatency(row.decryptNs),
                  },
                  {
                    key: 'setup',
                    header: 'Key setup',
                    align: 'right',
                    render: (row) =>
                      row.keySetupNs > 0 ? formatLatency(row.keySetupNs) : '—',
                  },
                  {
                    key: 'spread',
                    header: 'Spread',
                    align: 'right',
                    render: (row) => formatPercent(row.spreadPercent),
                  },
                  {
                    key: 'verified',
                    header: 'Round trip',
                    render: (row) => (
                      <StatusFlag status={row.correctness === 'verified' ? 'verified' : 'mismatch'} />
                    ),
                  },
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (row) => (
                      <Button
                        variant="ghost"
                        compact
                        aria-label={`Remove the measurement of ${formatConfigLabel(row.config)}`}
                        onClick={() => remove(row.id)}
                      >
                        Remove
                      </Button>
                    ),
                  },
                ]}
                rows={rows}
                getRowKey={(row) => row.id}
              />
            </StackRow>
            <StackRow className="space-y-5">
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <Glossary
                  term="Encrypt / Decrypt"
                  detail="The median time to encrypt or decrypt the whole message in this row. ns is a nanosecond (10⁻⁹ s), µs a microsecond (10⁻⁶ s). 171 ns is 0.171 µs."
                />
                <Glossary
                  term="Key setup"
                  detail="The time to expand your key into the round-key table, before any encryption. It happens once per key, so it is not inside the Encrypt and Decrypt figures."
                />
                <Glossary
                  term="Spread"
                  detail={`How much the ${rows[0].samples} samples varied around the median. A low number means the measurement repeated itself. It says nothing about the strength of the cipher.`}
                />
                <Glossary
                  term="Round trip"
                  detail="The ciphertext was decrypted and compared with the input, byte for byte. Verified means the plaintext came back identical."
                />
              </div>
            </StackRow>
          </Stack>

          <Stack>
            <StackHead
              index="04.2"
              title="Summary"
              note="three picks from the table above"
            />
            <StackRow className="space-y-5">
              <div className="grid gap-6 sm:grid-cols-3">
                <Pick
                  label="Fastest to encrypt"
                  pick={summary.fastest}
                  basis="Lowest median encryption time in this table — measured."
                />
                <Pick
                  label="Balanced"
                  pick={summary.balanced}
                  basis="Fastest configuration at or above the RFC 2040 settings: 12 rounds and a 16-byte key."
                />
                <Pick
                  label="Strongest settings"
                  pick={summary.strongest}
                  basis="Most rounds, then the longest key. Read from the parameters, not measured."
                />
              </div>

              {summary.notes.length > 0 ? (
                <ul className="space-y-1.5 border-t border-rule pt-4">
                  {summary.notes.map((note) => (
                    <li key={note} className="max-w-[76ch] text-sm text-ink-3">
                      {note}
                    </li>
                  ))}
                </ul>
              ) : null}

              <p className="max-w-[76ch] text-sm text-ink-2">
                Speed is measured; strength is not. More rounds and a longer key make the work harder on
                paper and slower in practice, and this tool can show you the cost of that trade. It
                cannot show you the benefit, because no stopwatch can.
              </p>
            </StackRow>
          </Stack>

          <Stack>
            <StackHead
              index="04.3"
              title="Encrypt against decrypt"
              note="median time per operation"
            />
            <StackRow>
              <BarGroup
                tableVisible
                ariaLabel="Median encryption and decryption time per configuration"
                summary="Each pair of bars is one configuration: encryption solid, decryption hatched. The same message size is used throughout, so the bars are directly comparable."
                yLabel="median per operation"
                formatY={formatMicroTick}
                categories={rows.map((row) => ({
                  key: row.id,
                  label: `${row.config.w}/${row.config.r}/${row.config.b}`,
                  note: formatByteCount(row.payloadBytes),
                }))}
                series={[
                  { id: 'encrypt', label: 'Encrypt', pattern: 'solid' },
                  { id: 'decrypt', label: 'Decrypt', pattern: 'hatch' },
                ]}
                values={{
                  encrypt: Object.fromEntries(rows.map((row) => [row.id, row.encryptNs])),
                  decrypt: Object.fromEntries(rows.map((row) => [row.id, row.decryptNs])),
                }}
                table={
                  <div className="rounded-hair border border-rule bg-sheet">
                    <DataTable<ChartRow>
                      caption="Encryption and decryption time per configuration"
                      columns={[
                        { key: 'config', header: 'Configuration', render: (row) => row.cells[0] },
                        {
                          key: 'encrypt',
                          header: 'Encrypt',
                          align: 'right',
                          render: (row) => row.cells[1],
                        },
                        {
                          key: 'decrypt',
                          header: 'Decrypt',
                          align: 'right',
                          render: (row) => row.cells[2],
                        },
                      ]}
                      rows={rows.map((row) => ({
                        id: row.id,
                        cells: [
                          formatConfigLabel(row.config),
                          formatLatency(row.encryptNs),
                          formatLatency(row.decryptNs),
                        ],
                      }))}
                      getRowKey={(row) => row.id}
                    />
                  </div>
                }
              />
            </StackRow>
          </Stack>

          <Stack>
            <StackHead
              index="04.4"
              title="What each configuration is"
              note="context from the specification, not a measurement"
            />
            <StackRow className="space-y-0">
              {rows.map((row, index) => {
                const note = securityNote(row.config)
                const search = keySearchEstimate(row.config.b)
                const caution = note.level === 'caution'
                return (
                  <div
                    key={row.id}
                    className={
                      index === 0
                        ? 'flex flex-col gap-1.5 pb-5 sm:flex-row sm:items-baseline sm:gap-6'
                        : 'flex flex-col gap-1.5 border-t border-rule pt-4 pb-5 sm:flex-row sm:items-baseline sm:gap-6'
                    }
                  >
                    <span className="font-mono text-sm text-ink sm:w-40 sm:shrink-0">
                      {formatConfigLabel(row.config)}
                    </span>
                    <span className="min-w-0 space-y-1.5">
                      <span
                        className={`flex items-center gap-1.5 font-mono text-label uppercase ${
                          caution ? 'text-warn' : 'text-ink-3'
                        }`}
                      >
                        <Glyph name={caution ? 'warn' : 'info'} size={12} />
                        {note.headline}
                      </span>
                      <span className="block max-w-[76ch] text-sm text-ink-2">
                        {row.config.r} rounds · {search.keyBits}-bit key · {search.keySpaceLabel}.
                        Exhaustive search at an assumed {scientific(KEY_SEARCH_GUESS_RATE)} guesses
                        per second averages{' '}
                        <span className="font-mono text-ink">{search.searchLabel}</span>
                        {search.universeLabel ? `, ${search.universeLabel}` : ''}.
                      </span>
                      {caution ? (
                        <span className="block max-w-[76ch] text-sm text-ink-3">{note.detail}</span>
                      ) : null}
                    </span>
                  </div>
                )
              })}

              <div className="space-y-4 border-t border-rule pt-5">
                <p className="max-w-[76ch] text-sm text-ink-2">
                  The key-search figure is arithmetic: the key space is 2<sup>bits</sup>, and the time
                  follows from the guess rate above. It is not a measurement, and it does not cover
                  attacks that avoid searching the key space. Rounds are the other axis: 12 is the
                  configuration RFC 2040 documents, and lower round counts are the reduced-round
                  variants that published cryptanalysis examines.
                </p>
                <Notice tone="caution" title="Speed is not strength">
                  {TIMING_CAVEAT}
                </Notice>
              </div>
            </StackRow>
          </Stack>
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clear}
        title="Clear every measurement?"
        confirmLabel="Clear all measurements"
        tone="danger"
      >
        <p>
          {rows.length} measurement{rows.length === 1 ? '' : 's'} will be removed from this browser. They
          cannot be recovered, but measuring the same configurations again reproduces them closely.
        </p>
      </ConfirmDialog>
    </div>
  )
}

/** One line of the table's reading key. */
function Glossary({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="space-y-1">
      <Label>{term}</Label>
      <p className="max-w-[52ch] text-sm text-ink-2">{detail}</p>
    </div>
  )
}

/** One of the three summary picks. The basis line is required: a pick without a rule is an opinion. */
function Pick({
  label,
  pick,
  basis,
}: {
  label: string
  pick: Measurement | null
  basis: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {pick ? (
        <>
          <p className="font-mono text-lg text-ink">{formatConfigLabel(pick.config)}</p>
          <p className="font-mono text-sm tabular-nums text-ink-2">
            {formatLatency(pick.encryptNs)} to encrypt
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-3">Nothing measured meets this rule</p>
      )}
      <p className="max-w-[46ch] text-sm text-ink-3">{basis}</p>
    </div>
  )
}
