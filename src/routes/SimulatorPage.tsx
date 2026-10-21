import { useState } from 'react'

import { PADDING_LABELS } from '@/lib/rc5/constants'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Overlay'
import { PageHeader } from '@/components/shell/PageHeader'
import { useSpecItems } from '@/components/shell/specs'
import { useSettings } from '@/state/settings.store'
import { ConfigPanel } from '@/features/simulator/ConfigPanel'
import { MessagePanel } from '@/features/simulator/MessagePanel'
import {
  AdvancedPanel,
  CiphertextPanel,
  DecryptPanel,
  VerificationPanel,
} from '@/features/simulator/ResultPanels'
import { useSimulator } from '@/features/simulator/useSimulator'

/**
 * The Simulator.
 *
 * A work surface rather than a form: configuration on the left, the working column on the right, and
 * the results stacked in the order the workflow produces them — ciphertext first, then the round-trip
 * check, then the reverse direction, then the internals for anyone who wants them.
 */
export function SimulatorPage() {
  const sim = useSimulator()
  const padding = useSettings((state) => state.padding)
  const [confirmClear, setConfirmClear] = useState(false)

  const specs = useSpecItems([{ label: 'padding', value: PADDING_LABELS[padding] }])

  return (
    <div className="space-y-8">
      <PageHeader
        index="03"
        category="Encryption"
        title="Simulator"
        lead="Configure RC5, encrypt a message, and verify the result by decrypting it again. Every value shown here is computed in this tab from the parameters above it."
        specs={specs}
        actions={
          <Button variant="secondary" glyph="trash" onClick={() => setConfirmClear(true)}>
            Clear inputs
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
        <ConfigPanel />
        <div className="min-w-0 space-y-6">
          <MessagePanel sim={sim} onRequestClear={() => setConfirmClear(true)} />
          <CiphertextPanel sim={sim} />
          <VerificationPanel sim={sim} />
          <DecryptPanel sim={sim} />
          <AdvancedPanel sim={sim} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={sim.clearAll}
        title="Clear the message and the key?"
        confirmLabel="Clear everything"
        tone="danger"
      >
        <p>
          The plaintext and the secret key are dropped from memory and the results are cleared. Nothing
          was stored anywhere, so there is no copy to recover afterwards.
        </p>
      </ConfirmDialog>
    </div>
  )
}
