import { create } from 'zustand'

import type { BenchEvent, BenchProgress } from '@/lib/benchmark/protocol'
import { measurementFromRun, measurementSpec, type Measurement } from '@/lib/measurement'
import type { Rc5Config } from '@/lib/rc5/types'

/**
 * Running one measurement.
 *
 * The work happens in a worker so the page stays responsive and the run can be cancelled between
 * samples. From the interface's point of view there is a single action — measure this configuration —
 * and a single outcome: one record, or nothing if it was cancelled or failed.
 */

export type MeasurementStatus = 'idle' | 'running' | 'cancelling' | 'done' | 'cancelled' | 'failed'

interface MeasurementRunState {
  readonly status: MeasurementStatus
  readonly progress: BenchProgress | null
  readonly error: string | null
}

export const useMeasurementRun = create<MeasurementRunState>()(() => ({
  status: 'idle',
  progress: null,
  error: null,
}))

let worker: Worker | null = null
let pending: ((outcome: Measurement | null) => void) | null = null
let activeRunId: string | null = null
let cancelTimer: number | null = null

function settle(outcome: Measurement | null): void {
  const resolve = pending
  pending = null
  activeRunId = null
  if (cancelTimer !== null) {
    window.clearTimeout(cancelTimer)
    cancelTimer = null
  }
  if (resolve) resolve(outcome)
}

function handleEvent(event: BenchEvent): void {
  switch (event.type) {
    case 'progress':
      useMeasurementRun.setState({ progress: event.progress })
      return
    case 'done':
      useMeasurementRun.setState({ status: 'done', progress: null })
      settle(measurementFromRun(event.result))
      return
    case 'cancelled':
      useMeasurementRun.setState({ status: 'cancelled', progress: null })
      settle(null)
      return
    case 'error':
      useMeasurementRun.setState({ status: 'failed', error: event.message, progress: null })
      settle(null)
      return
    default:
      // Pilot estimates, individual samples and per-group results are internal detail: the record
      // carries everything the interface shows.
      return
  }
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/benchmark.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<BenchEvent>) => handleEvent(event.data)
  worker.onerror = () => {
    useMeasurementRun.setState({
      status: 'failed',
      error: 'The measuring worker stopped unexpectedly. Reload the page and try again.',
      progress: null,
    })
    settle(null)
  }
  return worker
}

export function measureConfiguration(
  config: Rc5Config,
  payloadBytes: number,
): Promise<Measurement | null> {
  if (activeRunId) return Promise.resolve(null)

  const runId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `run-${Date.now().toString(36)}`

  activeRunId = runId
  useMeasurementRun.setState({ status: 'running', progress: null, error: null })

  return new Promise((resolve) => {
    pending = resolve
    getWorker().postMessage({
      type: 'start',
      runId,
      name: `RC5-${config.w}/${config.r}/${config.b}`,
      spec: measurementSpec(config, payloadBytes),
    })
  })
}

export function cancelMeasurement(): void {
  if (!activeRunId) return
  const runId = activeRunId
  useMeasurementRun.setState({ status: 'cancelling' })
  worker?.postMessage({ type: 'cancel', runId })
  cancelTimer = window.setTimeout(() => {
    worker?.terminate()
    worker = null
    useMeasurementRun.setState({ status: 'cancelled', progress: null })
    settle(null)
  }, 3000)
}

/** A short label for the rail: what the worker is doing, if anything. */
export function useWorkerStatus(): string {
  return useMeasurementRun((state) => {
    if (state.status === 'running') return 'measuring'
    if (state.status === 'cancelling') return 'stopping'
    return 'idle'
  })
}
