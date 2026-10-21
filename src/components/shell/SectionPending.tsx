import { PageHeader } from '@/components/shell/PageHeader'
import { useSpecItems } from '@/components/shell/specs'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'

/** Shown while a section is still being built, so no route is ever a blank page or a fake one. */
export function SectionPending({
  index,
  category,
  title,
  lead,
  pending,
}: {
  index: string
  category: string
  title: string
  lead: string
  pending: string
}) {
  const specs = useSpecItems()
  return (
    <div className="space-y-8">
      <PageHeader index={index} category={category} title={title} lead={lead} specs={specs} />
      <EmptyState
        label="In progress"
        title="This section is not built yet"
        action={
          <ButtonLink to="/simulator" glyphAfter="arrow-right">
            Go to the simulator
          </ButtonLink>
        }
      >
        {pending}
      </EmptyState>
    </div>
  )
}
