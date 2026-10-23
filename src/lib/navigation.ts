export interface NavEntry {
  readonly index: string
  readonly label: string
  readonly path: string
  readonly blurb: string
}

/**
 * Five pages, in the order the work actually happens: understand the parameters, encrypt something,
 * measure that configuration, compare it with the others. The Method page is the footnote.
 */
export const NAV_ENTRIES: readonly NavEntry[] = [
  {
    index: '01',
    label: 'Overview',
    path: '/',
    blurb: 'What this measures, and the three steps that produce a comparison',
  },
  {
    index: '02',
    label: 'Learn RC5',
    path: '/learn',
    blurb: 'Word size, rounds, key length, and one round traced live',
  },
  {
    index: '03',
    label: 'Simulator',
    path: '/simulator',
    blurb: 'Encrypt a message, read it back, and time the configuration',
  },
  {
    index: '04',
    label: 'Compare',
    path: '/compare',
    blurb: 'Encrypt and decrypt times side by side, with the security context',
  },
  {
    index: '05',
    label: 'Method',
    path: '/methodology',
    blurb: 'How the timings are taken, and what they cannot tell you',
  },
]
