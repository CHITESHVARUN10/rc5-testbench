import { useMemo, useState } from 'react'

import { blockSizeBytes } from '@/lib/rc5/constants'
import { traceBlock } from '@/lib/rc5/engine'
import { formatConfigLabel } from '@/lib/format'
import { useSettings } from '@/state/settings.store'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/Data'
import { Stack, StackRow, Well } from '@/components/ui/Surface'
import { Label, Meta } from '@/components/ui/Text'
import { cn } from '@/lib/cn'

/**
 * One round of RC5, with real numbers in it.
 *
 * Almost every explanation of a block cipher shows the structure with letters in the boxes. This one
 * runs the engine on a fixed demonstration block and shows the actual values at each stage, so the
 * diagram and the implementation cannot disagree: if the cipher were wrong, the numbers here would be
 * wrong in the same way.
 *
 * The demonstration input is fixed rather than taken from the Simulator, because a diagram whose
 * numbers change while you read the surrounding prose is harder to follow. The configuration follows
 * the rest of the application, so the round count, word width and key length all match what the other
 * pages are using.
 */

const DEMO_KEY_SEED = 7
const DEMO_BLOCK_SEED = 13

function demoBytes(length: number, seed: number): Uint8Array {
  const out = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    out[i] = (i * seed + seed) & 0xff
  }
  return out
}

export function RoundDiagram() {
  const config = useSettings((state) => state.config)
  const [step, setStep] = useState(0)

  const demo = useMemo(() => {
    const key = demoBytes(config.b, DEMO_KEY_SEED)
    const block = demoBytes(blockSizeBytes(config.w), DEMO_BLOCK_SEED)
    return { key, block, trace: traceBlock(block, 0, key, config) }
  }, [config])

  const roundCount = config.r
  const clampedStep = Math.min(step, roundCount)

  // Step 0 is the state after the two initial additions; step k is after round k.
  const registers =
    clampedStep === 0
      ? { a: demo.trace.aAfterInit, b: demo.trace.bAfterInit }
      : {
          a: demo.trace.steps[clampedStep - 1].aAfter,
          b: demo.trace.steps[clampedStep - 1].bAfter,
        }

  const active = clampedStep < roundCount ? demo.trace.steps[clampedStep] : null

  return (
    <Stack>
      <StackRow className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Label>Live round trace</Label>
          <Meta>{formatConfigLabel(config)}</Meta>
        </div>

        <Well className="overflow-x-auto p-4">
          <svg
            viewBox="0 0 720 210"
            className="h-auto w-full min-w-[640px]"
            role="img"
            aria-label={
              active
                ? `Round ${active.round} of ${roundCount}. A is ${active.aBefore}, B is ${active.bBefore}. A is rotated left by ${active.rotA} bits and B by ${active.rotB} bits.`
                : `The initial state before round one: A is ${registers.a}, B is ${registers.b}.`
            }
          >
            <defs>
              <marker id="round-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-rule-3)" />
              </marker>
            </defs>

            <g className="font-mono" fontSize="11">
              {/* register labels */}
              <text x="0" y="30" fill="var(--color-ink-3)" fontSize="10" letterSpacing="0.08em">
                A REGISTER
              </text>
              <text x="0" y="130" fill="var(--color-ink-3)" fontSize="10" letterSpacing="0.08em">
                B REGISTER
              </text>

              {/* A lane */}
              <RegisterBox x={0} y={40} value={active ? active.aBefore : registers.a} tone="ink" />
              <Arrow from={130} to={170} y={58} />
              <Node x={170} y={40} label="⊕" sub="with B" />
              <Arrow from={238} to={278} y={58} />
              <Node
                x={278}
                y={40}
                label="<<<"
                sub={active ? `by ${active.rotA}` : 'by B'}
                accent={active !== null}
              />
              <Arrow from={346} to={386} y={58} />
              <Node x={386} y={40} label="+" sub={active ? `S${active.round * 2}` : 'S[2i]'} />
              <Arrow from={454} to={494} y={58} />
              <RegisterBox
                x={494}
                y={40}
                value={active ? active.aAfter : registers.a}
                tone={active ? 'signal' : 'ink'}
              />

              {/* B lane */}
              <RegisterBox x={0} y={140} value={active ? active.bBefore : registers.b} tone="ink" />
              <Arrow from={130} to={170} y={158} />
              <Node x={170} y={140} label="⊕" sub="with A" />
              <Arrow from={238} to={278} y={158} />
              <Node
                x={278}
                y={140}
                label="<<<"
                sub={active ? `by ${active.rotB}` : 'by A'}
                accent={active !== null}
              />
              <Arrow from={346} to={386} y={158} />
              <Node x={386} y={140} label="+" sub={active ? `S${active.round * 2 + 1}` : 'S[2i+1]'} />
              <Arrow from={454} to={494} y={158} />
              <RegisterBox
                x={494}
                y={140}
                value={active ? active.bAfter : registers.b}
                tone={active ? 'signal' : 'ink'}
              />

              {/* rotate-amount taps, drawn as short leaders from the opposite register */}
              <text x="286" y="104" fill="var(--color-ink-4)" fontSize="9">
                rotate amount comes from B
              </text>
              <text x="286" y="204" fill="var(--color-ink-4)" fontSize="9">
                rotate amount comes from A
              </text>
            </g>
          </svg>
        </Well>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            compact
            glyph="chevron-right"
            onClick={() => setStep((current) => Math.max(0, Math.min(roundCount, current) - 1))}
            disabled={clampedStep === 0}
          >
            Previous
          </Button>
          <Button
            variant="primary"
            compact
            onClick={() => setStep((current) => Math.min(roundCount, current + 1))}
            disabled={clampedStep >= roundCount}
          >
            {clampedStep >= roundCount ? 'Complete' : `Step to round ${clampedStep + 1}`}
          </Button>
          <Button variant="ghost" compact glyph="refresh" onClick={() => setStep(0)}>
            Reset
          </Button>
          <span className="flex items-baseline gap-3 pl-2">
            <Meta>
              {clampedStep} of {roundCount} rounds applied
            </Meta>
            <Meta>
              A {registers.a} · B {registers.b}
            </Meta>
          </span>
        </div>

        {active ? (
          <DataTable
            caption={`Values inside round ${active.round}`}
            rows={[active]}
            getRowKey={(row) => String(row.round)}
            columns={[
              { key: 'round', header: 'Round', align: 'right', render: (row) => String(row.round) },
              { key: 'aBefore', header: 'A before', align: 'right', render: (row) => row.aBefore },
              { key: 'bBefore', header: 'B before', align: 'right', render: (row) => row.bBefore },
              {
                key: 'aRotated',
                header: `A ⊕ B rotated by ${active.rotA}`,
                align: 'right',
                render: (row) => row.aRotated,
              },
              { key: 's2i', header: `+ S${active.round * 2}`, align: 'right', render: (row) => row.s2i },
              { key: 'aAfter', header: 'A after', align: 'right', render: (row) => row.aAfter },
              {
                key: 'bRotated',
                header: `B ⊕ A rotated by ${active.rotB}`,
                align: 'right',
                render: (row) => row.bRotated,
              },
              {
                key: 's2i1',
                header: `+ S${active.round * 2 + 1}`,
                align: 'right',
                render: (row) => row.s2i1,
              },
              { key: 'bAfter', header: 'B after', align: 'right', render: (row) => row.bAfter },
            ]}
          />
        ) : (
          <p className="text-sm text-ink-3">
            All {roundCount} rounds have been applied. The final A and B are serialised back to bytes in
            little-endian order to form the ciphertext block.
          </p>
        )}

        <p className="text-sm text-ink-3">
          Working from the fixed demonstration block{' '}
          <span className="font-mono text-ink">{hexOf(demo.block)}</span> under{' '}
          {formatConfigLabel(config)} with the demonstration key{' '}
          <span className="font-mono text-ink">{hexOf(demo.key)}</span>. The prose above describes the
          same operations this diagram is performing.
        </p>
      </StackRow>
    </Stack>
  )
}

