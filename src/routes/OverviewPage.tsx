import { Link } from 'react-router-dom'

import { formatConfigLabel, formatLatency, formatPercent, formatRelative } from '@/lib/format'
import { ButtonLink } from '@/components/ui/Button'
import { Readout, ReadoutCell, ReadoutGrid, StatusFlag } from '@/components/ui/Data'
import { EmptyState, Notice } from '@/components/ui/Feedback'
import { Stack, StackRow, SectionHead } from '@/components/ui/Surface'
import { Meta } from '@/components/ui/Text'
import { Glyph } from '@/components/ui/Glyph'
import { useMeasurements } from '@/state/measurements.store'
import { useSpecItems } from '@/components/shell/specs'
import { PageHeader } from '@/components/shell/PageHeader'

/**
 * Overview.
 *
 * Three steps, in the order they happen: configure and encrypt, measure that configuration, compare it
 * with the others. Nothing else is described here, because nothing else is needed to produce a
 * comparison.
 */

const START_HERE: readonly { index: string; path: string; label: string; detail: string }[] = [
  {
    index: '01',
    path: '/simulator',
    label: 'Configure and encrypt',
    detail: 'Pick a word size, a round count and a key length, then encrypt a message you can read',
  },
  {
    index: '02',
    path: '/simulator',
    label: 'Verify and measure',
    detail: 'Decrypt it back to prove the round trip, then time that configuration in the worker',
  },
  {
    index: '03',
    path: '/compare',
    label: 'Compare',
    detail: 'See encryption and decryption time side by side, with what each configuration is',
  },
]

export function OverviewPage() {
  const measurements = useMeasurements((state) => state.measurements)
  const specs = useSpecItems()
  const latest = measurements[0]

  return (
    <div className="space-y-10 lg:space-y-12">
      <PageHeader
        index="01"
        category="RC5 CipherLab"
        title="RC5 encryption, measured"
        lead="Choose the word size, round count and key length. Encrypt a message, decrypt it back, and time the configuration. Every number on this site is produced by the cipher running in this browser."
        specs={specs}
        actions={
          <>
            <ButtonLink to="/simulator" variant="primary" glyphAfter="arrow-right">
              Open the simulator
            </ButtonLink>
            <ButtonLink to="/learn" variant="secondary">
              Learn RC5 first
            </ButtonLink>
          </>
        }
      />

      <Notice tone="caution" title="What this tool is not">
        RC5 is a legacy cipher. Nothing here establishes that any configuration is safe for protecting
        real data: speed is not strength, and a round count on its own is not strength either. This
        measures work, and it explains what each configuration is.
      </Notice>

      <section className="space-y-4">
        <SectionHead index="01.1" title="How it works" />
        <Stack>
          {START_HERE.map((item, index) => (
            <Link
              key={`${item.index}-${item.path}`}
              to={item.path}
              className="group flex items-start gap-4 px-5 py-4 transition-colors duration-150 ease-instrument hover:bg-well sm:px-6"
            >
              <Meta className="pt-0.5 text-ink-4">{item.index}</Meta>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-ink">{item.label}</span>
                <span className="mt-0.5 block text-sm text-ink-3">{item.detail}</span>
              </span>
              <Glyph
                name="arrow-right"
                size={16}
                className="mt-1 text-ink-4 transition-transform duration-200 ease-instrument group-hover:translate-x-0.5 group-hover:text-signal-ink"
              />
              {index === 2 && measurements.length > 0 ? (
                <span className="sr-only">{measurements.length} measurements available</span>
              ) : null}
            </Link>
          ))}
        </Stack>
      </section>

      <section className="space-y-4">
        <SectionHead
          index="01.2"
          title="Last measurement"
          note={latest ? formatRelative(latest.createdAt) : undefined}
          actions={
            latest ? (
              <ButtonLink to="/compare" variant="ghost" compact>
                All measurements
              </ButtonLink>
            ) : undefined
          }
        />
        {latest ? (
          <div className="space-y-4">
            <ReadoutGrid>
              <ReadoutCell>
                <Readout
                  label="Configuration"
                  value={formatConfigLabel(latest.config)}
                  note={`${latest.payloadBytes.toLocaleString('en-US')} B message`}
                />
              </ReadoutCell>
              <ReadoutCell>
                <Readout
                  label="Encrypt"
                  value={formatLatency(latest.encryptNs)}
                  note="median per operation"
                  size="lg"
                />
              </ReadoutCell>
              <ReadoutCell>
                <Readout
                  label="Decrypt"
                  value={formatLatency(latest.decryptNs)}
                  note="median per operation"
                  size="lg"
                />
              </ReadoutCell>
              <ReadoutCell>
                <Readout
                  label="Spread"
                  value={formatPercent(latest.spreadPercent)}
                  note="variation across samples"
                />
              </ReadoutCell>
            </ReadoutGrid>
            <div className="flex flex-wrap items-center gap-3">
              <StatusFlag status={latest.correctness === 'verified' ? 'verified' : 'mismatch'} />
              <ButtonLink to="/compare" variant="secondary" glyphAfter="arrow-right">
                Compare configurations
              </ButtonLink>
            </div>
          </div>
        ) : (
          <EmptyState
            label="Nothing measured yet"
            title="Measure your first configuration"
            action={
              <ButtonLink to="/simulator" variant="primary" glyphAfter="arrow-right">
                Open the Simulator
              </ButtonLink>
            }
          >
            Encrypt a message there and choose Measure this configuration. It takes a moment, and the
            result appears here and in the comparison.
          </EmptyState>
        )}
      </section>

      <section className="space-y-4">
        <SectionHead index="01.3" title="Where the numbers come from" />
        <Stack>
          <StackRow className="space-y-2">
            <p className="max-w-[72ch] text-sm text-ink-2">
              Every figure is measured on this machine, in this browser tab. There is no server and no
              stored secret: the plaintext and the key never leave the page, and the measurements live
              in this browser only.
            </p>
            <p className="max-w-[72ch] text-sm text-ink-2">
              The timings are medians over repeated operations, because a single reading of this clock
              is noise. The Method page states exactly what is included and what is not.
            </p>
          </StackRow>
        </Stack>
      </section>
    </div>
  )
}
