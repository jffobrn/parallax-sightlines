/** Stable id generation (shared core). */

/** A namespaced unique id, e.g. `src_3f9a...`. */
export function newId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
  return `${prefix}_${uuid.replace(/-/g, '').slice(0, 12)}`
}
