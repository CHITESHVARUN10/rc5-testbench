export type ClassValue = string | number | false | null | undefined

/** Join class names, dropping empty values. Small enough not to need a dependency. */
export function cn(...values: ClassValue[]): string {
  return values.filter((value) => typeof value === 'string' && value.length > 0).join(' ')
}
