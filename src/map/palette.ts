/**
 * Map colours, keyed to the ground under them rather than to the interface.
 * Over satellite imagery (and the dark grid) the marks are light, so they read
 * against texture; over streets, topo, and the light grid they are violet and
 * raspberry, matching the interface. Raspberry always marks what the evidence
 * converges on; red is kept for protected points.
 */

export type Ground = 'dark' | 'light'
type RGBA = [number, number, number, number]

export interface MapPalette {
  minor: RGBA
  major: RGBA
  subject: RGBA
  subjectLine: RGBA
  vantage: RGBA
  vantageLine: RGBA
  ray: RGBA
  raySel: RGBA
  cone: RGBA
  coneSel: RGBA
  cross: RGBA
  crossRing: RGBA
  place: RGBA
  alert: RGBA
  sel: RGBA
  wedge: RGBA
  wedgeSel: RGBA
  wedgeLine: RGBA
  zone: RGBA
  zoneLine: RGBA
  ellipseFill: RGBA
  ellipseLine: RGBA
  shadow: RGBA
  measureFill: RGBA
  measureLine: RGBA
  measurePt: RGBA
  measurePtLine: RGBA
}

const DARK: MapPalette = {
  minor: [70, 68, 63, 140],
  major: [100, 97, 90, 190],
  subject: [234, 210, 247, 255],
  subjectLine: [22, 11, 24, 255],
  vantage: [255, 255, 255, 255],
  vantageLine: [22, 11, 24, 255],
  ray: [255, 255, 255, 150],
  raySel: [255, 126, 179, 240],
  cone: [255, 255, 255, 18],
  coneSel: [255, 126, 179, 34],
  cross: [255, 79, 163, 255],
  crossRing: [255, 79, 163, 90],
  place: [234, 210, 247, 255],
  alert: [255, 110, 100, 255],
  sel: [255, 126, 179, 255],
  wedge: [255, 126, 179, 16],
  wedgeSel: [255, 126, 179, 38],
  wedgeLine: [255, 126, 179, 90],
  zone: [255, 79, 163, 64],
  zoneLine: [255, 126, 179, 255],
  ellipseFill: [255, 79, 163, 26],
  ellipseLine: [255, 126, 179, 170],
  shadow: [255, 255, 255, 235],
  measureFill: [234, 210, 247, 46],
  measureLine: [234, 210, 247, 235],
  measurePt: [234, 210, 247, 255],
  measurePtLine: [22, 11, 24, 255],
}

const LIGHT: MapPalette = {
  minor: [214, 211, 203, 170],
  major: [184, 180, 170, 220],
  subject: [90, 22, 102, 255],
  subjectLine: [255, 255, 255, 255],
  vantage: [255, 255, 255, 255],
  vantageLine: [22, 11, 24, 255],
  ray: [90, 22, 102, 150],
  raySel: [194, 24, 91, 235],
  cone: [90, 22, 102, 16],
  coneSel: [194, 24, 91, 28],
  cross: [194, 24, 91, 255],
  crossRing: [194, 24, 91, 70],
  place: [75, 59, 79, 255],
  alert: [179, 38, 30, 255],
  sel: [194, 24, 91, 255],
  wedge: [194, 24, 91, 14],
  wedgeSel: [194, 24, 91, 34],
  wedgeLine: [194, 24, 91, 90],
  zone: [194, 24, 91, 52],
  zoneLine: [194, 24, 91, 255],
  ellipseFill: [194, 24, 91, 22],
  ellipseLine: [194, 24, 91, 160],
  shadow: [22, 11, 24, 235],
  measureFill: [90, 22, 102, 34],
  measureLine: [90, 22, 102, 230],
  measurePt: [90, 22, 102, 255],
  measurePtLine: [255, 255, 255, 255],
}

export function mapPalette(ground: Ground): MapPalette {
  return ground === 'dark' ? DARK : LIGHT
}

/** Satellite imagery reads as a dark ground; streets and topo as light; the
 *  grid and a local file follow the interface theme. */
export function groundFor(basemap: string, theme: 'light' | 'dark'): Ground {
  if (basemap === 'satellite') return 'dark'
  if (basemap === 'streets' || basemap === 'topo') return 'light'
  return theme
}

/** The grid ground's background, per theme. */
export const GRID_BG = { light: '#e8e6e0', dark: '#2b2a27' } as const
