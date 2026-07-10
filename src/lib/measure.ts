/**
 * Measure (shared core): ground distance along a path and area of a polygon, from
 * clicked points. Self-contained (no project-model import) so this file is
 * byte-identical across the tools. Coordinates are [lng, lat] to match the map.
 *
 * Distance is great-circle (haversine). Area is a shoelace over a local
 * equirectangular projection about the ring's mean latitude, accurate for the
 * site-scale polygons these tools measure.
 */

export type LngLatTuple = [number, number]

const EARTH_R = 6371000
const DEG = Math.PI / 180

export function haversineM(a: LngLatTuple, b: LngLatTuple): number {
  const dLat = (b[1] - a[1]) * DEG
  const dLng = (b[0] - a[0]) * DEG
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Per-segment lengths (metres) along the path. */
export function segmentsM(pts: LngLatTuple[]): number[] {
  const out: number[] = []
  for (let i = 1; i < pts.length; i++) out.push(haversineM(pts[i - 1], pts[i]))
  return out
}

/** Total path length (metres). */
export function pathLengthM(pts: LngLatTuple[]): number {
  return segmentsM(pts).reduce((a, b) => a + b, 0)
}

/** Polygon area (square metres) of a ring, treating it as closed. */
export function polygonAreaM2(pts: LngLatTuple[]): number {
  if (pts.length < 3) return 0
  const lat0 = pts.reduce((s, p) => s + p[1], 0) / pts.length
  const cos0 = Math.cos(lat0 * DEG)
  const x = (lng: number) => lng * DEG * EARTH_R * cos0
  const y = (lat: number) => lat * DEG * EARTH_R
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    sum += x(a[0]) * y(b[1]) - x(b[0]) * y(a[1])
  }
  return Math.abs(sum) / 2
}

export function fmtDistance(m: number): string {
  return m >= 1000 ? (m / 1000).toFixed(2) + ' km' : m.toFixed(m < 10 ? 1 : 0) + ' m'
}

export function fmtArea(m2: number): string {
  if (m2 >= 1e6) return (m2 / 1e6).toFixed(2) + ' km2'
  if (m2 >= 1e4) return (m2 / 1e4).toFixed(2) + ' ha'
  return m2.toFixed(0) + ' m2'
}
