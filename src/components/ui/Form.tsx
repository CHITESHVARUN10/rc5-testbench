import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/lib/cn'
import { Hint, Label } from './Text'

/**
 * Form controls.
 *
 * Labels are always visible — a placeholder is a format hint, never a label — and every control is a
 * native element so keyboard behaviour, autofill and screen-reader announcements come from the
 * platform. Validation messages are tied to their control with aria-describedby and announced when
 * they appear, and no submit control is disabled merely because the form is not yet valid: a disabled
 * button hides the thing that needs fixing.
 */

const CONTROL_BASE = [
  'w-full rounded-hair border border-rule-2 bg-sheet px-3 py-2 text-ink',
  'transition-colors duration-150 ease-instrument',
  'placeholder:text-ink-4 disabled:bg-well disabled:text-ink-4',
  'aria-invalid:border-err',
  'min-h-11 sm:min-h-9',
].join(' ')

const MONO_INPUT = 'font-mono text-sm tabular-nums'

export interface FieldProps {
  readonly label: ReactNode
  readonly hint?: ReactNode
  readonly error?: string | null
  readonly accessory?: ReactNode
  readonly required?: boolean
  readonly className?: string
  readonly children: ReactElement<{
    id?: string
    'aria-describedby'?: string
    'aria-invalid'?: boolean
  }>
}

export function Field({ label, hint, error, accessory, required, className, children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="flex items-baseline gap-2">
          <Label>{label}</Label>
          {required ? (
            <span className="font-mono text-label uppercase text-ink-4" aria-hidden="true">
              required
            </span>
          ) : null}
        </label>
        {accessory}
      </div>
      {control}
      {hint ? <Hint id={hintId}>{hint}</Hint> : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-err">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TextInput({
  className,
  mono = false,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className={cn(CONTROL_BASE, mono && MONO_INPUT, className)} {...rest} />
}

export function TextArea({
  className,
  mono = false,
  rows = 6,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) {
  return (
    <textarea
      rows={rows}
      className={cn(CONTROL_BASE, 'resize-y leading-relaxed', mono && MONO_INPUT, className)}
      {...rest}
    />
  )
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={cn(CONTROL_BASE, 'cursor-pointer pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

export interface SegmentedOption<T extends string | number> {
  readonly value: T
  readonly label: string
  readonly hint?: string
  readonly disabled?: boolean
}

export interface SegmentedProps<T extends string | number> {
  readonly legend: ReactNode
  readonly value: T
  readonly options: readonly SegmentedOption<T>[]
  readonly onChange: (value: T) => void
  readonly hint?: ReactNode
  readonly name?: string
  readonly className?: string
}

/**
 * A radio group, not a button group: native radios bring arrow-key navigation, a shared tab stop, and
 * an announced group label for free. Selection is carried by a filled ink cell, so it reads in
 * grayscale and to a colorblind user.
 */
export function Segmented<T extends string | number>({
  legend,
  value,
  options,
  onChange,
  hint,
  name,
  className,
}: SegmentedProps<T>) {
  const generatedName = useId()
  const groupName = name ?? generatedName
  const hintId = `${generatedName}-hint`

  return (
    <fieldset className={cn('min-w-0 space-y-2', className)} aria-describedby={hint ? hintId : undefined}>
      <legend className="mb-2">
        <Label>{legend}</Label>
      </legend>
      <div className="grid auto-cols-fr grid-flow-col rounded-hair border border-rule-2 bg-sheet">
        {options.map((option, index) => {
          const selected = option.value === value
          const optionId = `${generatedName}-${String(option.value)}`
          return (
            <div
              key={String(option.value)}
              className={cn('min-w-0', index > 0 && 'border-l border-rule-2')}
            >
              <input
                type="radio"
                id={optionId}
                name={groupName}
                value={String(option.value)}
                checked={selected}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={optionId}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-center px-3 py-2 text-center font-mono text-label uppercase',
                  'transition-colors duration-150 ease-instrument',
                  selected ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-well',
                  option.disabled && 'cursor-not-allowed opacity-45 hover:bg-sheet',
                )}
              >
                <span className="truncate">{option.label}</span>
              </label>
            </div>
          )
        })}
      </div>
      {hint ? <Hint id={hintId}>{hint}</Hint> : null}
    </fieldset>
  )
}

export interface RangeFieldProps {
  readonly label: ReactNode
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step?: number
  readonly unit?: string
  readonly onChange: (value: number) => void
  readonly hint?: ReactNode
  /** Values offered as one-click stops under the track. */
  readonly stops?: readonly number[]
  readonly className?: string
}

/**
 * A slider whose exact value is shown beside its label, because a slider position cannot be read to a
 * number. The stops underneath are real buttons, so reaching a specific value never requires dragging
 * to the right pixel.
 */
export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  hint,
  stops,
  className,
}: RangeFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id}>
          <Label>{label}</Label>
        </label>
        <span className="font-mono text-sm tabular-nums text-ink">
          {value}
          {unit ? <span className="ml-1 font-mono text-label text-ink-3">{unit}</span> : null}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
      {stops ? (
        <div className="flex flex-wrap gap-1.5">
          {stops.map((stop) => (
            <button
              key={stop}
              type="button"
              onClick={() => onChange(stop)}
              aria-pressed={value === stop}
              className={cn(
                'min-h-9 rounded-hair border px-2 py-1 font-mono text-label tabular-nums',
                'transition-colors duration-150 ease-instrument',
                value === stop
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule-2 text-ink-3 hover:border-rule-3 hover:text-ink',
              )}
            >
              {stop}
            </button>
          ))}
        </div>
      ) : null}
      {hint ? <Hint id={hintId}>{hint}</Hint> : null}
    </div>
  )
}

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  readonly label: ReactNode
  readonly hint?: ReactNode
}

export function CheckboxField({ label, hint, className, ...rest }: CheckboxFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={id}
          aria-describedby={hint ? hintId : undefined}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-signal-ink)]"
          {...rest}
        />
        <label htmlFor={id} className="cursor-pointer text-sm text-ink-2">
          {label}
        </label>
      </div>
      {hint ? (
        <div className="pl-7">
          <Hint id={hintId}>{hint}</Hint>
        </div>
      ) : null}
    </div>
  )
}
