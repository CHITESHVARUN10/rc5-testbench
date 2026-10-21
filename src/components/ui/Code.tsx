import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { bytesToHex, groupHex } from '@/lib/rc5/bytes'
import { Button } from './Button'
import { Label } from './Text'

/**
 * Machine output: ciphertext, keys, round keys, byte dumps.
 *
 * Output is shown grouped in fours so it can be read aloud and compared by eye, while copying takes
 * the ungrouped form that a hex parser expects. The byte count sits next to the value, because a
 * length is part of the result.
 */

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    document.body.appendChild(area)
    area.select()
    const succeeded = document.execCommand('copy')
    document.body.removeChild(area)
    return succeeded
  } catch {
    return false
  }
}

type CopyState = 'idle' | 'copied' | 'failed'

export function CopyButton({
  text,
  label = 'Copy',
  compact = false,
  disabled = false,
}: {
  text: string
  label?: string
  compact?: boolean
  disabled?: boolean
}) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const handleCopy = async () => {
    const ok = await writeToClipboard(text)
    setState(ok ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1800)
  }

  return (
    <Button
      variant="secondary"
      compact={compact}
      glyph={state === 'copied' ? 'check' : 'copy'}
      onClick={handleCopy}
      disabled={disabled || text.length === 0}
    >
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
      </span>
    </Button>
  )
}

export function DownloadButton({
  text,
  filename,
  mime = 'text/plain',
  label = 'Download',
  compact = false,
  disabled = false,
}: {
  text: string
  filename: string
  mime?: string
  label?: string
  compact?: boolean
  disabled?: boolean
}) {
  const handleDownload = () => {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <Button
      variant="secondary"
      compact={compact}
      glyph="download"
      onClick={handleDownload}
      disabled={disabled || !text}
    >
      {label}
    </Button>
  )
}

export interface CodeWellProps {
  readonly label: ReactNode
  /** Raw hex, ungrouped. Empty string renders the empty state. */
  readonly hex: string
  readonly emptyText: ReactNode
  readonly actions?: ReactNode
  readonly footer?: ReactNode
  readonly tone?: 'default' | 'error'
  readonly className?: string
  readonly maxHeightClass?: string
}

export function CodeWell({
  label,
  hex,
  emptyText,
  actions,
  footer,
  tone = 'default',
  className,
  maxHeightClass = 'max-h-48',
}: CodeWellProps) {
  const isEmpty = hex.length === 0
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      <div
        className={cn(
          'overflow-auto rounded-hair border bg-well px-3 py-2.5',
          tone === 'error' ? 'border-err/50' : 'border-rule',
          maxHeightClass,
        )}
      >
        {isEmpty ? (
          <p className="text-sm text-ink-3">{emptyText}</p>
        ) : (
          <p className="font-mono text-sm break-all text-ink">{groupHex(hex)}</p>
        )}
      </div>
      {footer ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{footer}</div> : null}
    </div>
  )
}

/** Byte length as a readout, used under output panels. */
export function ByteCount({ bytes, className }: { bytes: number; className?: string }) {
  return (
    <span className={cn('font-mono text-label text-ink-3', className)}>
      {bytes.toLocaleString('en-US')} {bytes === 1 ? 'byte' : 'bytes'}
    </span>
  )
}

export function bytesToHexDisplay(bytes: Uint8Array): string {
  return bytesToHex(bytes)
}
