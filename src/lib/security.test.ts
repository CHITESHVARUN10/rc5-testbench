import { describe, expect, it } from 'vitest'

import { TIMING_CAVEAT, keySearchEstimate, scientific, securityNote } from './security'

/**
 * The one security figure the tool produces is arithmetic on the key length. These tests pin the
 * arithmetic and the wording, because a number about key search is exactly the kind that gets
 * over-read.
 */

describe('exhaustive key search', () => {
  it('states the key space as a power of two for a 128-bit key', () => {
    const estimate = keySearchEstimate(16)
    expect(estimate.keyBits).toBe(128)
    expect(estimate.keySpaceLabel).toBe('3.4 × 10^38 keys')
    expect(estimate.searchLabel).toBe('5.4 × 10^21 years')
    expect(estimate.universeLabel).toBe('about 3.9 × 10^11 times the age of the universe')
  })

  it('keeps a 64-bit key in years and offers no universe comparison', () => {
    const estimate = keySearchEstimate(8)
    expect(estimate.keyBits).toBe(64)
    expect(estimate.keySpaceLabel).toBe('1.8 × 10^19 keys')
    expect(estimate.searchLabel).toBe('292 years')
    expect(estimate.universeLabel).toBeNull()
  })

  it('writes a short key out in full and resolves to seconds', () => {
    const estimate = keySearchEstimate(4)
    expect(estimate.keyBits).toBe(32)
    expect(estimate.keySpaceLabel).toBe('4,294,967,296 keys')
    expect(estimate.searchLabel).toBe('2 seconds')
  })

  it('scales the search with the assumed guess rate', () => {
    const fast = keySearchEstimate(8, 1e12)
    const slow = keySearchEstimate(8, 1e6)
    expect(fast.searchLabel).not.toBe(slow.searchLabel)
    expect(fast.note).toContain('1 × 10^12')
  })

  it('says in the note that it is arithmetic, not a measurement', () => {
    const estimate = keySearchEstimate(16)
    expect(estimate.note).toContain('not a measurement')
    expect(estimate.note).toContain('does not cover attacks that avoid searching the key space')
  })
})

describe('scientific formatting', () => {
  it('leaves small numbers alone and normalises the mantissa', () => {
    expect(scientific(999)).toBe('999')
    expect(scientific(1000)).toBe('1 × 10^3')
    expect(scientific(1.38e10)).toBe('1.4 × 10^10')
    expect(scientific(9.99e5)).toBe('1 × 10^6')
    expect(scientific(0)).toBe('—')
  })
})

describe('configuration notes', () => {
  it('treats the RFC 2040 configuration as the reference and lower round counts as caution', () => {
    expect(securityNote({ w: 32, r: 12, b: 16 }).level).toBe('reference')
    expect(securityNote({ w: 32, r: 20, b: 16 }).level).toBe('reference')
    expect(securityNote({ w: 32, r: 8, b: 16 }).level).toBe('caution')
    expect(securityNote({ w: 32, r: 10, b: 16 }).level).toBe('caution')
  })

  it('mentions the key when it is shorter than 64 bits', () => {
    const note = securityNote({ w: 32, r: 12, b: 4 })
    expect(note.detail).toContain('32 bits')
    expect(note.detail).toContain('searching the key space')
  })

  it('always carries a hedge rather than a verdict', () => {
    for (const rounds of [8, 10, 12, 16, 20]) {
      const note = securityNote({ w: 32, r: rounds, b: 16 })
      expect(note.detail).toMatch(
        /not a (certification|safety margin)|not the documented configuration/,
      )
    }
    expect(TIMING_CAVEAT).toContain('faster configuration is not a stronger one')
  })
})
