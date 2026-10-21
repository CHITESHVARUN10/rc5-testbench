/**
 * Scenario estimation.
 *
 * This module exists to keep three kinds of number from being blended into one: a measured latency
 * taken from a real run, a value the user entered as an assumption, and a value computed from those
 * two. Every component of the estimate carries its provenance, and the interface prints it, because a
 * total that hides which of its parts were observed and which were assumed is not evidence.
 *
 * The model is deliberately small and is labelled as illustrative wherever it appears:
 *
 *   per-message path = encrypt + serialization + transmission + network + decrypt
 *   transmission     = (payload + framing) × 8 / bandwidth
 *
 * It is not a network performance model. It has no congestion, no retransmission, no queueing, no
 * scheduling, and no thermal behaviour. A one-way path is the same computation; a request/response
 * path is modelled as that same path twice, which assumes a reply of similar size handled the same
 * way.
 */

export type Provenance = 'measured' | 'assumed' | 'estimated'

export type ScenarioMode = 'one-way' | 'request-response'

export interface ScenarioInput {
  readonly name: string
  readonly payloadBytes: number
  readonly messageCount: number
  /** Deadline for one message, in milliseconds. */
  readonly budgetMs: number
  readonly bandwidthBitsPerSecond: number | null
  readonly networkOverheadMs: number | null
  readonly serializationOverheadMs: number | null
  /** Protocol or framing bytes added to each transmission. User-entered. */
  readonly framingBytes: number
  readonly mode: ScenarioMode
  /** Measured per-operation latency for this configuration and payload, in nanoseconds. */
  readonly encryptNs: number | null
  readonly decryptNs: number | null
  /** Which saved result the measured figures came from, for the record. */
  readonly sourceLabel: string | null
}

export interface ScenarioComponent {
  readonly id: string
  readonly label: string
  readonly valueMs: number
  readonly provenance: Provenance
  readonly applies: boolean
  readonly note: string
}

export type ScenarioStatus = 'within-budget' | 'over-budget' | 'insufficient-data'

export interface ScenarioResult {
  readonly components: readonly ScenarioComponent[]
  /** Time for one message along the whole path. This is what the deadline is compared against. */
  readonly perMessageMs: number
  readonly messageCount: number
  /** Per-message path multiplied by the number of messages. Informational, not a deadline comparison. */
  readonly totalMs: number
  readonly budgetMs: number
  readonly remainingMs: number
  readonly budgetUsedPercent: number
  readonly messagesPerBudget: number
  readonly status: ScenarioStatus
  readonly missing: readonly string[]
  readonly notes: readonly string[]
  readonly hasMeasuredEncryption: boolean
}

const NS_PER_MS = 1e6

function msFromNs(ns: number | null): number | null {
  if (ns === null || !Number.isFinite(ns) || ns < 0) return null
  return ns / NS_PER_MS
}

export function transmissionMs(
  payloadBytes: number,
  framingBytes: number,
  bandwidthBitsPerSecond: number | null,
): number | null {
  if (
    bandwidthBitsPerSecond === null ||
    !Number.isFinite(bandwidthBitsPerSecond) ||
    bandwidthBitsPerSecond <= 0
  ) {
    return null
  }
  const bits = Math.max(0, payloadBytes + framingBytes) * 8
  return (bits / bandwidthBitsPerSecond) * 1000
}

