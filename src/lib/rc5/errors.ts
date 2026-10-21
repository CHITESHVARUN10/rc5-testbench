/**
 * Errors the engine raises. Every message is written to be shown directly to the user: it names what
 * went wrong and what to change. Internal detail is carried separately in `detail` so it can be
 * logged or exported without leaking into the interface.
 */

export type Rc5ErrorCode =
  | 'unsupported-word-size'
  | 'rounds-out-of-range'
  | 'key-length-out-of-range'
  | 'key-length-mismatch'
  | 'payload-empty'
  | 'payload-too-large'
  | 'not-block-aligned'
  | 'invalid-padding'
  | 'invalid-hex'
  | 'invalid-utf8'

export class Rc5Error extends Error {
  readonly code: Rc5ErrorCode
  readonly detail: Readonly<Record<string, string | number>>

  constructor(code: Rc5ErrorCode, message: string, detail: Record<string, string | number> = {}) {
    super(message)
    this.name = 'Rc5Error'
    this.code = code
    this.detail = detail
  }
}

export function isRc5Error(value: unknown): value is Rc5Error {
  return value instanceof Rc5Error
}
