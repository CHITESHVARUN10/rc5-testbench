import { useState } from 'react'

import { getTimerResolutionMs } from '@/lib/env'
import { formatConfigLabel, formatLatency, formatMilliseconds } from '@/lib/format'
import { blockSizeBytes } from '@/lib/rc5/constants'
import { PADDING_LABELS } from '@/lib/rc5/constants'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { CodeWell, CopyButton, DownloadButton } from '@/components/ui/Code'
import { DataTable, StatusFlag, Badge } from '@/components/ui/Data'
import { CheckboxField, TextArea } from '@/components/ui/Form'
import { InlineError, Notice } from '@/components/ui/Feedback'
import { Disclosure } from '@/components/ui/Overlay'
import { Rule, Stack, StackHead, StackRow, Well } from '@/components/ui/Surface'
import { Hint, Label, Meta } from '@/components/ui/Text'
import type { SimulatorState } from './useSimulator'

/**
 * A single measured operation, reported honestly.
 *
 * Browsers coarsen `performance.now()` as a side-channel mitigation, commonly to 100 µs per step. A
 * 15-byte encryption finishes well inside one step, so the honest answer is that this browser cannot
 * resolve it — not "0 ns", and not a number that implies precision the clock does not have. This is
 * precisely the limitation the Benchmark Lab works around by timing batches.
 */
function describeSingleTiming(elapsedNs: number): { value: string; note: string } {
  const resolutionMs = getTimerResolutionMs()
  const resolutionNs = resolutionMs > 0 ? resolutionMs * 1e6 : 0
  const belowResolution = elapsedNs <= 0 || (resolutionNs > 0 && elapsedNs < resolutionNs)

  if (belowResolution) {
    return {
      value: resolutionMs > 0 ? `< ${formatMilliseconds(resolutionMs)}` : 'Below resolution',
      note:
        'This operation finished inside one timer step, so this browser cannot resolve its duration. Batching many operations per sample is how the Benchmark Lab measures work this short.',
    }
  }

  return {
    value: formatLatency(elapsedNs),
    note: `One timing from one call in the interface thread, against a timer that steps in ${
      resolutionMs > 0 ? formatMilliseconds(resolutionMs) : 'unknown'
    }. A single sample carries no statistics: use the Benchmark Lab for anything you intend to compare.`,
  }
}

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
              <Meta>{describeSingleTiming(verified.elapsedNs).value} for this one operation</Meta>
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
                  The first difference is at byte {((verified.firstDifference ?? 0) + 1).toLocaleString('en-US')}{' '}
                  (counting from 1). A mismatch here normally means the key differs from the one used to
                  encrypt, or that the word size, round count or block handling has changed since.
                </p>
                <p className="mt-2">
                  Recovered bytes:{' '}
                  <span className="font-mono text-ink">{verified.recoveredHex.slice(0, 64) || '(none)'}</span>
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

export function DecryptPanel({ sim }: { sim: SimulatorState }) {
  return (
    <Stack>
      <StackHead
        index="03.5"
        title="Decrypt a ciphertext"
        note="including one you did not produce here"
      />
      <StackRow className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="decrypt-input">
            <Label>Ciphertext to decrypt</Label>
          </label>
          <TextArea
            id="decrypt-input"
            mono
            rows={3}
            value={sim.decryptInput}
            onChange={(event) => sim.setDecryptInput(event.target.value)}
            placeholder="Paste hex produced by this configuration"
          />
          <Hint>
            Decrypting runs the padding check as well as the cipher, so an error here means either the
            key or the configuration is wrong, or the bytes were altered.
          </Hint>
        </div>

        <Button variant="secondary" onClick={sim.decryptPasted} disabled={sim.decryptInput.trim().length === 0}>
          Decrypt this ciphertext
        </Button>

        {sim.decrypted ? (
          sim.decrypted.error ? (
            <Notice tone="warning" title="This ciphertext could not be decrypted">
              <p className="font-mono text-sm text-ink">{sim.decrypted.error}</p>
            </Notice>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <StatusFlag status="verified" />
                <Meta>{sim.decrypted.byteLength} bytes recovered</Meta>
                <Meta>{describeSingleTiming(sim.decrypted.elapsedNs).value}</Meta>
              </div>
              <CodeWell
                label="Recovered plaintext"
                hex={sim.decrypted.hex}
                emptyText="The ciphertext decrypted to nothing."
                actions={<CopyButton text={sim.decrypted.text ?? sim.decrypted.hex} compact />}
                footer={
                  sim.decrypted.text !== null ? (
                    <Meta>Reads as UTF-8 text: “{sim.decrypted.text}”</Meta>
                  ) : (
                    <Meta>Not valid UTF-8, so the bytes are shown as hex.</Meta>
                  )
                }
              />
            </div>
          )
        ) : null}
      </StackRow>
    </Stack>
  )
}

