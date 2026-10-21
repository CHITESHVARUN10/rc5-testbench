import { cn } from '@/lib/cn'

/**
 * The functional glyph set.
 *
 * Drawn here rather than pulled from an icon library so that every mark on a 16-unit grid with one
 * stroke weight matches the instrument character of the rest of the interface. These are functional
 * marks only: arrows, states, and actions. There is no decorative iconography anywhere in the app,
 * and no glyph is ever used in place of a word.
 */
export type GlyphName =
  | 'check'
  | 'cross'
  | 'dash'
  | 'dot'
  | 'warn'
  | 'info'
  | 'arrow-right'
  | 'chevron-right'
  | 'chevron-down'
  | 'copy'
  | 'download'
  | 'play'
  | 'stop'
  | 'refresh'
  | 'trash'
  | 'search'
  | 'close'
  | 'clock'
  | 'scale'

const STROKE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function paths(name: GlyphName) {
  switch (name) {
    case 'check':
      return <path d="M3 8.5 6.5 12 13 4.5" {...STROKE_PROPS} />
    case 'cross':
      return <path d="M4 4l8 8M12 4l-8 8" {...STROKE_PROPS} />
    case 'dash':
      return <path d="M4 8h8" {...STROKE_PROPS} />
    case 'dot':
      return <circle cx="8" cy="8" r="2.75" fill="currentColor" />
    case 'warn':
      return (
        <>
          <path d="M8 2.5 14.5 13.5h-13L8 2.5Z" {...STROKE_PROPS} />
          <path d="M8 6.5v3.2" {...STROKE_PROPS} />
          <circle cx="8" cy="11.4" r="0.75" fill="currentColor" />
        </>
      )
    case 'info':
      return (
        <>
          <circle cx="8" cy="8" r="6" {...STROKE_PROPS} />
          <path d="M8 7.4v4" {...STROKE_PROPS} />
          <circle cx="8" cy="4.9" r="0.75" fill="currentColor" />
        </>
      )
    case 'arrow-right':
      return <path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" {...STROKE_PROPS} />
    case 'chevron-right':
      return <path d="M6 3.5 10.5 8 6 12.5" {...STROKE_PROPS} />
    case 'chevron-down':
      return <path d="M3.5 6 8 10.5 12.5 6" {...STROKE_PROPS} />
    case 'copy':
      return (
        <>
          <rect x="5.5" y="5.5" width="8" height="8" rx="1" {...STROKE_PROPS} />
          <path d="M10.5 3.5H3.5a1 1 0 0 0-1 1v7" {...STROKE_PROPS} />
        </>
      )
    case 'download':
      return (
        <>
          <path d="M8 2.5v8" {...STROKE_PROPS} />
          <path d="M4.5 7.5 8 11l3.5-3.5" {...STROKE_PROPS} />
          <path d="M3 13h10" {...STROKE_PROPS} />
        </>
      )
    case 'play':
      return <path d="M5 3.5 12.5 8 5 12.5Z" {...STROKE_PROPS} />
    case 'stop':
      return <rect x="4" y="4" width="8" height="8" rx="1" {...STROKE_PROPS} />
    case 'refresh':
      return (
        <>
          <path d="M13 8a5 5 0 1 1-1.6-3.7" {...STROKE_PROPS} />
          <path d="M13 2.5V5h-2.5" {...STROKE_PROPS} />
        </>
      )
    case 'trash':
      return (
        <>
          <path d="M3 4.5h10M6.5 4.5V3h3v1.5" {...STROKE_PROPS} />
          <path d="M4.5 4.5 5.2 13h5.6l.7-8.5" {...STROKE_PROPS} />
        </>
      )
    case 'search':
      return (
        <>
          <circle cx="7" cy="7" r="4" {...STROKE_PROPS} />
          <path d="M10 10l3.5 3.5" {...STROKE_PROPS} />
        </>
      )
    case 'close':
      return <path d="M4 4l8 8M12 4l-8 8" {...STROKE_PROPS} />
    case 'clock':
      return (
        <>
          <circle cx="8" cy="8" r="6" {...STROKE_PROPS} />
          <path d="M8 4.5V8l2.5 1.5" {...STROKE_PROPS} />
        </>
      )
    case 'scale':
      return (
        <>
          <path d="M2.5 12h11" {...STROKE_PROPS} />
          <path d="M4 12V8M7 12V5M10 12V9.5M13 12V6" {...STROKE_PROPS} />
        </>
      )
  }
}

export interface GlyphProps {
  readonly name: GlyphName
  readonly size?: number
  readonly className?: string
}

export function Glyph({ name, size = 16, className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      {paths(name)}
    </svg>
  )
}
