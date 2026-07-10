/**
 * Basemap (shared core for the map).
 *
 *  1. A real basemap is the default: placing a vantage against a blank grid is
 *     not a workflow. Tokenless online sources are offered (Esri satellite and
 *     topographic, OpenStreetMap streets), with dated historical imagery from the
 *     Esri Wayback archive and an optional place-label overlay. Search resolves a
 *     place name or a typed coordinate (see geocode.ts).
 *
 *  2. These are operator-facing research instruments. Online retrieval is a
 *     working convenience and carries no disclosure on the way out: a published
 *     artifact draws its own static map and fetches nothing, and two offline
 *     modes stay one click away for work over sensitive ground: a synthetic
 *     graticule that fetches nothing at all, and a self-hosted PMTiles file that
 *     never leaves the machine.
 *
 *  3. The synthetic graticule is drawn over any basemap by deck.gl (see
 *     graticuleLines) so the coordinate frame follows the view at any zoom.
 */

import maplibregl, {
  type LayerSpecification,
  type SourceSpecification,
  type StyleSpecification,
} from 'maplibre-gl'
import { FileSource, PMTiles, Protocol } from 'pmtiles'

export type BasemapSource = 'satellite' | 'streets' | 'topo' | 'graticule' | 'file'

let protocol: Protocol | null = null

/** Register the pmtiles:// protocol with MapLibre, once. */
export function registerPmtilesProtocol(): void {
  if (protocol) return
  protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile)
}

/**
 * Register a user-picked PMTiles file as the 'file' basemap and return its
 * pmtiles:// key. The file is read locally via range requests; nothing is
 * uploaded. Throws (surfaced to the caller) if the archive cannot be read.
 */
export async function registerBasemapFile(file: File): Promise<string> {
  registerPmtilesProtocol()
  const pm = new PMTiles(new FileSource(file))
  await pm.getHeader() // fail here on a bad file, not mid-render
  protocol!.add(pm)
  return pm.source.getKey()
}

interface RasterDef {
  tiles: string[]
  attribution: string
  maxzoom: number
}

/** The online raster bases. Tokenless. */
export const BASEMAP_TILES: Record<'satellite' | 'streets' | 'topo', RasterDef> = {
  satellite: {
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution:
      'Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxzoom: 19,
  },
  streets: {
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '&copy; OpenStreetMap contributors',
    maxzoom: 19,
  },
  topo: {
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: 'Esri, HERE, Garmin, USGS, and the GIS User Community',
    maxzoom: 19,
  },
}

/** Transparent place-name and boundary overlay, drawn over any raster base. */
const LABELS_TILES: RasterDef = {
  tiles: [
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  ],
  attribution: 'Labels: Esri',
  maxzoom: 19,
}

export const BG_COLOR = '#07090c'

/** A dated release of the Esri Wayback World Imagery archive. */
export interface WaybackRelease {
  release: number
  date: string
  url: string
}

const WAYBACK_CONFIG_URL =
  'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json'

let waybackCache: WaybackRelease[] | null = null

/**
 * Fetch the list of dated Wayback imagery releases, newest first. Tokenless;
 * memoised for the session. Each release carries a ready-to-use XYZ tile
 * template. Throws on a network or parse failure so the caller can degrade to
 * live imagery only.
 */
