/** Save data to the user's machine. Nothing leaves the browser. */

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadJson(filename: string, obj: unknown): void {
  downloadText(filename, JSON.stringify(obj, null, 2), 'application/json')
}

/** Read a user-picked file as text (for project import). */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(r.error)
    r.onload = () => resolve(r.result as string)
    r.readAsText(file)
  })
}

/** A filesystem-safe slug for filenames. */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48) || 'investigation'
  )
}
