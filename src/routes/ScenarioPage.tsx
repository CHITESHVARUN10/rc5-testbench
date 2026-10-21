import { PADDING_LABELS } from '@/lib/rc5/constants'
import { PageHeader } from '@/components/shell/PageHeader'
import { useSpecItems } from '@/components/shell/specs'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, Notice } from '@/components/ui/Feedback'
import { useExperiments } from '@/state/experiments.store'
import { useSettings } from '@/state/settings.store'
import { ScenarioWorkbench } from '@/features/scenario/ScenarioWorkbench'

/**
 * Scenario Planner.
 *
 * Translates a measured cipher time into an illustrative budget. The framing evidence is the point of
 * the page: the deadline, the link rate and the delay are the user's assumptions, the cipher time is a
 * measurement, and the total is arithmetic on both. Those three are labelled separately everywhere
 * they appear.
 */
export function ScenarioPage() {
  const runs = useExperiments((state) => state.runs)
  const padding = useSettings((state) => state.padding)
  const specs = useSpecItems([{ label: 'padding', value: PADDING_LABELS[padding] }])

  return (
    <div className="space-y-8">
      <PageHeader
        index="06"
        category="Estimation"
        title="Scenario Planner"
        lead="Place a measured cipher time inside a timing budget you define, with every assumption you supply labelled as an assumption and every figure taken from a real run labelled as measured."
        specs={specs}
        actions={
          <ButtonLink to="/benchmark" variant="secondary">
            Measure something first
          </ButtonLink>
        }
      />

      <Notice tone="caution" title="An estimate built from one measurement and several assumptions">
        This is an illustrative calculation, not a network model. It has no congestion, no
        retransmission, no queueing and no protocol behaviour in it, and a browser measurement does not
        describe how a low-power device would perform. Read the result as a bound on one component of a
        budget, not as a prediction of what a system will do.
      </Notice>

      {runs.length === 0 ? (
        <EmptyState
          label="No saved measurements"
          title="A scenario needs a measured cipher time to place in the budget"
          action={
            <ButtonLink to="/benchmark" variant="primary" glyphAfter="arrow-right">
              Open the Benchmark Lab
            </ButtonLink>
          }
        >
          Everything the planner cannot measure — link rate, delay, serialization, the deadline — you
          supply yourself. The one part it refuses to guess is the cipher, so measure it first.
        </EmptyState>
      ) : (
        <ScenarioWorkbench runs={runs} />
      )}
    </div>
  )
}