export async function fetchWaybackReleases(): Promise<WaybackRelease[]> {
  if (waybackCache) return waybackCache
  const res = await fetch(WAYBACK_CONFIG_URL)
  if (!res.ok) throw new Error('wayback config ' + res.status)
  const cfg = (await res.json()) as Record<
    string,
    { itemTitle?: string; itemURL?: string }
  >
  const out: WaybackRelease[] = []
  for (const [key, v] of Object.entries(cfg)) {
    const m = v.itemTitle?.match(/(\d{4}-\d{2}-\d{2})/)
    if (!v.itemURL || !m) continue
    out.push({
      release: Number(key),
      date: m[1],
      url: v.itemURL
        .replace(/\{level\}/i, '{z}')
        .replace(/\{row\}/i, '{y}')
        .replace(/\{col\}/i, '{x}'),
    })
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  waybackCache = out
  return out
}

/** Options that modify a basemap style without changing the primary source. */
export interface BasemapOpts {
  /** pmtiles:// key for the 'file' source. */
  fileKey?: string
  /** Overlay place-name and boundary labels on top of the raster base. */
  labels?: boolean
  /** Override the satellite tiles with a Wayback release template. */
  satelliteUrl?: string
}

/**
 * The style for a chosen basemap: a dark background always, a raster basemap
 * layer for satellite / streets / topo / a loaded PMTiles file, an optional
 * label overlay, and nothing fetched for the graticule. The grid and all points
 * are drawn over the top by deck.gl.
 */
export function makeBasemapStyle(
  source: BasemapSource,
  opts: BasemapOpts = {},
): StyleSpecification {
  const sources: Record<string, SourceSpecification> = {}
  const layers: LayerSpecification[] = [
    { id: 'background', type: 'background', paint: { 'background-color': BG_COLOR } },
  ]

  if (source === 'satellite' || source === 'streets' || source === 'topo') {
    const def = BASEMAP_TILES[source]
    const tiles =
      source === 'satellite' && opts.satelliteUrl ? [opts.satelliteUrl] : def.tiles
    sources.basemap = {
      type: 'raster',
      tiles,
      tileSize: 256,
      attribution: def.attribution,
      maxzoom: def.maxzoom,
    }
    layers.push({ id: 'basemap', type: 'raster', source: 'basemap' })
  } else if (source === 'file' && opts.fileKey) {
    sources.basemap = { type: 'raster', url: 'pmtiles://' + opts.fileKey, tileSize: 256 }
    layers.push({ id: 'basemap', type: 'raster', source: 'basemap' })
  }

  if (opts.labels && source !== 'graticule') {
    sources.labels = {
      type: 'raster',
      tiles: LABELS_TILES.tiles,
      tileSize: 256,
      attribution: LABELS_TILES.attribution,
      maxzoom: LABELS_TILES.maxzoom,
    }
    layers.push({ id: 'labels', type: 'raster', source: 'labels' })
  }

  return { version: 8, name: 'parallax-forensic', sources, layers }
}

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

/** A round-ish grid step (degrees) giving roughly 8-12 lines across a span. */
export function niceStep(spanDeg: number): number {
  const target = spanDeg / 10
  const pow = Math.pow(10, Math.floor(Math.log10(target)))
  const candidates = [1, 2, 5, 10].map((m) => m * pow)
  for (const c of candidates) if (c >= target) return c
  return candidates[candidates.length - 1]
}

export interface Graticule {
  step: number
  minor: [number, number][][]
  major: [number, number][][]
}

/** Build minor and major graticule lines covering the given bounds. */
export function graticuleLines(bounds: Bounds): Graticule {
  const spanLng = Math.max(1e-6, bounds.east - bounds.west)
  const step = niceStep(spanLng)
  const major = step * 5

  const minorLines: [number, number][][] = []
  const majorLines: [number, number][][] = []

  const startLng = Math.floor(bounds.west / step) * step
  for (let x = startLng; x <= bounds.east; x += step) {
    const line: [number, number][] = [
      [x, bounds.south],
      [x, bounds.north],
    ]
    if (Math.abs(x / major - Math.round(x / major)) < 1e-6) majorLines.push(line)
    else minorLines.push(line)
  }

  const startLat = Math.floor(bounds.south / step) * step
  for (let y = startLat; y <= bounds.north; y += step) {
    const line: [number, number][] = [
      [bounds.west, y],
      [bounds.east, y],
    ]
    if (Math.abs(y / major - Math.round(y / major)) < 1e-6) majorLines.push(line)
    else minorLines.push(line)
  }

  return { step, minor: minorLines, major: majorLines }
}
