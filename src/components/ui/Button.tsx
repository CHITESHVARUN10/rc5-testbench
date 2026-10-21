import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { Glyph, type GlyphName } from './Glyph'

/**
 * Controls.
 *
 * One radius, no shadows in any state, and the oxide signal reserved for the primary action. Hover
 * changes light and nothing else: no lifts, no glows. Hit areas are at least 44px tall on touch
 * screens and 36px on pointer devices, which is why the size classes are written mobile-first.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-signal-ink text-sheet hover:bg-signal-deep',
  secondary: 'border border-rule-2 bg-sheet text-ink hover:border-rule-3 hover:bg-well',
  ghost: 'text-ink-2 hover:bg-well hover:text-ink',
  danger: 'border border-rule-2 bg-sheet text-err hover:border-err hover:bg-err-wash',
}

function buttonClass(
  variant: ButtonVariant,
  compact: boolean,
  fullWidth: boolean,
  className?: string,
): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-hair font-mono text-label uppercase',
    'transition-colors duration-150 ease-instrument',
    'disabled:opacity-45',
    compact ? 'min-h-9 px-2.5' : 'min-h-11 px-3.5 sm:min-h-9',
    fullWidth && 'w-full',
    VARIANTS[variant],
    className,
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
  readonly glyph?: GlyphName
  readonly glyphAfter?: GlyphName
  readonly compact?: boolean
  readonly fullWidth?: boolean
}

export function Button({
  variant = 'secondary',
  glyph,
  glyphAfter,
  compact = false,
  fullWidth = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, compact, fullWidth, className)} {...rest}>
      {glyph ? <Glyph name={glyph} size={14} /> : null}
      {children}
      {glyphAfter ? <Glyph name={glyphAfter} size={14} /> : null}
    </button>
  )
}

export interface ButtonLinkProps extends LinkProps {
  readonly variant?: ButtonVariant
  readonly glyph?: GlyphName
  readonly glyphAfter?: GlyphName
  readonly compact?: boolean
  readonly fullWidth?: boolean
  readonly children: ReactNode
}

/** Navigation styled as a control. A link stays a link, so middle-click and open-in-new-tab work. */
export function ButtonLink({
  variant = 'secondary',
  glyph,
  glyphAfter,
  compact = false,
  fullWidth = false,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, compact, fullWidth, className)} {...rest}>
      {glyph ? <Glyph name={glyph} size={14} /> : null}
      {children}
      {glyphAfter ? <Glyph name={glyphAfter} size={14} /> : null}
    </Link>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly glyph: GlyphName
  /** Required: an icon on its own has no accessible name, so one has to be supplied. */
  readonly label: string
  readonly tone?: 'default' | 'danger'
}

export function IconButton({ glyph, label, tone = 'default', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-hair transition-colors duration-150 ease-instrument sm:h-9 sm:w-9',
        'disabled:opacity-45',
        tone === 'danger' ? 'text-ink-3 hover:bg-err-wash hover:text-err' : 'text-ink-3 hover:bg-well hover:text-ink',
        className,
      )}
      {...rest}
    >
      <Glyph name={glyph} size={16} />
    </button>
  )
}

/** A row of related actions with consistent spacing. */
export function ButtonRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

/** A text action that sits inside dense rows, still meeting the minimum height on touch. */
export function LinkButton({ className, children, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center font-mono text-label uppercase text-signal-ink underline decoration-rule-2 underline-offset-4',
        'transition-colors duration-150 ease-instrument hover:decoration-signal-ink disabled:opacity-45 sm:min-h-0',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
