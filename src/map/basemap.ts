/**
 * Basemap (shared core for the map). Two safety facts drive this file:
 *
 *  1. Tiles must never leak the viewport. The default basemap is a synthetic
 *     forensic graticule that fetches nothing at all: no tile server, no glyph
 *     server, no sprite. A sensitive area of interest cannot reach an outside
 *     server because no request is ever made.
 *
 *  2. Real tiles, when wanted, come from a bundled or self-hosted PMTiles
 *     archive over the `pmtiles://` protocol, never a third-party service. The
 *     protocol is registered here; point `makeBasemapStyle` at a local archive
 *     to use it. (The sample uses invented coordinates, so it ships with the
 *     synthetic basemap.)
 */

import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import { Protocol } from 'pmtiles'

let registered = false

/** Register the pmtiles:// protocol with MapLibre, once. */
export function registerPmtilesProtocol(): void {
  if (registered) return
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile)
  registered = true
}

export const BG_COLOR = '#07090c'

/**
 * The default style: a single dark background and no sources. The grid is drawn
 * over the top by deck.gl (see graticuleLines) so it can follow any view at any
 * zoom without tiles.
 */
export function makeBasemapStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'parallax-forensic',
    // No glyphs and no sprite: nothing is fetched from anywhere.
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': BG_COLOR },
      },
    ],
  }
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
