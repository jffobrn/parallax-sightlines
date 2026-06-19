/**
 * Build embedded thumbnails (data URLs) for the published artifact. Only public
 * image sources are touched: this runs before publicClone and its result is
 * passed in, so non-public material is never read for publication. Small files
 * (the sample's SVGs) are embedded as-is; large rasters are downscaled to a
 * bounded JPEG so the self-contained file stays reasonable.
 */

import { getMedia, type Project } from '../core'

const EMBED_AS_IS_LIMIT = 600_000
const MAX_EDGE = 1100

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(r.error)
    r.onload = () => resolve(r.result as string)
    r.readAsDataURL(blob)
  })
}

async function rasterize(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob)
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bmp.close()
    throw new Error('no 2d context')
  }
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}

export async function buildThumbnails(
  project: Project,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const s of project.sources) {
    if (s.consent !== 'public') continue
    if (!s.file?.blobKey || !s.file.mime.startsWith('image/')) continue
    const blob = await getMedia(s.file.blobKey)
    if (!blob) continue
    try {
      if (blob.size <= EMBED_AS_IS_LIMIT || s.file.mime === 'image/svg+xml') {
        out[s.id] = await blobToDataUrl(blob)
      } else {
        out[s.id] = await rasterize(blob)
      }
    } catch {
      // If a format cannot be decoded, skip the thumbnail; the exhibit still
      // lists its hash and metadata.
    }
  }
  return out
}