export function AdvancedPanel({ sim }: { sim: SimulatorState }) {
  const [revealKeys, setRevealKeys] = useState(false)
  const encrypted = sim.encrypted

  return (
    <Stack>
      <StackHead index="03.6" title="Advanced" note="timing, round keys, and the round trace" />
      <StackRow className="space-y-5">
        <div className="space-y-2">
          <Label>Single operation timing</Label>
          <p className="font-mono text-xl tabular-nums text-ink">
            {encrypted ? describeSingleTiming(encrypted.elapsedNs).value : '—'}
          </p>
          <Hint>
            {encrypted
              ? describeSingleTiming(encrypted.elapsedNs).note
              : 'Encrypt a message to take one timing. This is a single sample, not a benchmark.'}
          </Hint>
        </div>

        <Rule />

        <Disclosure summary="Round-by-round values" note="first block only">
          {sim.trace ? (
            <div className="space-y-3">
              <Meta>
                {formatConfigLabel(sim.trace.config)} · block {sim.trace.a0} {sim.trace.b0}
              </Meta>
              <DataTable
                caption="Round-by-round intermediate values for the first block"
                stickyHeader
                columns={[
                  { key: 'round', header: 'Round', align: 'right', render: (step) => <span className="text-ink-4">{step.round}</span> },
                  { key: 'aBefore', header: 'A before', align: 'right', render: (step) => step.aBefore },
                  { key: 'bBefore', header: 'B before', align: 'right', render: (step) => step.bBefore },
                  { key: 'rotA', header: 'rot A', align: 'right', render: (step) => <span className="text-ink-3">{step.rotA}</span> },
                  { key: 'aAfter', header: 'A after', align: 'right', render: (step) => step.aAfter },
                  { key: 'rotB', header: 'rot B', align: 'right', render: (step) => <span className="text-ink-3">{step.rotB}</span> },
                  { key: 'bAfter', header: 'B after', align: 'right', render: (step) => step.bAfter },
                ]}
                rows={sim.trace.steps.slice()}
                getRowKey={(step) => String(step.round)}
              />
              <Hint>
                Each round mixes A with B, rotates the result by the low bits of the other word, then adds
                a round key. The rotation amount depends on the data, which is what makes RC5's rotations
                data-dependent rather than fixed.
              </Hint>
            </div>
          ) : (
            <div className="space-y-3">
              <Hint>{sim.traceError ?? 'The trace is computed from the current input and key.'}</Hint>
              <Button variant="secondary" compact onClick={sim.requestTrace}>
                Compute the trace
              </Button>
            </div>
          )}
        </Disclosure>

        <Rule />

        <div className="space-y-4">
          <CheckboxField
            label="Reveal the round keys derived from my key"
            checked={revealKeys}
            onChange={(event) => setRevealKeys(event.target.checked)}
            hint="The expanded key table S is computed from the secret key. It is shown in memory only, is never saved, and is never included in an export. Revealing it reveals the key to anyone reading the screen."
          />
          {revealKeys && encrypted ? (
            <CodeWell
              label={`Round key table S — ${encrypted.scheduleHex.length} words`}
              hex={encrypted.scheduleHex.join('')}
              emptyText="Encrypt once to derive the schedule."
              maxHeightClass="max-h-56"
              footer={<Meta>Each word is {encrypted.config.w / 4} hex digits wide.</Meta>}
            />
          ) : revealKeys ? (
            <Hint>Encrypt a message first: the table is derived during a real operation.</Hint>
          ) : null}
        </div>
      </StackRow>
    </Stack>
  )
}

export function ConfigurationStamp({ sim }: { sim: SimulatorState }) {
  const encrypted = sim.encrypted
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1')}>
      <Meta>block {blockSizeBytes(sim.config.w)} B</Meta>
      <Meta>{sim.config.r} rounds</Meta>
      {encrypted ? <Meta>last run {formatConfigLabel(encrypted.config)}</Meta> : null}
    </div>
  )
}
