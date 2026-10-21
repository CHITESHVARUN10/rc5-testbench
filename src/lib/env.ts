/**
 * Environment metadata.
 *
 * Everything here is reported by the browser, and browsers deliberately limit and sometimes freeze
 * parts of it: on macOS the user agent has reported `Mac OS X 10_15_7` regardless of the real
 * version for years, and no browser exposes the CPU model. The interface presents these values as
 * "reported by the browser" for that reason, and the Methodology page says so outright.
 */

export interface EnvironmentInfo {
  readonly runtime: 'browser'
  readonly browserLabel: string
  readonly osLabel: string
  readonly userAgent: string
  readonly language: string
  readonly logicalCores: number | null
  readonly deviceMemoryGb: number | null
  readonly crossOriginIsolated: boolean
  readonly devicePixelRatio: number | null
  readonly timestamp: string
}

interface UserAgentDataLike {
  readonly platform?: string
  readonly brands?: ReadonlyArray<{ readonly brand: string; readonly version: string }>
}

/** Best-effort browser label. Order matters: Edge and Opera both claim to be Chrome. */
export function describeBrowser(userAgent: string): string {
  const match = (pattern: RegExp): string | null => {
    const result = pattern.exec(userAgent)
    return result ? result[1] : null
  }

  const edge = match(/Edg(?:e|A|iOS)?\/([\d.]+)/)
  if (edge) return `Edge ${majorOf(edge)}`

  const opera = match(/OPR\/([\d.]+)/) ?? match(/Opera\/([\d.]+)/)
  if (opera) return `Opera ${majorOf(opera)}`

  const samsung = match(/SamsungBrowser\/([\d.]+)/)
  if (samsung) return `Samsung Internet ${majorOf(samsung)}`

  const firefox = match(/Firefox\/([\d.]+)/) ?? match(/FxiOS\/([\d.]+)/)
  if (firefox) return `Firefox ${majorOf(firefox)}`

  const chrome = match(/Chrome\/([\d.]+)/) ?? match(/CriOS\/([\d.]+)/)
  if (chrome) return `Chromium-based ${majorOf(chrome)}`

  const safari = match(/Version\/([\d.]+).*Safari/)
  if (safari) return `Safari ${majorOf(safari)}`

  return 'Unrecognised browser'
}

function majorOf(version: string): string {
  return version.split('.')[0] ?? version
}

/** Best-effort operating system label. `platformHint` comes from userAgentData when available. */
export function describeOs(userAgent: string, platformHint: string | null): string {
  if (platformHint) {
    if (/android/i.test(platformHint)) return 'Android'
    if (/ios|iphone|ipad/i.test(platformHint)) return 'iOS or iPadOS'
    if (/mac/i.test(platformHint)) return 'macOS'
    if (/win/i.test(platformHint)) return 'Windows'
    if (/chrome ?os|cros/i.test(platformHint)) return 'ChromeOS'
    if (/linux/i.test(platformHint)) return 'Linux'
  }

  if (/Android/.test(userAgent)) {
    const version = /Android ([\d.]+)/.exec(userAgent)?.[1]
    return version ? `Android ${version}` : 'Android'
  }
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS or iPadOS'
  if (/CrOS/.test(userAgent)) return 'ChromeOS'
  // The reported macOS version is not the real one on recent systems, so it is deliberately omitted.
  if (/Mac OS X|Macintosh/.test(userAgent)) return 'macOS'
  if (/Windows NT 10\.0/.test(userAgent)) return 'Windows 10 or 11'
  if (/Windows NT 6\.3/.test(userAgent)) return 'Windows 8.1'
  if (/Windows/.test(userAgent)) return 'Windows'
  if (/Linux/.test(userAgent)) return 'Linux'
  return 'Unrecognised system'
}

function readUserAgentData(): UserAgentDataLike | null {
  const candidate = (navigator as Navigator & { userAgentData?: UserAgentDataLike }).userAgentData
  return candidate ?? null
}

export function collectEnvironment(timestamp = new Date().toISOString()): EnvironmentInfo {
  const hasNavigator = typeof navigator !== 'undefined'
  const userAgent = hasNavigator ? navigator.userAgent : ''
  const agentData = hasNavigator ? readUserAgentData() : null
  const memory = hasNavigator
    ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    : undefined

  return {
    runtime: 'browser',
    browserLabel: hasNavigator ? describeBrowser(userAgent) : 'Unknown',
    osLabel: hasNavigator ? describeOs(userAgent, agentData?.platform ?? null) : 'Unknown',
    userAgent,
    language: hasNavigator ? navigator.language : 'unknown',
    logicalCores:
      hasNavigator && typeof navigator.hardwareConcurrency === 'number'
        ? navigator.hardwareConcurrency
        : null,
    deviceMemoryGb: typeof memory === 'number' ? memory : null,
    crossOriginIsolated:
      typeof globalThis.crossOriginIsolated === 'boolean' ? globalThis.crossOriginIsolated : false,
    devicePixelRatio: typeof globalThis.devicePixelRatio === 'number' ? globalThis.devicePixelRatio : null,
    timestamp,
  }
}

/**
 * The smallest non-zero difference the timer can report, in milliseconds.
 *
 * Browsers coarsen `performance.now()` as a side-channel mitigation, which is why a single 8-byte
 * block operation appears to take exactly 0 ms. The runner works around this by timing batches and
 * dividing; this probe reports the resolution so the workaround is visible rather than implicit.
 */
export function measureTimerResolutionMs(budgetMs = 20): number {
  if (typeof performance === 'undefined') return 0
  let best = Number.POSITIVE_INFINITY
  let previous = performance.now()
  const deadline = previous + budgetMs

  while (true) {
    const current = performance.now()
    const delta = current - previous
    if (delta > 0) {
      if (delta < best) best = delta
      if (best <= 0.001) break
    }
    previous = current
    if (current > deadline) break
  }

  return Number.isFinite(best) ? best : 0
}

let cachedResolution = -1

/**
 * The timer resolution, measured once per session.
 *
 * The probe costs a few milliseconds, so it is cached rather than re-run. It is used to decide
 * whether a single measured operation is even resolvable: an operation shorter than one timer step
 * must be reported as below the resolution rather than as zero.
 */
export function getTimerResolutionMs(): number {
  if (cachedResolution < 0) {
    cachedResolution = measureTimerResolutionMs()
  }
  return cachedResolution
}
