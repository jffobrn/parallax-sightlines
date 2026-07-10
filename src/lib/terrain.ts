/**
 * Terrain (Sightlines): sample a tokenless Terrarium DEM to answer one forensic
 * question, can a camera at the vantage actually see the subject, or does the
 * ground rise between them. Elevation tiles come from AWS elevation-tiles-prod
 * (Terrarium encoding), decoded locally in the browser; the tile fetch is
 * injected so the geometry is testable without a network.
 *
 * Terrarium encodes metres as (R * 256 + G + B / 256) - 32768.
 */

export interface LngLat {
  lat: number
  lng: number
}

export interface ProfilePoint {
  /** Metres along the ground from the vantage. */
  d: number
  elev: number
}

export interface ElevationProfile {
  points: ProfilePoint[]
  totalM: number
}

export interface LineOfSight {
  clear: boolean
  /** How far terrain rises above the sightline at the worst point (m); 0 when clear. */
  maxIntrusionM: number
  /** Ground distance from the vantage to that worst point (m). */
  intrusionAtM?: number
  /** Tightest gap between the sightline and the ground when clear (m). */
  minClearanceM: number
  observerElev: number
  targetElev: number
}

const EARTH_R = 6371000
// Refraction lifts the apparent horizon; the standard 0.13 coefficient gives an
// effective radius that both curvature and light bending fold into.
const R_EFF = EARTH_R / (1 - 0.13)

/** Terrarium metres from an RGB triple. */
export function terrariumElev(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768
}

/** Great-circle metres between two points. */
export function metersBetween(a: LngLat, b: LngLat): number {
  const d = Math.PI / 180
  const dLat = (b.lat - a.lat) * d
  const dLng = (b.lng - a.lng) * d
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Slippy-tile coordinates plus the float pixel within the 256px tile. */
export function lngLatToTilePx(lng: number, lat: number, z: number) {
  const n = 2 ** z
  const latRad = (lat * Math.PI) / 180
  const xf = ((lng + 180) / 360) * n
  const yf =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const tx = Math.floor(xf)
  const ty = Math.floor(yf)
  return { tx, ty, fx: (xf - tx) * 256, fy: (yf - ty) * 256 }
}

/** A source of decoded tile pixels: RGBA (256*256*4) or null if unavailable. */
export type TileProvider = (z: number, tx: number, ty: number) => Promise<Uint8ClampedArray | null>

function sampleTile(data: Uint8ClampedArray, fx: number, fy: number): number {
  // Bilinear within the tile, clamped at the edges.
  const x0 = Math.min(255, Math.max(0, Math.floor(fx)))
  const y0 = Math.min(255, Math.max(0, Math.floor(fy)))
  const x1 = Math.min(255, x0 + 1)
  const y1 = Math.min(255, y0 + 1)
  const dx = fx - x0
  const dy = fy - y0
  const at = (x: number, y: number) => {
    const i = (y * 256 + x) * 4
    return terrariumElev(data[i], data[i + 1], data[i + 2])
  }
  const top = at(x0, y0) * (1 - dx) + at(x1, y0) * dx
  const bot = at(x0, y1) * (1 - dx) + at(x1, y1) * dx
  return top * (1 - dy) + bot * dy
}

export const DEFAULT_ZOOM = 13

/** Elevation (m) at one point, or null if the covering tile could not be read. */
export async function elevationAt(
  lng: number,
  lat: number,
  z: number,
  provider: TileProvider,
): Promise<number | null> {
  const { tx, ty, fx, fy } = lngLatToTilePx(lng, lat, z)
  const data = await provider(z, tx, ty)
  if (!data) return null
  return sampleTile(data, fx, fy)
}

/** Sample an elevation profile from a to b with n segments (n+1 points). */
export async function sampleLine(
  a: LngLat,
  b: LngLat,
  n: number,
  z: number,
  provider: TileProvider,
): Promise<ElevationProfile | null> {
  const total = metersBetween(a, b)
  const points: ProfilePoint[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const lng = a.lng + (b.lng - a.lng) * t
    const lat = a.lat + (b.lat - a.lat) * t
    const elev = await elevationAt(lng, lat, z, provider)
    if (elev === null) return null
    points.push({ d: total * t, elev })
  }
  return { points, totalM: total }
}

/**
 * Decide whether the ground blocks the view along a profile. Elevations are
 * lowered by d^2 / (2 R_eff) into the observer's datum so curvature and
 * refraction are accounted for; the sightline is the straight chord from the
 * observer's eye to the target.
 */
export function lineOfSight(
  profile: ElevationProfile,
  observerHeightM = 1.6,
  targetHeightM = 0,
): LineOfSight {
  const pts = profile.points
  const N = pts.length - 1
  const observerElev = pts[0]?.elev ?? 0
  const targetElev = pts[N]?.elev ?? 0
  if (N < 2 || profile.totalM <= 0) {
    return {
      clear: true,
      maxIntrusionM: 0,
      minClearanceM: Infinity,
      observerElev,
      targetElev,
    }
  }
  const drop = (d: number) => (d * d) / (2 * R_EFF)
  const obsEye = observerElev + observerHeightM
  const targetEye = targetElev - drop(profile.totalM) + targetHeightM

  let maxIntrusion = -Infinity
  let intrusionAtM: number | undefined
  let minClearance = Infinity
  for (let i = 1; i < N; i++) {
    const sight = obsEye + (targetEye - obsEye) * (pts[i].d / profile.totalM)
    const ground = pts[i].elev - drop(pts[i].d)
    const intrusion = ground - sight
    if (intrusion > maxIntrusion) {
      maxIntrusion = intrusion
      intrusionAtM = pts[i].d
    }
    minClearance = Math.min(minClearance, sight - ground)
  }
  const clear = maxIntrusion <= 0
  return {
    clear,
    maxIntrusionM: Math.max(0, maxIntrusion),
    intrusionAtM: clear ? undefined : intrusionAtM,
    minClearanceM: clear ? minClearance : 0,
    observerElev,
    targetElev,
  }
}

// --- Browser tile provider -------------------------------------------------

const TERRARIUM_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

/** A caching Terrarium provider that fetches and decodes PNG tiles in the browser. */
export function makeTerrariumProvider(): TileProvider {
  const cache = new Map<string, Promise<Uint8ClampedArray | null>>()
  return (z, tx, ty) => {
    const key = `${z}/${tx}/${ty}`
    let p = cache.get(key)
    if (!p) {
      p = (async () => {
        try {
          const url = TERRARIUM_URL.replace('{z}', String(z))
            .replace('{x}', String(tx))
            .replace('{y}', String(ty))
          const res = await fetch(url)
          if (!res.ok) return null
          const bmp = await createImageBitmap(await res.blob())
          const canvas =
            typeof OffscreenCanvas !== 'undefined'
              ? new OffscreenCanvas(256, 256)
              : Object.assign(document.createElement('canvas'), { width: 256, height: 256 })
          const ctx = canvas.getContext('2d') as
            | CanvasRenderingContext2D
            | OffscreenCanvasRenderingContext2D
            | null
          if (!ctx) return null
          ctx.drawImage(bmp, 0, 0)
          bmp.close()
          return ctx.getImageData(0, 0, 256, 256).data
        } catch {
          return null
        }
      })()
      cache.set(key, p)
    }
    return p
  }
}

/** Shared session provider, so repeated checks reuse decoded tiles. */
export const terrariumProvider: TileProvider = makeTerrariumProvider()
