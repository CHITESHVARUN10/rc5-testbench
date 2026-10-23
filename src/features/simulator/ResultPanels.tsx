import { useState } from 'react'

import { formatByteCount, formatConfigLabel, formatLatency, formatPercent } from '@/lib/format'
import {
  MIN_MEASURE_PAYLOAD_BYTES,
  measurementKey,
  type Measurement,
} from '@/lib/measurement'
import { PADDING_LABELS } from '@/lib/rc5/constants'
import { Button, ButtonLink } from '@/components/ui/Button'
import { CodeWell, CopyButton, DownloadButton } from '@/components/ui/Code'
import { Readout, ReadoutCell, ReadoutGrid, StatusFlag, Badge } from '@/components/ui/Data'
import { InlineError, Notice, ProgressBar } from '@/components/ui/Feedback'
import { Stack, StackHead, StackRow, Well } from '@/components/ui/Surface'
import { Hint, Label, Meta } from '@/components/ui/Text'
import {
  cancelMeasurement,
  measureConfiguration,
  useMeasurementRun,
} from '@/state/benchmark.store'
import { useMeasurements } from '@/state/measurements.store'
import type { SimulatorState } from './useSimulator'

/**
 * Result panels.
 *
 * Every result carries the configuration that produced it, and says so when that configuration is no
 * longer the one selected. Output that silently survives a parameter change is how a demonstration
 * ends up showing a ciphertext next to the wrong parameters.
 */

export function CiphertextPanel({ sim }: { sim: SimulatorState }) {
  const encrypted = sim.encrypted

  return (
    <Stack>
      <StackHead index="03.3" title="Ciphertext" note="raw block output, hex encoded" />
      <StackRow className="space-y-4">
        {sim.encryptedIsStale && encrypted ? (
          <Notice tone="caution" title="The configuration has changed since this output">
            This ciphertext was produced with {formatConfigLabel(encrypted.config)} under{' '}
            {PADDING_LABELS[encrypted.padding]}. The parameters above are different now, so the output
            below no longer describes them.
          </Notice>
        ) : null}

        <CodeWell
          label="Ciphertext"
          hex={encrypted?.ciphertextHex ?? ''}
          emptyText="Nothing encrypted yet. Enter a message and a key, then choose Encrypt."
          actions={
            encrypted ? (
              <>
                <CopyButton text={encrypted.ciphertextHex} compact label="Copy hex" />
                <DownloadButton
                  text={encrypted.ciphertextHex}
                  filename="rc5-ciphertext.hex"
                  compact
                  label="Download"
                />
              </>
            ) : null
          }
          footer={
            encrypted ? (
              <>
                <Meta>{encrypted.outputBytes} bytes</Meta>
                <Meta>{encrypted.blocks} blocks</Meta>
                <Meta>padding {encrypted.paddingBytes} B</Meta>
                <Meta>{formatConfigLabel(encrypted.config)}</Meta>
                <Meta>{PADDING_LABELS[encrypted.padding]}</Meta>
                <Badge>{encrypted.inputBytes} B in</Badge>
              </>
            ) : (
              <Meta>Hex is grouped in fours for reading. Copying gives the ungrouped form.</Meta>
            )
          }
        />
      </StackRow>
    </Stack>
  )
}

export function VerificationPanel({ sim }: { sim: SimulatorState }) {
  const verified = sim.verified

  return (
    <Stack>
      <StackHead
        index="03.4"
        title="Verification"
        note="decrypt the output and compare it with the input"
      />
      <StackRow className="space-y-4">
        {!verified ? (
          <Hint>
            Choose Verify by decrypting to decrypt the ciphertext above and compare the result with the
            bytes you entered. A match means this implementation round-trips; it does not mean the
            ciphertext is authentic.
          </Hint>
        ) : verified.error ? (
          <InlineError>{verified.error}</InlineError>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <StatusFlag status={verified.matches ? 'verified' : 'mismatch'} />
              <Meta>
                {sim.encrypted
                  ? `${formatConfigLabel(sim.encrypted.config)} · ${PADDING_LABELS[sim.encrypted.padding]}`
                  : ''}
              </Meta>
            </div>

            {sim.verifiedIsStale ? (
              <Notice tone="caution" title="Verified under a different configuration">
                This check was run before the parameters above changed. Run it again to verify the
                current configuration.
              </Notice>
            ) : null}

            {verified.matches ? (
              <div className="space-y-2">
                <Label>Recovered plaintext</Label>
                <Well className="px-3 py-2.5">
                  <p className="font-mono text-sm break-all whitespace-pre-wrap text-ink">
                    {verified.recoveredText ?? verified.recoveredHex}
                  </p>
                </Well>
                {verified.recoveredText === null ? (
                  <Hint>
                    These bytes are not valid UTF-8, so they are shown as hex. That is normal when the
                    original input was hex or binary.
                  </Hint>
                ) : null}
                <Hint>
                  The recovered bytes are identical to the input, including {verified.paddingBytes} bytes
                  of padding that were removed on the way back.
                </Hint>
              </div>
            ) : (
              <Notice tone="warning" title="The recovered bytes do not match the input">
                <p>
                  The first difference is at byte{' '}
                  {((verified.firstDifference ?? 0) + 1).toLocaleString('en-US')} (counting from 1). A
                  mismatch here normally means the key differs from the one used to encrypt, or that the
                  word size, round count or block handling has changed since.
                </p>
                <p className="mt-2">
                  Recovered bytes:{' '}
                  <span className="font-mono text-ink">
                    {verified.recoveredHex.slice(0, 64) || '(none)'}
                  </span>
                </p>
              </Notice>
            )}

            <Hint>
              A match proves the round trip, not authenticity. Anyone can alter ciphertext bytes, and
              padding cannot detect it.
            </Hint>
          </>
        )}
      </StackRow>
    </Stack>
  )
}

