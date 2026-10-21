import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
} from 'react'

import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Glyph } from './Glyph'
import { Label } from './Text'

/**
 * Overlays.
 *
 * Modals use the native `<dialog>` element with `showModal()`, which brings a focus trap, an inert
 * background, Escape handling and focus restoration from the platform. Reimplementing any of that by
 * hand is how modals end up broken for keyboard users.
 *
 * Definitions are the same idea in miniature: the trigger is a real button, so the definition is
 * reachable by keyboard and announced through aria-describedby, rather than being mouse-only text
 * that appears on hover.
 */

export interface DialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: ReactNode
  readonly children: ReactNode
  readonly footer?: ReactNode
  readonly className?: string
}

export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = `${useId()}-title`

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    onClose()
  }

  const handleBackdrop = (event: ReactMouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) onClose()
  }

  return (
    <dialog
      ref={ref}
      onCancel={handleCancel}
      onClick={handleBackdrop}
      aria-labelledby={titleId}
      className={cn('text-ink', className)}
    >
      <div className="border-b border-rule px-4 py-3 sm:px-5">
        <h2 id={titleId} className="text-lg font-medium text-ink">
          {title}
        </h2>
      </div>
      <div className="max-w-[68ch] space-y-3 px-4 py-4 text-sm text-ink-2 sm:px-5">{children}</div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule px-4 py-3 sm:px-5">
        {footer ?? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </dialog>
  )
}

export interface ConfirmDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onConfirm: () => void
  readonly title: ReactNode
  readonly confirmLabel: string
  readonly tone?: 'default' | 'danger'
  readonly children: ReactNode
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel,
  tone = 'default',
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep as is
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}

export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  const id = useId()
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
        onClick={() => setOpen((current) => !current)}
        className="cursor-help border-b border-dotted border-rule-3 text-left text-ink-2 hover:text-ink"
      >
        {children}
      </button>
      {open ? (
        <span
          role="tooltip"
          id={id}
          className="absolute top-full left-0 z-50 mt-1.5 w-max max-w-[min(22rem,calc(100vw-3rem))] rounded-hair border border-rule-2 bg-sheet px-3 py-2 text-left text-sm font-normal normal-case tracking-normal text-ink-2 shadow-overlay"
        >
          {label}
        </span>
      ) : null}
    </span>
  )
}

/** A term with a definition attached. Used throughout the Learn page and in field hints. */
export function Term({ children, definition }: { children: ReactNode; definition: ReactNode }) {
  return <Tooltip label={definition}>{children}</Tooltip>
}

export function Disclosure({
  summary,
  note,
  children,
  defaultOpen = false,
  className,
}: {
  summary: ReactNode
  note?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <details open={defaultOpen} className={cn('group', className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-ink-2 hover:text-ink sm:min-h-0">
        <Glyph
          name="chevron-right"
          size={14}
          className="text-ink-4 transition-transform duration-200 ease-instrument group-open:rotate-90"
        />
        <Label>{summary}</Label>
        {note ? <span className="font-mono text-label text-ink-4">{note}</span> : null}
      </summary>
      <div className="pt-3 pl-[22px]">{children}</div>
    </details>
  )
}
