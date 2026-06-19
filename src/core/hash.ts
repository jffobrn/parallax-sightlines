/**
 * Fixity hashing (shared core).
 *
 * Every file held by the app is hashed with sha-256 over its actual bytes, in
 * the Berkeley Protocol manner, so a source can be shown to be unchanged. We
 * only ever hash bytes we hold: for a link (video) we hash an archived
 * snapshot, never the remote bytes, and the UI says so plainly.
 *
 * Uses the platform WebCrypto (`crypto.subtle.digest`); no dependency, no
 * network, nothing leaves the machine.
 */

/** Lowercase hex sha-256 of an ArrayBuffer. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return bufferToHex(digest)
}

/** sha-256 of a Blob or File, read fully into memory once. */
export async function sha256OfBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  return sha256Hex(buf)
}

/** sha-256 of a UTF-8 string (used for hashing archived-snapshot records). */
export async function sha256OfText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  return sha256Hex(bytes.buffer as ArrayBuffer)
}

/** Short, human-readable form of a hash for dense UI: first 12 hex chars. */
export function shortHash(hex: string): string {
  return hex.slice(0, 12)
}

function bufferToHex(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer)
  let out = ''
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, '0')
  }
  return out
}