function hexOf(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0').toUpperCase()
  return out
}

function RegisterBox({ x, y, value, tone }: { x: number; y: number; value: string; tone: 'ink' | 'signal' }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="130"
        height="36"
        rx="2"
        fill="var(--color-sheet)"
        stroke={tone === 'signal' ? 'var(--color-signal)' : 'var(--color-rule-2)'}
        strokeWidth="1"
      />
      <text
        x={x + 10}
        y={y + 23}
        fill={tone === 'signal' ? 'var(--color-signal-ink)' : 'var(--color-ink)'}
        fontSize="14"
      >
        {value}
      </text>
    </g>
  )
}

function Node({
  x,
  y,
  label,
  sub,
  accent = false,
}: {
  x: number
  y: number
  label: string
  sub: string
  accent?: boolean
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="68"
        height="36"
        rx="2"
        fill="var(--color-paper)"
        stroke="var(--color-rule-2)"
        strokeWidth="1"
      />
      <text x={x + 34} y={y + 18} textAnchor="middle" fill="var(--color-ink)" fontSize="13">
        {label}
      </text>
      <text
        x={x + 34}
        y={y + 30}
        textAnchor="middle"
        fill={accent ? 'var(--color-signal-ink)' : 'var(--color-ink-3)'}
        fontSize="9"
      >
        {sub}
      </text>
    </g>
  )
}

function Arrow({ from, to, y }: { from: number; to: number; y: number }) {
  return (
    <line
      x1={from}
      y1={y}
      x2={to}
      y2={y}
      stroke="var(--color-rule-3)"
      strokeWidth="1"
      markerEnd="url(#round-arrow)"
      className={cn('transition-opacity')}
    />
  )
}
