import { BenchmarkCancelled, probeBenchmark, runBenchmark } from '@/lib/benchmark/runner'
import type { BenchEvent, BenchRequest, BenchSpec } from '@/lib/benchmark/protocol'

/**
 * Benchmark worker.
 *
 * All measurement happens here so the interface stays responsive: a run of tens of thousands of
 * operations would otherwise block rendering and input for its whole duration.
 *
 * Cancellation is cooperative. The runner checks a flag between samples, and the batches themselves
 * are short enough to finish promptly, so a cancel request is handled without killing the worker.
 * A page reload or an unrecoverable error still falls back to terminating the worker.
 */

interface WorkerScope {
  postMessage(message: BenchEvent): void
  onmessage: ((event: MessageEvent<BenchRequest>) => void) | null
}

const scope = self as unknown as WorkerScope

const cancelled = new Set<string>()
let activeRunId: string | null = null

function emit(event: BenchEvent): void {
  scope.postMessage(event)
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'The benchmark worker failed without reporting a reason.'
}

async function handleProbe(request: Extract<BenchRequest, { type: 'probe' }>): Promise<void> {
  try {
    const result = await probeBenchmark(request.spec)
    emit({ type: 'probe-result', result: { runId: request.runId, ...result } })
  } catch (error) {
    emit({ type: 'error', runId: request.runId, message: messageOf(error) })
  }
}

async function handleStart(request: Extract<BenchRequest, { type: 'start' }>): Promise<void> {
  activeRunId = request.runId
  cancelled.delete(request.runId)

  try {
    const result = await runBenchmark(request.runId, request.name, request.spec, {
      isCancelled: () => cancelled.has(request.runId) || activeRunId !== request.runId,
      onPilot: (estimateMs, opsPerBatch) =>
        emit({ type: 'pilot', runId: request.runId, estimateMs, opsPerBatch }),
      onProgress: (progress) => emit({ type: 'progress', runId: request.runId, progress }),
      onSample: (configIndex, target, sample) =>
        emit({ type: 'sample', runId: request.runId, configIndex, target, sample }),
    })
    emit({ type: 'done', result })
  } catch (error) {
    if (error instanceof BenchmarkCancelled) {
      emit({ type: 'cancelled', runId: request.runId })
    } else {
      emit({ type: 'error', runId: request.runId, message: messageOf(error) })
    }
  } finally {
    if (activeRunId === request.runId) activeRunId = null
    cancelled.delete(request.runId)
  }
}

scope.onmessage = (event: MessageEvent<BenchRequest>): void => {
  const request = event.data

  switch (request.type) {
    case 'cancel':
      cancelled.add(request.runId)
      return
    case 'probe':
      void handleProbe(request)
      return
    case 'start':
      void handleStart(request)
      return
    default:
      return
  }
}

export type { BenchEvent, BenchRequest, BenchSpec }
