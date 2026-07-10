/**
 * Geocoding for the map search box. A typed coordinate resolves with no network;
 * anything else is a place-name query to Nominatim (OpenStreetMap), tokenless and
 * CORS-enabled. Operator-facing: the query reaches the geocoder, which is expected
 * here. Kept to a handful of results and one request per search.
 */

export interface GeoResult {
  label: string
  lat: number
  lng: number
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

/**
 * Parse a decimal-degree coordinate typed as "lat, lng" (comma or whitespace
 * separated, optional degree marks). Latitude is assumed first, matching how
 * coordinates are copied from mapping tools. Returns null if it is not a
 * coordinate.
 */
export function parseCoordinate(q: string): GeoResult | null {
  const s = q.trim().replace(/°/g, ' ')
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { label: lat.toFixed(5) + ', ' + lng.toFixed(5), lat, lng }
}

/**
 * Resolve a place name to at most `limit` candidates. Throws on a network or HTTP
 * error so the caller can show a quiet failure.
 */
export async function geocodePlace(query: string, limit = 5): Promise<GeoResult[]> {
  const url =
    NOMINATIM + '?format=jsonv2&limit=' + limit + '&q=' + encodeURIComponent(query)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('geocode ' + res.status)
  const rows = (await res.json()) as Array<{
    display_name: string
    lat: string
    lon: string
  }>
  return rows
    .map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
}
