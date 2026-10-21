import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { useSettings } from '@/state/settings.store'
import { MobileBar, SideRail, SiteFooter } from './SideRail'

/**
 * The application frame.
 *
 * Above 1024px the rail holds a fixed column beside the content. Below it, the rail is replaced by a
 * top bar with a horizontally scrollable section list: the layout recomposes rather than shrinking the
 * same structure into an unusable size. Route changes reset the scroll position, because arriving
 * halfway down a page you have never seen is disorienting.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const motion = useSettings((state) => state.motion)
  const { pathname } = useLocation()

  useEffect(() => {
    document.documentElement.dataset.motion = motion
  }, [motion])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-hair focus:border focus:border-rule-2 focus:bg-sheet focus:px-3 focus:py-2 focus:font-mono focus:text-label focus:uppercase"
      >
        Skip to content
      </a>
      <SideRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar />
        <main id="main" className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">{children}</div>
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}
