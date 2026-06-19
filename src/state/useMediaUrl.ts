/**
 * Resolve a media blobKey to an object URL for display, loading the Blob from
 * IndexedDB and revoking the URL on unmount. Media never travels through the
 * app state; it is fetched here, on demand, by key.
 */

import { useEffect, useState } from 'react'
import { getMedia } from '../core'

export function useMediaUrl(blobKey: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked = false
    let objectUrl: string | null = null
    setUrl(null)
    if (!blobKey) return

    void getMedia(blobKey).then((blob) => {
      if (revoked || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })

    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [blobKey])

  return url
}
