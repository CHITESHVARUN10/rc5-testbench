import { describe, expect, it } from 'vitest'

import { estimateScenario, transmissionMs, type ScenarioInput } from './estimate'

const BASE: ScenarioInput = {
  name: 'Test scenario',
  payloadBytes: 100,
  messageCount: 1,
  budgetMs: 20_000,
  bandwidthBitsPerSecond: 100_000,
  networkOverheadMs: null,
  serializationOverheadMs: null,
  framingBytes: 0,
  mode: 'one-way',
  encryptNs: 100_000, // 0.1 ms
  decryptNs: 100_000, // 0.1 ms
  sourceLabel: 'RC5-32/12/16 at 100 bytes',
}

function withInput(overrides: Partial<ScenarioInput>): ScenarioInput {
  return { ...BASE, ...overrides }
}

describe('transmission time', () => {
  it('converts bits and bits per second into milliseconds', () => {
    expect(transmissionMs(100, 0, 100_000)).toBeCloseTo(8, 10)
    expect(transmissionMs(1024, 0, 1_000_000)).toBeCloseTo(8.192, 10)
    expect(transmissionMs(0, 0, 1_000_000)).toBe(0)
  })

  it('includes framing bytes in the payload', () => {
    expect(transmissionMs(100, 28, 100_000)).toBeCloseTo(10.24, 10)
  })

  it('refuses to invent a transmission time without a usable rate', () => {
    expect(transmissionMs(100, 0, null)).toBeNull()
    expect(transmissionMs(100, 0, 0)).toBeNull()
    expect(transmissionMs(100, 0, -1000)).toBeNull()
    expect(transmissionMs(100, 0, Number.NaN)).toBeNull()
  })
})

describe('scenario estimation', () => {
  it('adds only the components that apply, and labels each one', () => {
    const result = estimateScenario(BASE)
    expect(result.status).toBe('within-budget')
    expect(result.perMessageMs).toBeCloseTo(8.2, 10) // 0.1 encrypt + 8 transmit + 0.1 decrypt

    const encrypt = result.components.find((component) => component.id === 'encrypt')
    const transmit = result.components.find((component) => component.id === 'transmit')
    const decrypt = result.components.find((component) => component.id === 'decrypt')
    const network = result.components.find((component) => component.id === 'network')

    expect(encrypt?.provenance).toBe('measured')
    expect(decrypt?.provenance).toBe('measured')
    expect(transmit?.provenance).toBe('estimated')
    expect(network?.provenance).toBe('assumed')
    expect(network?.applies).toBe(false)
  })

  it('computes the remaining budget and the share of it used', () => {
    const result = estimateScenario(withInput({ budgetMs: 100 }))
    expect(result.remainingMs).toBeCloseTo(91.8, 10)
    expect(result.budgetUsedPercent).toBeCloseTo(8.2, 10)
    expect(result.messagesPerBudget).toBe(12)
  })

  it('reports over budget without hiding the overshoot', () => {
    const result = estimateScenario(withInput({ budgetMs: 5 }))
    expect(result.status).toBe('over-budget')
    expect(result.remainingMs).toBeCloseTo(-3.2, 10)
  })

  it('treats a per-message time equal to the deadline as within budget', () => {
    const result = estimateScenario(withInput({ budgetMs: 8.2, networkOverheadMs: null }))
    expect(result.perMessageMs).toBeCloseTo(8.2, 10)
    expect(result.status).toBe('within-budget')
    expect(result.remainingMs).toBeCloseTo(0, 6)
  })

  it('doubles the path for a request and a reply', () => {
    const oneWay = estimateScenario(BASE)
    const roundTrip = estimateScenario(withInput({ mode: 'request-response' }))
    expect(roundTrip.perMessageMs).toBeCloseTo(oneWay.perMessageMs * 2, 10)
    expect(roundTrip.notes.join(' ')).toContain('reply is modelled as the same path again')
  })

  it('scales the aggregate by the number of messages but compares the deadline per message', () => {
    const result = estimateScenario(withInput({ messageCount: 10, budgetMs: 20 }))
    expect(result.perMessageMs).toBeCloseTo(8.2, 10)
    expect(result.totalMs).toBeCloseTo(82, 10)
    expect(result.status).toBe('within-budget')
    expect(result.messageCount).toBe(10)
  })

  it('reports insufficient data instead of substituting a number', () => {
    const result = estimateScenario(withInput({ encryptNs: null }))
    expect(result.status).toBe('insufficient-data')
    expect(result.missing.length).toBeGreaterThan(0)
    expect(result.missing[0]).toContain('Benchmark Lab')
    expect(result.hasMeasuredEncryption).toBe(false)
  })

  it('still estimates when only encryption was measured', () => {
    const result = estimateScenario(withInput({ decryptNs: null }))
    expect(result.status).toBe('within-budget')
    expect(result.perMessageMs).toBeCloseTo(8.1, 10)
    const decrypt = result.components.find((component) => component.id === 'decrypt')
    expect(decrypt?.applies).toBe(false)
  })

  it('leaves transmission out when no rate is given, and says so', () => {
    const result = estimateScenario(withInput({ bandwidthBitsPerSecond: null, budgetMs: 1 }))
    expect(result.perMessageMs).toBeCloseTo(0.2, 10)
    expect(result.status).toBe('within-budget')
    expect(result.notes.join(' ')).toContain('floor, not a typical case')
    const transmit = result.components.find((component) => component.id === 'transmit')
    expect(transmit?.applies).toBe(false)
  })

  it('always carries the caution notes about what the model cannot do', () => {
    const result = estimateScenario(BASE)
    const notes = result.notes.join(' ')
    expect(notes).toContain('not a network performance model')
    expect(notes).toContain('microcontroller')
    expect(notes).toContain('one message travelling the path once')
  })

  it('points out when cipher time is a negligible share of the total', () => {
    const result = estimateScenario(withInput({ budgetMs: 1000 }))
    expect(result.notes.join(' ')).toContain('Cipher time is under')
  })

  it('does not divide by a zero budget', () => {
    const result = estimateScenario(withInput({ budgetMs: 0 }))
    expect(result.budgetUsedPercent).toBe(0)
    expect(result.messagesPerBudget).toBe(0)
    expect(result.status).toBe('over-budget')
  })

  it('ignores negative and non-finite assumptions rather than propagating them', () => {
    const result = estimateScenario(
      withInput({ networkOverheadMs: -5, serializationOverheadMs: Number.NaN }),
    )
    const network = result.components.find((component) => component.id === 'network')
    const serialize = result.components.find((component) => component.id === 'serialize')
    expect(network?.applies).toBe(false)
    expect(serialize?.applies).toBe(false)
    expect(Number.isFinite(result.perMessageMs)).toBe(true)
  })
})
