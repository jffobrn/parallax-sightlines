/** Bring a file into the project: hash its bytes, store the Blob, describe it. */

import { newId, putMedia, sha256Hex, type HeldFile } from '../core'

export async function ingestFile(file: File): Promise<HeldFile> {
  const buf = await file.arrayBuffer()
  const sha256 = await sha256Hex(buf)
  const blobKey = newId('media')
  await putMedia(blobKey, file)

  let w: number | undefined
  let h: number | undefined
  if (file.type.startsWith('image/')) {
    try {
      const bmp = await createImageBitmap(file)
      w = bmp.width
      h = bmp.height
      bmp.close()
    } catch {
      // SVG and some formats cannot be decoded this way; dimensions stay unset.
    }
  }

  return {
    name: file.name,
    mime: file.type || 'application/octet-stream',
    bytes: file.size,
    sha256,
    w,
    h,
    blobKey,
  }
}
