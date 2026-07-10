import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import { DEFAULT_ZOOM, elevationAt, terrariumProvider } from '../lib/terrain'

/**
 * Terrain elevation under the map cursor, sampled from the DEM at most once every
 * 400ms and always for the latest cursor position. Decoded tiles are cached by the
 * provider, so roaming within an area is free after the first read. Returns null
 * off the map or where the DEM cannot be read.
 */
export function useCursorElevation(): number | null {
  const cursor = useStore((s) => s.cursor)
  const [elev, setElev] = useState<number | null>(null)
  const timer = useRef<number | null>(null)
  const latest = useRef(cursor)
  latest.current = cursor

  useEffect(() => {
    if (!cursor) {
      setElev(null)
      return
    }
    if (timer.current !== null) return // one sample per window, using the latest point
    timer.current = window.setTimeout(async () => {
      timer.current = null
      const c = latest.current
      if (!c) return
      const e = await elevationAt(c.lng, c.lat, DEFAULT_ZOOM, terrariumProvider)
      setElev(e === null ? null : Math.round(e))
    }, 400)
  }, [cursor])

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  return elev
}
