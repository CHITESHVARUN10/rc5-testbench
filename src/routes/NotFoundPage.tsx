import { PageHeader } from '@/components/shell/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'

export function NotFoundPage() {
  return (
    <div className="space-y-10 lg:space-y-12">
      <PageHeader
        index="—"
        category="Not found"
        title="This page does not exist"
        lead="The address you followed is not one of the eight sections of this tool."
      />
      <EmptyState
        label="404"
        title="Nothing at this address"
        action={
          <ButtonLink to="/" glyphAfter="arrow-right">
            Back to the overview
          </ButtonLink>
        }
      >
        Every page in RC5 CipherLab is reachable from the section list.
      </EmptyState>
    </div>
  )
}
