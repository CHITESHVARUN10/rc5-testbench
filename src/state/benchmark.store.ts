import { create } from 'zustand'

import type {
  BenchEvent,
  BenchProbeResult,
  BenchProgress,
  BenchRequest,
  BenchRunResult,
  BenchSpec,
} from '@/lib/benchmark/protocol'

/**
 * Benchmark state.
 *
 * The worker is created lazily on the first request and kept alive between runs, so starting a second
 * run does not pay for a new worker. Samples stream in as they are measured, which is what lets the
 * page show the running coefficient of variation instead of a number that only appears at the end.
 *
 * None of this is persisted: a run belongs to the session that produced it. Saving a run is an
 * explicit action on the Experiments page.
 */

export type BenchmarkStatus = 'idle' | 'running' | 'cancelling' | 'done' | 'cancelled' | 'failed'

interface BenchmarkState {
  status: BenchmarkStatus
  /** A duration estimate runs in the background and must not disturb the status of a real run. */
  probing: boolean
  probeError: string | null
  runId: string | null
  runName: string
  progress: BenchProgress | null
  /** Latency samples for the group currently being measured. */
  liveSamples: number[]
  liveGroupKey: string | null
  liveCvPercent: number
  opsPerBatch: number
  estimateMs: number | null
  elapsedMs: number
  probe: BenchProbeResult | null
  result: BenchRunResult | null
  error: string | null
}

const INITIAL: BenchmarkState = {
  status: 'idle',
  probing: false,
  probeError: null,
  runId: null,
  runName: '',
  progress: null,
  liveSamples: [],
  liveGroupKey: null,
  liveCvPercent: 0,
  opsPerBatch: 0,
  estimateMs: null,
  elapsedMs: 0,
  probe: null,
  result: null,
  error: null,
}

export const useBenchmarkStore = create<BenchmarkState>(() => ({ ...INITIAL }))

let worker: Worker | null = null
let cancelFallback: number | undefined
let progressTicker: number | undefined

function workerInstance(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/benchmark.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<BenchEvent>) => handleEvent(event.data)
    worker.onerror = () => {
      useBenchmarkStore.setState({
        status: 'failed',
        error: 'The benchmark worker stopped unexpectedly. Reload the page and run again.',
      })
      stopTicker()
    }
  }
  return worker
}

function stopTicker(): void {
  window.clearInterval(progressTicker)
  progressTicker = undefined
}

function startTicker(): void {
  stopTicker()
  const startedAt = Date.now()
  progressTicker = window.setInterval(() => {
    useBenchmarkStore.setState({ elapsedMs: Date.now() - startedAt })
  }, 100)
}

function post(request: BenchRequest): void {
  workerInstance().postMessage(request)
}

function newRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function groupKey(configIndex: number, target: string): string {
  return `${configIndex}:${target}`
}

function handleEvent(event: BenchEvent): void {
  const store = useBenchmarkStore

  switch (event.type) {
    case 'probe-result':
      store.setState({ probe: event.result, probing: false, probeError: null })
      return

    case 'pilot':
      store.setState({ estimateMs: event.estimateMs, opsPerBatch: event.opsPerBatch })
      return

    case 'progress':
      store.setState({ progress: event.progress })
      return

    case 'sample': {
      const key = groupKey(event.configIndex, event.target)
      const current = store.getState()
      const samples = current.liveGroupKey === key ? [...current.liveSamples, event.sample.nsPerOp] : [event.sample.nsPerOp]
      store.setState({
        liveGroupKey: key,
        liveSamples: samples,
        liveCvPercent: event.sample.cvPercent,
        opsPerBatch: event.sample.opsPerBatch,
      })
      return
    }

    case 'group-done':
      return

    case 'done':
      stopTicker()
      window.clearTimeout(cancelFallback)
      store.setState({ status: 'done', result: event.result, runId: event.result.runId, error: null })
      return

    case 'cancelled':
      stopTicker()
      window.clearTimeout(cancelFallback)
      store.setState({ status: 'cancelled', result: null, progress: null })
      return

    case 'error': {
      stopTicker()
      window.clearTimeout(cancelFallback)
      const current = store.getState()
      if (current.status === 'running' || current.status === 'cancelling') {
        store.setState({ status: 'failed', error: event.message, result: null })
      } else {
        // A failed estimate is a hint, not an error: the run itself may still be fine.
        store.setState({ probing: false, probeError: event.message })
      }
      return
    }
  }
}

/** Ask the worker for a duration estimate without running anything. */
export function probeBenchmarkSpec(spec: BenchSpec): void {
  if (useBenchmarkStore.getState().status === 'running') return
  const runId = newRunId()
  useBenchmarkStore.setState({ probing: true, probeError: null })
  post({ type: 'probe', runId, spec })
}

export function startBenchmarkRun(spec: BenchSpec, name: string): string {
  const runId = newRunId()
  useBenchmarkStore.setState({
    ...INITIAL,
    status: 'running',
    runId,
    runName: name,
  })
  startTicker()
  post({ type: 'start', runId, name, spec })
  return runId
}

export function cancelBenchmarkRun(): void {
  const { runId, status } = useBenchmarkStore.getState()
  if (!runId || status !== 'running') return

  useBenchmarkStore.setState({ status: 'cancelling' })
  post({ type: 'cancel', runId })

  // If the worker does not acknowledge the cancellation, it is restarted rather than left running.
  window.clearTimeout(cancelFallback)
  cancelFallback = window.setTimeout(() => {
    if (useBenchmarkStore.getState().status === 'cancelling') {
      worker?.terminate()
      worker = null
      stopTicker()
      useBenchmarkStore.setState({ status: 'cancelled', result: null, progress: null })
    }
  }, 3000)
}

export function resetBenchmarkRun(): void {
  stopTicker()
  useBenchmarkStore.setState({ ...INITIAL })
}

/** Short status word for the rail footer. */
export function useBenchmarkStatus(): string {
  return useBenchmarkStore((state) => statusWord(state.status))
}

export function statusWord(status: BenchmarkStatus): string {
  switch (status) {
    case 'running':
      return 'Running'
    case 'cancelling':
      return 'Cancelling'
    case 'done':
      return 'Complete'
    case 'cancelled':
      return 'Cancelled'
    case 'failed':
      return 'Failed'
    case 'idle':
      return 'Idle'
  }
}
