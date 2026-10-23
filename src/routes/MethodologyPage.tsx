import { useState } from 'react'

import { getTimerResolutionMs } from '@/lib/env'
import { formatMilliseconds } from '@/lib/format'
import { MEASUREMENT_METHOD } from '@/lib/measurement'
import { ENGINE_VERSION, METHODOLOGY_VERSION, SCHEMA_VERSION } from '@/lib/versions'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/Overlay'
import { PageHeader } from '@/components/shell/PageHeader'
import { MotionControl } from '@/components/shell/MotionControl'
import { MetaList, MetaListItem, Stack, StackHead, StackRow } from '@/components/ui/Surface'
import { Hint } from '@/components/ui/Text'
import { useMeasurements } from '@/state/measurements.store'

/**
 * Method.
 *
 * Short on purpose. It states how one number is produced, what the number cannot tell you, and where
 * the data lives. Anything longer would be describing a tool that no longer exists.
 */

export function MethodologyPage() {
  const measurements = useMeasurements((state) => state.measurements)
  const clear = useMeasurements((state) => state.clear)
  const [confirmClear, setConfirmClear] = useState(false)

  const resolutionMs = getTimerResolutionMs()

  return (
    <div className="space-y-10 lg:space-y-12">
      <PageHeader
        index="05"
        category="Method"
        title="How the timings are taken"
        lead="One measurement is a median over repeated operations of the same configuration. This page states what is inside that number, what is outside it, and why it is not a security measurement."
      />

      <Stack>
        <StackHead index="05.1" title="A measurement, step by step" note="what happens when you press measure" />
        <StackRow className="space-y-4">
          <ol className="max-w-[74ch] list-decimal space-y-3 pl-5 text-sm text-ink-2">
            <li>
              A payload of the same size as your message is generated deterministically. The message
              itself is never used for timing and never leaves the page.
            </li>
            <li>
              The key is expanded once and the round keys are kept. The per-operation figures therefore
              exclude key setup; it is measured separately, as its own number.
            </li>
            <li>
              {MEASUREMENT_METHOD.warmupIterations} warm-up operations run first. The first executions of
              any function in a JavaScript engine are interpreted and then optimised, and charging that
              to the result would measure the optimiser.
            </li>
            <li>
              The run then takes {MEASUREMENT_METHOD.measuredIterations} samples. Each sample times a
              batch of operations and divides by the batch size, because this clock steps in about{' '}
              {formatMilliseconds(resolutionMs)} and cannot resolve a single operation on its own.
            </li>
            <li>
              The result is the median of those samples, with p95 and the coefficient of variation
              alongside it. The ciphertext is decrypted once and compared with the payload; a run that
              does not round-trip is marked as a mismatch rather than reported as a speed.
            </li>
          </ol>
        </StackRow>
        <StackRow className="space-y-3">
          <h3 className="text-lg font-semibold text-ink">What is inside the timed region</h3>
          <p className="max-w-[74ch] text-sm text-ink-2">
            Byte-to-word loading, the round function, and word-to-byte storing. Nothing else: payload
            generation, buffer allocation, padding and the comparison all happen outside the clock.
            Every configuration is measured the same way, which is what makes the comparison fair.
          </p>
          <Hint>
            The same payload buffer is reused for every operation, so it stays in cache. These are
            throughput figures under ideal memory conditions, not a prediction for a slower machine.
          </Hint>
        </StackRow>
      </Stack>

      <Stack>
        <StackHead index="05.2" title="What the number cannot tell you" />
        <StackRow className="space-y-4">
          <Notice tone="caution" title="Speed is not strength">
            A fast configuration is not a secure one. Timing measures computation, and the security of a
            cipher rests on cryptanalysis that no stopwatch can perform. The published attacks on
            reduced-round RC5 understand the algorithm; this tool does not attempt them.
          </Notice>
          <p className="max-w-[74ch] text-sm text-ink-2">
            These numbers also describe one browser on one machine at one moment. Another machine, a
            different browser, a busy processor or a thermal limit will move them. Treat them as a
            comparison between configurations on this machine, which is what they are, and not as an
            absolute property of RC5.
          </p>
          <p className="max-w-[74ch] text-sm text-ink-2">
            The security notes in Compare come from the specification and the published literature: 12
            rounds is the configuration RFC 2040 documents, and lower round counts are the reduced-round
            variants that cryptanalysis examines. They are context, not a verdict on your data.
          </p>
        </StackRow>
      </Stack>

      <Stack>
        <StackHead index="05.3" title="Your data and this build" />
        <StackRow className="space-y-5">
          <MetaList>
            <MetaListItem term="Engine">{ENGINE_VERSION}</MetaListItem>
            <MetaListItem term="Methodology">{METHODOLOGY_VERSION}</MetaListItem>
            <MetaListItem term="Schema">{SCHEMA_VERSION}</MetaListItem>
            <MetaListItem term="Measurements kept">up to 12 per browser</MetaListItem>
            <MetaListItem term="Samples per measurement">
              {MEASUREMENT_METHOD.measuredIterations}
            </MetaListItem>
            <MetaListItem term="Timer resolution">
              {formatMilliseconds(resolutionMs)} per step, as reported by this browser
            </MetaListItem>
          </MetaList>
          <p className="max-w-[74ch] text-sm text-ink-2">
            Measurements are stored in this browser's local storage so the comparison survives a reload.
            No key, plaintext or derived round key is ever stored. Clearing site data removes the
            measurements; the button below does the same thing without touching anything else.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              glyph="trash"
              onClick={() => setConfirmClear(true)}
              disabled={measurements.length === 0}
            >
              Clear {measurements.length} measurement{measurements.length === 1 ? '' : 's'}
            </Button>
            <Hint>Removing measurements does not change your settings or your inputs.</Hint>
          </div>
        </StackRow>
        <StackRow>
          <MotionControl />
        </StackRow>
      </Stack>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clear}
        title="Clear every measurement?"
        confirmLabel="Clear all measurements"
        tone="danger"
      >
        <p>
          {measurements.length} measurement{measurements.length === 1 ? '' : 's'} will be removed from
          this browser. They cannot be recovered, but measuring the same configurations again reproduces
          them closely.
        </p>
      </ConfirmDialog>
    </div>
  )
}
