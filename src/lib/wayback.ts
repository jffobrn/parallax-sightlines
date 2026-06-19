/**
 * Optional, user-initiated archived-snapshot lookup. This is the one place the
 * app reaches the network, and only when the user asks for it: it sends the
 * link URL to the Internet Archive to find an existing snapshot. We still do
 * not hold the remote bytes, so what we hash is a record of the snapshot, not
 * the video itself. The UI says so.
 */

import { sha256OfText } from '../core'

function isoFromWaybackStamp(stamp: string): string {
  // YYYYMMDDhhmmss -> ISO 8601 (UTC)
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(stamp)
  if (!m) return ''
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`
}

export interface SnapshotResult {
  archivedUrl: string
  archivedAt: string
  archivedSha256: string
}

export async function findWaybackSnapshot(
  url: string,
): Promise<SnapshotResult | null> {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`
  const res = await fetch(api)
  if (!res.ok) throw new Error(`Archive lookup failed (${res.status}).`)
  const data = (await res.json()) as {
    archived_snapshots?: { closest?: { available?: boolean; url?: string; timestamp?: string } }
  }
  const snap = data.archived_snapshots?.closest
  if (!snap?.available || !snap.url) return null

  const archivedAt = snap.timestamp ? isoFromWaybackStamp(snap.timestamp) : ''
  const record = JSON.stringify({
    capturedFrom: url,
    archivedUrl: snap.url,
    archivedAt,
    note: 'Hash is of this snapshot record. Remote bytes are not held and cannot be hashed at source.',
  })
  const archivedSha256 = await sha256OfText(record)
  return { archivedUrl: snap.url, archivedAt, archivedSha256 }
}
