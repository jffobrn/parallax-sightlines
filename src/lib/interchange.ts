/**
 * Interchange (shared core): export placed geometry as GeoJSON or CSV, and read
 * points back from either, so a project round-trips with QGIS and other mapping
 * tools. Self-contained (no project-model import) so this file is byte-identical
 * across the tools; each tool supplies its own list of features to export.
 *
 * Coordinates are always [lng, lat] in GeoJSON (RFC 7946) and lat, lng columns in
 * CSV (the order people read). Nothing is fetched; export builds a string the
 * caller hands to the user as a download.
 */

export type GeoGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] }

export interface GeoFeature {
  type: 'Feature'
  geometry: GeoGeometry
  properties: Record<string, unknown>
}

export interface GeoFeatureCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

/** A plain placed point, the common currency of import and CSV. */
export interface NamedPoint {
  lat: number
  lng: number
  name?: string
  kind?: string
  bearingDeg?: number
  note?: string
}

export function pointFeature(
  lng: number,
  lat: number,
  properties: Record<string, unknown> = {},
): GeoFeature {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties }
}

export function lineFeature(
  coords: [number, number][],
  properties: Record<string, unknown> = {},
): GeoFeature {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties }
}

export function polygonFeature(
  rings: [number, number][][],
  properties: Record<string, unknown> = {},
): GeoFeature {
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: rings }, properties }
}

export function featureCollection(features: GeoFeature[]): GeoFeatureCollection {
  return { type: 'FeatureCollection', features }
}

export function toGeoJsonString(fc: GeoFeatureCollection): string {
  return JSON.stringify(fc, null, 2)
}

// --- CSV -------------------------------------------------------------------

function csvCell(v: unknown): string {
  if (v === undefined || v === null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/** Export named points as CSV with a stable header. */
export function pointsToCsv(points: NamedPoint[]): string {
  const header = ['name', 'lat', 'lng', 'kind', 'bearing_deg', 'note']
  const rows = points.map((p) =>
    [p.name, p.lat, p.lng, p.kind, p.bearingDeg, p.note].map(csvCell).join(','),
  )
  return [header.join(','), ...rows].join('\n')
}

/** Split a CSV line honouring quoted cells. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else quoted = false
      } else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

/** Parse CSV text into points, detecting lat / lng columns by header name. */
export function parseCsvPoints(text: string): NamedPoint[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const latI = header.findIndex((h) => h === 'lat' || h === 'latitude' || h === 'y')
  const lngI = header.findIndex(
    (h) => h === 'lng' || h === 'lon' || h === 'long' || h === 'longitude' || h === 'x',
  )
  if (latI < 0 || lngI < 0) return []
  const nameI = header.findIndex((h) => h === 'name' || h === 'label' || h === 'title')
  const kindI = header.findIndex((h) => h === 'kind' || h === 'type')
  const bearingI = header.findIndex((h) => h === 'bearing_deg' || h === 'bearing')
  const out: NamedPoint[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const lat = Number(cells[latI])
    const lng = Number(cells[lngI])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
    const p: NamedPoint = { lat, lng }
    if (nameI >= 0 && cells[nameI]) p.name = cells[nameI]
    if (kindI >= 0 && cells[kindI]) p.kind = cells[kindI]
    if (bearingI >= 0 && Number.isFinite(Number(cells[bearingI])))
      p.bearingDeg = Number(cells[bearingI])
    out.push(p)
  }
  return out
}

// --- GeoJSON import --------------------------------------------------------

interface RawFeature {
  geometry?: { type?: string; coordinates?: unknown }
  properties?: Record<string, unknown>
}

function coordPoint(coords: unknown): [number, number] | null {
  if (!Array.isArray(coords) || coords.length < 2) return null
  const lng = Number(coords[0])
  const lat = Number(coords[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return [lng, lat]
}

/**
 * Read Point features (and the first vertex of other geometries) out of GeoJSON
 * text as named points. Tolerant of a FeatureCollection, a single Feature, or a
 * bare geometry.
 */
export function parseGeoJsonPoints(text: string): NamedPoint[] {
  const json = JSON.parse(text) as {
    type?: string
    features?: RawFeature[]
    geometry?: RawFeature['geometry']
    coordinates?: unknown
  }
  let features: RawFeature[] = []
  if (json?.type === 'FeatureCollection' && Array.isArray(json.features)) features = json.features
  else if (json?.type === 'Feature') features = [json as RawFeature]
  else if (json?.type && json.coordinates !== undefined)
    features = [{ geometry: { type: json.type, coordinates: json.coordinates } }]

  const out: NamedPoint[] = []
  for (const f of features) {
    const g = f.geometry
    if (!g || !g.type) continue
    let xy: [number, number] | null = null
    if (g.type === 'Point') xy = coordPoint(g.coordinates)
    else if (g.type === 'LineString' || g.type === 'MultiPoint')
      xy = coordPoint((g.coordinates as unknown[])?.[0])
    else if (g.type === 'Polygon')
      xy = coordPoint(((g.coordinates as unknown[])?.[0] as unknown[])?.[0])
    if (!xy) continue
    const props = f.properties ?? {}
    const name =
      (props.name as string) ?? (props.title as string) ?? (props.label as string) ?? undefined
    const p: NamedPoint = { lng: xy[0], lat: xy[1] }
    if (name) p.name = String(name)
    if (props.kind) p.kind = String(props.kind)
    const bearing = props.bearing_deg ?? props.bearingDeg ?? props.bearing
    if (Number.isFinite(Number(bearing))) p.bearingDeg = Number(bearing)
    out.push(p)
  }
  return out
}

// --- Download helper -------------------------------------------------------

/** Offer a text file to the user as a download. The tool's own output; nothing is sent. */
export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
