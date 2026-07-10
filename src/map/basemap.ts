/**
 * Basemap (shared core for the map). Three facts drive this file:
 *
 *  1. A real basemap is available and is the default, because placing a vantage
 *     against a blank grid is not a workflow. Satellite imagery (Esri) and street
 *     tiles (OpenStreetMap) are offered, tokenless.
 *
 *  2. Fetched tiles reveal the viewport to the tile server. That is disclosed in
 *     the UI, it affects only the editing view, never a published artifact (the
 *     artifact draws its own static map and fetches nothing), and two private
 *     modes are one click away: a synthetic graticule that fetches nothing at
 *     all, and a self-hosted PMTiles file that never leaves the machine.
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

export type BasemapSource = 'satellite' | 'streets' | 'graticule' | 'file'

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

/** The two online sources. Tokenless; each reveals the viewport to its server. */
export const BASEMAP_TILES: Record<'satellite' | 'streets', RasterDef> = {
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
}

export const BG_COLOR = '#07090c'

/**
 * The style for a chosen basemap: a dark background always, a raster basemap
 * layer for satellite / streets / a loaded PMTiles file, and nothing fetched for
 * the graticule. The grid and all points are drawn over the top by deck.gl.
 */
export function makeBasemapStyle(
  source: BasemapSource,
  fileKey?: string,
): StyleSpecification {
  const sources: Record<string, SourceSpecification> = {}
  const layers: LayerSpecification[] = [
    { id: 'background', type: 'background', paint: { 'background-color': BG_COLOR } },
  ]

  if (source === 'satellite' || source === 'streets') {
    const def = BASEMAP_TILES[source]
    sources.basemap = {
      type: 'raster',
      tiles: def.tiles,
      tileSize: 256,
      attribution: def.attribution,
      maxzoom: def.maxzoom,
    }
    layers.push({ id: 'basemap', type: 'raster', source: 'basemap' })
  } else if (source === 'file' && fileKey) {
    sources.basemap = { type: 'raster', url: 'pmtiles://' + fileKey, tileSize: 256 }
    layers.push({ id: 'basemap', type: 'raster', source: 'basemap' })
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
