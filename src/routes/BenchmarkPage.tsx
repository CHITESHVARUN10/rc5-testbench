import { PADDING_LABELS } from '@/lib/rc5/constants'
import { PageHeader } from '@/components/shell/PageHeader'
import { useSpecItems } from '@/components/shell/specs'
import { Notice } from '@/components/ui/Feedback'
import { useSettings } from '@/state/settings.store'
import { BenchResults } from '@/features/benchmark/BenchResults'
import { MethodPanel, WorkloadPanel } from '@/features/benchmark/BenchPanel'
import { RunStrip } from '@/features/benchmark/RunStrip'
import { useBenchForm } from '@/features/benchmark/useBenchForm'

/**
 * Benchmark Lab.
 *
 * Composition follows the order of the work: choose the workload, choose the method, run it, read it.
 * The results are given the full width because distribution and method record are the parts that
 * actually need room, and they are the parts a reader has to be able to check.
 */
export function BenchmarkPage() {
  const form = useBenchForm()
  const padding = useSettings((state) => state.padding)
  const specs = useSpecItems([
    { label: 'padding', value: PADDING_LABELS[padding] },
    { label: 'runtime', value: 'browser worker' },
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        index="04"
        category="Measurement"
        title="Benchmark Lab"
        lead="Measure this machine on a workload you choose. Warm-up iterations are discarded, every sample is a batch of operations timed as a unit, and the method that produced each number is printed next to it."
        specs={specs}
      />

      <Notice tone="note" title="What a benchmark here can and cannot tell you">
        A result describes this browser on this machine at this payload size, under whatever else was
        running at the time. It does not describe a microcontroller, a server, or a different browser,
        and it says nothing at all about how strong any configuration is.
      </Notice>

      <div className="grid gap-6 lg:grid-cols-2">
        <WorkloadPanel form={form} />
        <MethodPanel form={form} />
      </div>

      <RunStrip form={form} />
      <BenchResults form={form} />
    </div>
  )
}