export function estimateScenario(input: ScenarioInput): ScenarioResult {
  const encryptMs = msFromNs(input.encryptNs)
  const decryptMs = msFromNs(input.decryptNs)

  const transmitMs = transmissionMs(input.payloadBytes, input.framingBytes, input.bandwidthBitsPerSecond)
  const serializationMs =
    input.serializationOverheadMs !== null && Number.isFinite(input.serializationOverheadMs) && input.serializationOverheadMs >= 0
      ? input.serializationOverheadMs
      : null
  const networkMs =
    input.networkOverheadMs !== null && Number.isFinite(input.networkOverheadMs) && input.networkOverheadMs >= 0
      ? input.networkOverheadMs
      : null

  const missing: string[] = []
  if (encryptMs === null) {
    missing.push(
      'No saved measurement of encryption at this payload size and configuration. Run one in the Benchmark Lab, or pick a payload size that has been measured.',
    )
  }

  const rounds = input.mode === 'request-response' ? 2 : 1

  const components: ScenarioComponent[] = [
    {
      id: 'encrypt',
      label: 'Encrypt',
      valueMs: (encryptMs ?? 0) * rounds,
      provenance: 'measured',
      applies: encryptMs !== null,
      note:
        encryptMs === null
          ? 'No measurement available.'
          : rounds === 2
            ? 'Median per-operation latency from the selected run, counted once for the request and once for the reply.'
            : 'Median per-operation latency from the selected run.',
    },
    {
      id: 'serialize',
      label: 'Serialization',
      valueMs: (serializationMs ?? 0) * rounds,
      provenance: 'assumed',
      applies: serializationMs !== null,
      note:
        serializationMs === null
          ? 'Not included: leave the field at zero to exclude it, or enter your own estimate.'
          : 'A value you entered. This tool does not measure serialization cost.',
    },
    {
      id: 'transmit',
      label: 'Transmission',
      valueMs: (transmitMs ?? 0) * rounds,
      provenance: 'estimated',
      applies: transmitMs !== null,
      note:
        transmitMs === null
          ? 'Not included: enter a link rate to model transmission, or leave it out.'
          : `Computed from ${(input.payloadBytes + input.framingBytes).toLocaleString('en-US')} bytes at the rate you entered${rounds === 2 ? ', for both directions' : ''}.`,
    },
    {
      id: 'network',
      label: 'Network delay',
      valueMs: (networkMs ?? 0) * rounds,
      provenance: 'assumed',
      applies: networkMs !== null,
      note:
        networkMs === null
          ? 'Not included: enter a one-way delay to account for it.'
          : 'A value you entered, treated as one-way delay and counted for each direction.',
    },
    {
      id: 'decrypt',
      label: 'Decrypt',
      valueMs: (decryptMs ?? 0) * rounds,
      provenance: 'measured',
      applies: decryptMs !== null,
      note:
        decryptMs === null
          ? 'Not included: the selected run did not measure decryption.'
          : 'Median per-operation latency from the selected run.',
    },
  ]

  const perMessageMs = components.reduce(
    (total, component) => total + (component.applies ? component.valueMs : 0),
    0,
  )
  const totalMs = perMessageMs * Math.max(1, input.messageCount)
  const remainingMs = input.budgetMs - perMessageMs
  const budgetUsedPercent = input.budgetMs > 0 ? (perMessageMs / input.budgetMs) * 100 : 0
  const messagesPerBudget =
    perMessageMs > 0 && input.budgetMs > 0 ? Math.floor(input.budgetMs / perMessageMs) : 0

  const status: ScenarioStatus =
    encryptMs === null ? 'insufficient-data' : remainingMs >= 0 ? 'within-budget' : 'over-budget'

  const notes: string[] = [
    'This is an illustrative estimate, not a network performance model. Congestion, retransmission, scheduling, protocol overhead and the behaviour of the receiving device can all dominate the total.',
    'A browser measurement describes this machine. It does not predict how a low-power microcontroller would perform the same encryption.',
    'The deadline is compared against one message travelling the path once. The aggregate figure for all messages is informational and is not what the status above refers to.',
  ]

  if (input.mode === 'request-response') {
    notes.push(
      'The reply is modelled as the same path again with the same payload size. A shorter or longer reply changes the total.',
    )
  }

  if (serializationMs === null && networkMs === null) {
    notes.push(
      'No serialization or network delay has been entered, so the estimate contains only the parts it can account for. It is a floor, not a typical case.',
    )
  }

  if (encryptMs !== null && perMessageMs > 0) {
    const cipherShare = ((encryptMs * rounds) / perMessageMs) * 100
    if (cipherShare < 5) {
      notes.push(
        `Cipher time is under ${cipherShare.toFixed(1)}% of the estimated total here, so optimising the cipher would barely move it.`,
      )
    }
  }

  return {
    components,
    perMessageMs,
    messageCount: Math.max(1, input.messageCount),
    totalMs,
    budgetMs: input.budgetMs,
    remainingMs,
    budgetUsedPercent,
    messagesPerBudget,
    status,
    missing,
    notes,
    hasMeasuredEncryption: encryptMs !== null,
  }
}

/* ------------------------------------------------------------ scenario presets */

export interface ScenarioPreset {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly values: Pick<
    ScenarioInput,
    'payloadBytes' | 'messageCount' | 'budgetMs' | 'bandwidthBitsPerSecond' | 'networkOverheadMs' | 'serializationOverheadMs' | 'framingBytes' | 'mode'
  >
}

/**
 * Starting points for the form, chosen to span the shapes of problem the module is for. Every value
 * they set is a user-entered assumption, and the interface labels it that way once applied.
 */
export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  {
    id: 'sensor-telemetry',
    label: 'Sensor telemetry',
    description: 'A small reading sent one way over a constrained link with a generous deadline.',
    values: {
      payloadBytes: 64,
      messageCount: 1,
      budgetMs: 20000,
      bandwidthBitsPerSecond: 100_000,
      networkOverheadMs: 50,
      serializationOverheadMs: 0.2,
      framingBytes: 16,
      mode: 'one-way',
    },
  },
  {
    id: 'device-status',
    label: 'Device status reply',
    description: 'A device answers a request, so the payload travels twice with a round trip in between.',
    values: {
      payloadBytes: 256,
      messageCount: 1,
      budgetMs: 2000,
      bandwidthBitsPerSecond: 1_000_000,
      networkOverheadMs: 25,
      serializationOverheadMs: 0.5,
      framingBytes: 24,
      mode: 'request-response',
    },
  },
  {
    id: 'command-message',
    label: 'Command message',
    description: 'A short command on a local link, where the deadline is tight and the payload is trivial.',
    values: {
      payloadBytes: 32,
      messageCount: 1,
      budgetMs: 100,
      bandwidthBitsPerSecond: 10_000_000,
      networkOverheadMs: 2,
      serializationOverheadMs: 0.05,
      framingBytes: 12,
      mode: 'one-way',
    },
  },
]
