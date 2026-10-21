export interface NavEntry {
  readonly index: string
  /** Short label for the rail. */
  readonly label: string
  /** Full title for the page header. */
  readonly title: string
  readonly path: string
  readonly blurb: string
}

/**
 * The eight surfaces of the tool, in the order a question is usually asked: what is this, how does the
 * cipher work, what does it do to my message, how fast is it here, which configuration wins, would it
 * fit my budget, what have I measured so far, and how were those numbers produced.
 */
export const NAV_ENTRIES: readonly NavEntry[] = [
  {
    index: '01',
    label: 'Overview',
    title: 'Overview',
    path: '/',
    blurb: 'What this tool measures, what it refuses to claim, and where to start',
  },
  {
    index: '02',
    label: 'Learn RC5',
    title: 'Learn RC5',
    path: '/learn',
    blurb: 'The algorithm, its notation, its operations, and its documented limitations',
  },
  {
    index: '03',
    label: 'Simulator',
    title: 'Simulator',
    path: '/simulator',
    blurb: 'Configure RC5, encrypt a message, and verify the result by decrypting it again',
  },
  {
    index: '04',
    label: 'Benchmark',
    title: 'Benchmark Lab',
    path: '/benchmark',
    blurb: 'Measure this machine on a workload you choose, with the method stated up front',
  },
  {
    index: '05',
    label: 'Compare',
    title: 'Compare configurations',
    path: '/compare',
    blurb: 'Put measured configurations side by side, and see when a difference is real',
  },
  {
    index: '06',
    label: 'Scenario',
    title: 'Scenario Planner',
    path: '/scenario',
    blurb: 'Fit measured cipher time into a timing budget you define, with every assumption labelled',
  },
  {
    index: '07',
    label: 'Experiments',
    title: 'Experiments and reports',
    path: '/reports',
    blurb: 'Saved runs, their full method records, and exports you can hand in',
  },
  {
    index: '08',
    label: 'Methodology',
    title: 'Methodology and about',
    path: '/methodology',
    blurb: 'How each number is produced, what it can support, and what it cannot',
  },
]

export function navEntryForPath(path: string): NavEntry | undefined {
  const exact = NAV_ENTRIES.find((entry) => entry.path === path)
  if (exact) return exact
  return NAV_ENTRIES.find((entry) => entry.path !== '/' && path.startsWith(entry.path))
}
