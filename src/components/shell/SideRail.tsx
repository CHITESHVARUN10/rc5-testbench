import { NavLink } from 'react-router-dom'

import { ENGINE_VERSION, METHODOLOGY_VERSION } from '@/lib/versions'
import { NAV_ENTRIES } from '@/lib/navigation'
import { cn } from '@/lib/cn'
import { Glyph } from '../ui/Glyph'
import { MotionControl } from './MotionControl'
import { useBenchmarkStatus } from '@/state/benchmark.store'

/**
 * The rail.
 *
 * Navigation is a numbered list, like the sections of a technical document, because the tool is
 * organised as a sequence of questions rather than as a set of destinations. The footer carries the
 * versions and the live worker state: what produced a number is part of the number.
 */

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" className="shrink-0">
        <g stroke="var(--color-ink-3)" strokeWidth="2" strokeLinecap="square">
          <path d="M5 25V16" />
          <path d="M10 25V11" />
          <path d="M15 25V19" />
          <path d="M25 25V14" />
        </g>
        <path d="M20 25V4" stroke="var(--color-signal)" strokeWidth="2.5" strokeLinecap="square" />
      </svg>
      <span className="flex flex-col">
        <span className="font-mono text-sm font-medium tracking-[0.14em] text-ink uppercase">
          RC5 CipherLab
        </span>
        {compact ? null : (
          <span className="font-mono text-label uppercase text-ink-4">analysis &amp; benchmark</span>
        )}
      </span>
    </span>
  )
}

function navItemClass(isActive: boolean): string {
  return cn(
    'flex min-h-11 items-center gap-3 rounded-hair px-2.5 py-2 lg:min-h-9',
    'transition-colors duration-150 ease-instrument',
    isActive ? 'bg-sheet text-ink' : 'text-ink-2 hover:bg-well hover:text-ink',
  )
}

export function SideRail() {
  const workerStatus = useBenchmarkStatus()

  return (
    <aside
      data-print-hide
      className="hidden border-r border-rule lg:flex lg:w-[258px] lg:shrink-0 lg:flex-col lg:justify-between"
      aria-label="Sections"
    >
      <div className="space-y-6 p-5">
        <NavLink to="/" className="block rounded-hair" aria-label="RC5 CipherLab, overview">
          <Wordmark />
        </NavLink>

        <nav className="space-y-0.5">
          <ul className="space-y-0.5">
            {NAV_ENTRIES.map((entry) => (
              <li key={entry.path}>
                <NavLink
                  to={entry.path}
                  end={entry.path === '/'}
                  className={({ isActive }) => navItemClass(isActive)}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'font-mono text-label tabular-nums',
                          isActive ? 'text-signal-ink' : 'text-ink-4',
                        )}
                      >
                        {entry.index}
                      </span>
                      <span className={cn('text-sm', isActive && 'font-medium')}>{entry.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="space-y-3 border-t border-rule p-5">
        <dl className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-mono text-label uppercase text-ink-4">Engine</dt>
            <dd className="font-mono text-label tabular-nums text-ink-3">{ENGINE_VERSION}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-mono text-label uppercase text-ink-4">Method</dt>
            <dd className="font-mono text-label tabular-nums text-ink-3">{METHODOLOGY_VERSION}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-mono text-label uppercase text-ink-4">Worker</dt>
            <dd className="font-mono text-label uppercase text-ink-3">{workerStatus}</dd>
          </div>
        </dl>
        <MotionControl />
      </div>
    </aside>
  )
}

export function MobileBar() {
  return (
    <div data-print-hide className="sticky top-0 z-20 border-b border-rule bg-paper lg:hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <NavLink to="/" className="min-w-0" aria-label="RC5 CipherLab, overview">
          <Wordmark compact />
        </NavLink>
      </div>
      <nav aria-label="Sections" className="-mt-px border-t border-rule">
        <ul className="flex gap-0 overflow-x-auto">
          {NAV_ENTRIES.map((entry) => (
            <li key={entry.path} className="shrink-0">
              <NavLink
                to={entry.path}
                end={entry.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-2 px-3 py-2 whitespace-nowrap',
                    'font-mono text-label uppercase',
                    isActive ? 'text-ink' : 'text-ink-3',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('tabular-nums', isActive ? 'text-signal-ink' : 'text-ink-4')}>
                      {entry.index}
                    </span>
                    {entry.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-rule px-4 py-6 sm:px-6 lg:px-10" data-print-hide>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[68ch] space-y-1.5">
          <p className="font-mono text-label uppercase text-ink-3">
            Measurement and learning tool, not a security-certification tool
          </p>
          <p className="text-sm text-ink-3">
            RC5 is a legacy cipher. Nothing on this site establishes that a configuration is safe for
            protecting real data, and a fast measurement is not a security result.
          </p>
        </div>
        <NavLink
          to="/methodology"
          className="inline-flex min-h-11 items-center gap-2 font-mono text-label uppercase text-signal-ink sm:min-h-0"
        >
          Read the methodology
          <Glyph name="arrow-right" size={14} />
        </NavLink>
      </div>
    </footer>
  )
}
