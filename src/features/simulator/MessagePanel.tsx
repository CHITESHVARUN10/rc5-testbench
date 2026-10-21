import { useId } from 'react'

import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Hint, Label, Meta } from '@/components/ui/Text'
import { Field, Segmented, TextArea, TextInput } from '@/components/ui/Form'
import { InlineError, Notice } from '@/components/ui/Feedback'
import { Stack, StackHead, StackRow } from '@/components/ui/Surface'
import { useSettings } from '@/state/settings.store'
import type { SimulatorState } from './useSimulator'

/**
 * Message and key entry.
 *
 * Two things this panel is careful about. First, the key has to be exactly the configured number of
 * bytes, and the byte count is shown live against the requirement rather than discovered on submit.
 * Second, the interface never says "output key" for ciphertext: RC5 produces no new key, and that
 * wording is the single most common way the algorithm is misdescribed.
 */

export function MessagePanel({ sim, onRequestClear }: { sim: SimulatorState; onRequestClear: () => void }) {
  const keyInputMode = useSettings((state) => state.keyInputMode)
  const setKeyInputMode = useSettings((state) => state.setKeyInputMode)
  const plaintextId = useId()

  const keyShort = sim.keyBytes !== null && sim.keyBytes.length < sim.config.b
  const keyLong = sim.keyBytes !== null && sim.keyBytes.length > sim.config.b

  return (
    <Stack>
      <StackHead index="03.2" title="Message and key" note="held in memory only" />

      <StackRow className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <label htmlFor={plaintextId}>
              <Label>Plaintext</Label>
            </label>
            <Meta className={cn(sim.inputError && 'text-err')}>
              {sim.plaintextByteCount} {sim.plaintextByteCount === 1 ? 'byte' : 'bytes'}
              {sim.inputMode === 'text' ? ' · UTF-8' : ' · hex'}
            </Meta>
          </div>
          <TextArea
            id={plaintextId}
            mono={sim.inputMode === 'hex'}
            value={sim.plaintext}
            onChange={(event) => sim.setPlaintext(event.target.value)}
            rows={5}
            placeholder={
              sim.inputMode === 'text'
                ? 'Type the message to encrypt'
                : 'A1B2 C3D4 E5F6 0718'
            }
            aria-invalid={sim.inputError ? true : undefined}
          />
          {sim.inputError ? <InlineError>{sim.inputError}</InlineError> : <BlockFit sim={sim} />}
        </div>

        <div className="space-y-3">
          <Segmented
            legend="Key format"
            value={keyInputMode}
            onChange={setKeyInputMode}
            options={[
              { value: 'text', label: 'Text' },
              { value: 'hex', label: 'Hex' },
            ]}
          />
          <Field
            label="Secret key"
            hint={
              keyShort
                ? `The key is ${sim.keyBytes?.length ?? 0} bytes; this configuration needs ${sim.config.b}. Extend it deliberately, or shorten b.`
                : keyLong
                  ? `The key is ${sim.keyBytes?.length ?? 0} bytes, longer than the ${sim.config.b} this configuration uses. Trimming would discard key material, so it is refused: shorten the key yourself or raise b.`
                  : 'The key must be exactly the configured length. It is never saved, logged, or placed in the address bar.'
            }
            error={sim.keyError}
            accessory={
              <span className="flex items-center gap-3">
                <Meta className={cn(sim.keyReady ? 'text-ink-3' : 'text-warn')}>
                  {sim.keyBytes?.length ?? 0} / {sim.config.b} B
                </Meta>
                {keyShort ? (
                  <Button compact variant="secondary" onClick={sim.padKey}>
                    Pad to {sim.config.b} B
                  </Button>
                ) : null}
              </span>
            }
          >
            <TextInput
              mono
              value={sim.keyText}
              onChange={(event) => sim.setKeyText(event.target.value)}
              placeholder={keyInputMode === 'text' ? 'sixteen-byte-key' : '000102030405060708090A0B0C0D0E0F'}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          {keyShort ? (
            <Hint>
              Padding zero-extends the key to the selected length and switches the field to hex, so the
              key you end up with is the one you can see.
            </Hint>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
          <Button variant="primary" glyph="play" onClick={sim.encrypt}>
            Encrypt
          </Button>
          <Button variant="secondary" onClick={sim.verify} disabled={!sim.encrypted}>
            Verify by decrypting
          </Button>
          <Button variant="ghost" glyph="refresh" onClick={onRequestClear}>
            Clear inputs
          </Button>
        </div>

        {sim.error ? <InlineError>{sim.error}</InlineError> : null}
      </StackRow>

      <StackRow>
        <Notice tone="note" title="Where this runs">
          Encryption happens in this browser tab. Nothing is sent anywhere, and there is no server
          involved. Closing the tab discards the message, the key, and the round keys derived from it.
        </Notice>
      </StackRow>
    </Stack>
  )
}

/** How the message will be laid out into blocks, before anything is encrypted. */
function BlockFit({ sim }: { sim: SimulatorState }) {
  const { plaintextByteCount, blockSize, plannedBlocks, plannedPaddingBytes, padding } = sim
  const aligned = plaintextByteCount % blockSize === 0

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-hair border border-rule bg-well px-3 py-2">
      <span className="flex items-baseline gap-1.5">
        <Label>Blocks</Label>
        <span className="font-mono text-sm tabular-nums text-ink">{plannedBlocks}</span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <Label>Block size</Label>
        <span className="font-mono text-sm tabular-nums text-ink">{blockSize} B</span>
      </span>
      {padding === 'pkcs7' ? (
        <span className="flex items-baseline gap-1.5">
          <Label>Padding</Label>
          <span className="font-mono text-sm tabular-nums text-ink">{plannedPaddingBytes} B</span>
        </span>
      ) : (
        <span className="flex items-baseline gap-1.5">
          <Label>Raw mode</Label>
          <span className={cn('font-mono text-sm', aligned ? 'text-ink-3' : 'text-warn')}>
            {aligned ? 'block aligned' : `${plaintextByteCount % blockSize} B left over`}
          </span>
        </span>
      )}
      {padding === 'pkcs7' && aligned && plaintextByteCount > 0 ? (
        <span className="text-sm text-ink-3">a whole block of padding is added to aligned input</span>
      ) : null}
    </div>
  )
}
