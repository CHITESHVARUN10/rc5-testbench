import { describe, expect, it } from 'vitest'

import { summariseComparison } from './comparison'
import type { Measurement } from './measurement'
import type { Rc5Config } from './rc5/types'

function measurement(config: Rc5Config, encryptNs: number): Measurement {
  return {
    id: `${config.w}-${config.r}-${config.b}-${encryptNs}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    config,
    payloadBytes: 15,
    payloadBlocks: 2,
    encryptNs,
    encryptP95Ns: encryptNs * 1.1,
    decryptNs: encryptNs / 2,
    decryptP95Ns: encryptNs * 0.6,
    spreadPercent: 6,
    keySetupNs: 1200,
    throughputBytesPerSecond: 1e6,
    samples: 150,
    timerResolutionMs: 0.1,
    correctness: 'verified',
    engineVersion: '1.0.0',
    browser: 'Chromium',
    os: 'macOS',
  }
}

const fast8 = measurement({ w: 32, r: 8, b: 16 }, 100)
const ref12 = measurement({ w: 32, r: 12, b: 16 }, 200)
const heavy20 = measurement({ w: 32, r: 20, b: 16 }, 400)
const shortKey = measurement({ w: 32, r: 12, b: 4 }, 150)

describe('comparison summary', () => {
  it('picks the lowest measured encryption time as fastest', () => {
    const summary = summariseComparison([ref12, fast8, heavy20])
    expect(summary.fastest?.config.r).toBe(8)
  })

  it('picks the fastest configuration that stays at the reference settings', () => {
    const summary = summariseComparison([fast8, ref12, heavy20])
    expect(summary.balanced?.config.r).toBe(12)
    expect(summary.balanced?.config.b).toBe(16)
  })

  it('does not treat a short key as balanced even at the reference round count', () => {
    const summary = summariseComparison([fast8, shortKey])
    expect(summary.balanced).toBeNull()
    expect(summary.notes.join(' ')).toContain('reference settings')
  })

  it('names the most rounds, then the longest key, then the fastest', () => {
    expect(summariseComparison([ref12, heavy20, fast8]).strongest?.config.r).toBe(20)

    const sameRounds = [
      measurement({ w: 32, r: 20, b: 8 }, 300),
      measurement({ w: 32, r: 20, b: 24 }, 500),
    ]
    expect(summariseComparison(sameRounds).strongest?.config.b).toBe(24)

    const identical = [
      measurement({ w: 32, r: 20, b: 16 }, 500),
      measurement({ w: 32, r: 20, b: 16 }, 300),
    ]
    expect(summariseComparison(identical).strongest?.encryptNs).toBe(300)
  })

  it('says when the fastest pick is below the reference round count', () => {
    const summary = summariseComparison([fast8, ref12])
    expect(summary.notes.join(' ')).toMatch(/below the 12/)
  })

  it('says when one configuration holds both fastest and balanced', () => {
    const summary = summariseComparison([ref12, heavy20])
    expect(summary.fastest?.id).toBe(summary.balanced?.id)
    expect(summary.notes.join(' ')).toContain('holds both places')
  })

  it('returns nothing for an empty table', () => {
    const summary = summariseComparison([])
    expect(summary.fastest).toBeNull()
    expect(summary.balanced).toBeNull()
    expect(summary.strongest).toBeNull()
    expect(summary.notes).toHaveLength(0)
  })
})

describe('message sizes', () => {
  it('takes the picks from the largest group measured at one size', () => {
    const small = [
      measurement({ w: 32, r: 8, b: 16 }, 40),
      measurement({ w: 32, r: 12, b: 16 }, 60),
      measurement({ w: 32, r: 16, b: 16 }, 80),
    ].map((row) => ({ ...row, payloadBytes: 8 }))
    const large = { ...measurement({ w: 32, r: 20, b: 16 }, 500), payloadBytes: 4096 }

    const summary = summariseComparison([...small, large])
    expect(summary.mixedPayload).toBe(true)
    expect(summary.payloadBytes).toBe(8)
    expect(summary.comparedCount).toBe(3)
    expect(summary.fastest?.config.r).toBe(8)
    expect(summary.strongest?.config.r).toBe(16)
  })

  it('breaks a tie towards the smaller payload', () => {
    const a = { ...measurement({ w: 32, r: 12, b: 16 }, 100), payloadBytes: 64 }
    const b = { ...measurement({ w: 32, r: 12, b: 16 }, 90), payloadBytes: 8 }
    const summary = summariseComparison([a, b])
    expect(summary.payloadBytes).toBe(8)
    expect(summary.comparedCount).toBe(1)
  })

  it('reports a single size as comparable', () => {
    const summary = summariseComparison([ref12, heavy20])
    expect(summary.mixedPayload).toBe(false)
    expect(summary.comparedCount).toBe(2)
    expect(summary.payloadBytes).toBe(15)
  })
})