/**
 * The step that produces a comparison.
 *
 * The recorded time is on a generated payload of the same size as the message above, not on the
 * message itself: the same bytes are encrypted thousands of times, and the plaintext never needs to
 * leave this component. The median is reported because a single timing on this clock is noise.
 */
export function MeasurePanel({ sim }: { sim: SimulatorState }) {
  const status = useMeasurementRun((state) => state.status)
  const progress = useMeasurementRun((state) => state.progress)
  const error = useMeasurementRun((state) => state.error)
  const measurements = useMeasurements((state) => state.measurements)
  const add = useMeasurements((state) => state.add)

  const [outcome, setOutcome] = useState<Measurement | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const busy = status === 'running' || status === 'cancelling'
  const fromMessage = sim.plaintextByteCount > 0
  const payloadBytes = fromMessage
    ? Math.max(sim.plaintextByteCount, MIN_MEASURE_PAYLOAD_BYTES)
    : 64

  const alreadyMeasured = measurements.some(
    (row) => measurementKey(row.config, row.payloadBytes) === measurementKey(sim.config, payloadBytes),
  )

  async function handleMeasure() {
    setMessage(null)
    const result = await measureConfiguration(sim.config, payloadBytes)
    if (!result) return
    setOutcome(result)
    setMessage(add(result).message)
  }

  const done = progress ? progress.done : 0
  const total = progress ? progress.total : 0

  return (
    <Stack>
      <StackHead
        index="03.5"
        title="Measure this configuration"
        note="the step that feeds the comparison"
      />
      <StackRow className="space-y-4">
        <p className="max-w-[68ch] text-sm text-ink-2">
          Time encryption and decryption of a {formatByteCount(payloadBytes)} message under{' '}
          {formatConfigLabel(sim.config)}
          {fromMessage ? ' — the size of the message above.' : ' — the default size, since the message is empty.'}{' '}
          The work runs in a worker: a warm-up, then many repeated operations in batches, and the
          median of those samples is reported.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleMeasure} disabled={busy}>
            {busy ? 'Measuring…' : 'Measure this configuration'}
          </Button>
          {busy ? (
            <Button variant="ghost" onClick={cancelMeasurement}>
              Cancel
            </Button>
          ) : null}
          <ButtonLink to="/compare" variant="secondary" glyphAfter="arrow-right">
            Open the comparison
          </ButtonLink>
        </div>

        {busy ? (
          <div className="space-y-2">
            <ProgressBar
              value={done}
              max={total || 1}
              label="Measurement progress"
              className="max-w-md"
            />
            <Hint>
              {total > 0
                ? `${Math.round(done).toLocaleString('en-US')} of ${Math.round(total).toLocaleString('en-US')} samples`
                : 'Preparing the workload'}
              {progress ? ` · ${progress.target}` : ''}
            </Hint>
          </div>
        ) : null}

        {status === 'failed' && error ? <InlineError>{error}</InlineError> : null}

        {alreadyMeasured && !busy ? (
          <Hint>
            This configuration and message size are already in the comparison. Measuring again replaces
            that row with the new result.
          </Hint>
        ) : null}

        {outcome ? (
          <div className="space-y-3">
            <ReadoutGrid>
              <ReadoutCell>
                <Readout label="Encrypt" value={formatLatency(outcome.encryptNs)} size="lg" />
              </ReadoutCell>
              <ReadoutCell>
                <Readout label="Decrypt" value={formatLatency(outcome.decryptNs)} size="lg" />
              </ReadoutCell>
              <ReadoutCell>
                <Readout
                  label="Key setup"
                  value={outcome.keySetupNs > 0 ? formatLatency(outcome.keySetupNs) : '—'}
                />
              </ReadoutCell>
              <ReadoutCell>
                <Readout
                  label="Spread"
                  value={formatPercent(outcome.spreadPercent)}
                  note="variation across samples"
                />
              </ReadoutCell>
            </ReadoutGrid>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <StatusFlag
                status={outcome.correctness === 'verified' ? 'verified' : 'mismatch'}
              />
              <Meta>{outcome.samples} samples</Meta>
              <Meta>{formatByteCount(outcome.payloadBytes)} message</Meta>
              <Meta>timer steps in {outcome.timerResolutionMs.toFixed(3)} ms</Meta>
            </div>
            {message ? <Hint>{message}</Hint> : null}
            <Hint>
              This is one configuration. Add another by changing the parameters above and measuring
              again, then read them side by side in Compare.
            </Hint>
          </div>
        ) : null}
      </StackRow>
    </Stack>
  )
}
