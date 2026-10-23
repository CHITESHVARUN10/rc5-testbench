import {
  MAX_KEY_BYTES,
  MAX_ROUNDS,
  MIN_KEY_BYTES,
  PRESET_PROFILES,
  UI_MIN_ROUNDS,
} from '@/lib/rc5/constants'
import type { WordSize } from '@/lib/rc5/types'
import { useSettings } from '@/state/settings.store'
import { cn } from '@/lib/cn'
import { RangeField, Segmented } from '@/components/ui/Form'
import { Hint, Label, Meta } from '@/components/ui/Text'
import { Notice } from '@/components/ui/Feedback'
import { Stack, StackHead, StackRow } from '@/components/ui/Surface'

/**
 * Configuration controls.
 *
 * Only values the engine implements and that the test suite covers are offered here: word sizes 16,
 * 32 and 64, rounds 1 to 32, and key lengths 1 to 32 bytes. The profiles at the top are starting
 * points for comparison, never recommendations, and the panel says so rather than leaving it implied.
 */

function sameConfig(a: { w: number; r: number; b: number }, b: { w: number; r: number; b: number }): boolean {
  return a.w === b.w && a.r === b.r && a.b === b.b
}

export function ConfigPanel() {
  const config = useSettings((state) => state.config)
  const setConfig = useSettings((state) => state.setConfig)
  const padding = useSettings((state) => state.padding)
  const setPadding = useSettings((state) => state.setPadding)
  const inputMode = useSettings((state) => state.inputMode)
  const setInputMode = useSettings((state) => state.setInputMode)

  const activeProfile = PRESET_PROFILES.find((profile) => sameConfig(profile.config, config))

  return (
    <Stack>
      <StackHead index="03.1" title="Configuration" note="profiles are comparison points" />

      <StackRow className="space-y-5">
        <div className="space-y-2">
          <Label>Profiles</Label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_PROFILES.map((profile) => {
              const selected = sameConfig(profile.config, config)
              return (
                <button
                  key={profile.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setConfig(profile.config)}
                  className={cn(
                    'min-h-9 rounded-hair border px-2 py-1.5 font-mono text-label',
                    'transition-colors duration-150 ease-instrument',
                    selected
                      ? 'border-ink bg-ink text-paper'
                      : 'border-rule-2 text-ink-2 hover:border-rule-3 hover:bg-well',
                  )}
                >
                  {profile.label}
                </button>
              )
            })}
          </div>
          <Hint>
            {activeProfile
              ? activeProfile.purpose
              : 'Custom values. Change one parameter at a time to see what it does.'}
          </Hint>
        </div>

        <Segmented<WordSize>
          legend="Word size (w)"
          value={config.w}
          onChange={(w) => setConfig({ ...config, w })}
          options={[
            { value: 16, label: '16' },
            { value: 32, label: '32' },
            { value: 64, label: '64' },
          ]}
          hint={`Block size is twice the word size: ${(2 * config.w) / 8} bytes.`}
        />

        <RangeField
          label="Rounds (r)"
          value={config.r}
          min={UI_MIN_ROUNDS}
          max={MAX_ROUNDS}
          stops={[8, 12, 16, 20, 24]}
          onChange={(r) => setConfig({ ...config, r })}
          hint="Each round adds work to every block. More rounds are not automatically safer."
        />

        <RangeField
          label="Key length (b)"
          value={config.b}
          min={MIN_KEY_BYTES}
          max={MAX_KEY_BYTES}
          unit="B"
          stops={[8, 16, 24, 32]}
          onChange={(b) => setConfig({ ...config, b })}
          hint="The key must match this length exactly. Key length is one input to security, not a measure of it."
        />
      </StackRow>

      <StackRow className="space-y-5">
        <Segmented
          legend="Block handling"
          value={padding}
          onChange={setPadding}
          options={[
            { value: 'pkcs7', label: 'PKCS#7' },
            { value: 'raw', label: 'Raw blocks' },
          ]}
          hint={
            padding === 'pkcs7'
              ? 'Pads the last block when the message does not fill it. Padding always adds at least one byte. It is framing, not authentication.'
              : 'Accepts only complete blocks. A message that does not fill a block is rejected rather than padded.'
          }
        />

        <Segmented
          legend="Message format"
          value={inputMode}
          onChange={setInputMode}
          options={[
            { value: 'text', label: 'UTF-8 text' },
            { value: 'hex', label: 'Hex bytes' },
          ]}
          hint={
            inputMode === 'text'
              ? 'Text is encoded as UTF-8 before encryption, so one character can be more than one byte.'
              : 'Hex is read as raw bytes. Spaces, commas and colons are ignored.'
          }
        />
      </StackRow>

      {config.w === 64 ? (
        <StackRow>
          <Notice tone="caution" title="64-bit words use a slower arithmetic path">
            In this implementation, 64-bit words are computed with arbitrary-precision integers, which
            costs many times more than the machine-integer arithmetic used at 16 and 32 bits. Encryption
            here is correct, but a 64-bit timing is not comparable with the other word sizes.
          </Notice>
        </StackRow>
      ) : null}
    </Stack>
  )
}

export function KeyLengthNote({ keyBytes, required }: { keyBytes: number; required: number }) {
  const matches = keyBytes === required
  return (
    <Meta className={cn(matches ? 'text-ink-3' : 'text-warn')}>
      {keyBytes} of {required} bytes {matches ? '' : '· mismatch'}
    </Meta>
  )
}
