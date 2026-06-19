/**
 * Resection geometry (shared core): crossing sightlines to fix a place.
 *
 * A vantage is a point plus a bearing (the line a camera looked along). Where
 * two such rays cross, the crossing point is a candidate location for the thing
 * both cameras saw. This is the surveyor's resection and the optical principle
 * the suite is named for.
 *
 * At the scale of a single incident a planar (equirectangular) approximation
 * around the local latitude is accurate to within a few metres, far better than
 * the placement uncertainty, so we use it and say so rather than implying
 * great-circle precision. Two nearly parallel rays give an unstable fix; we
 * detect that and report weak geometry instead of drawing a confident false
 * point.
 */

export const EARTH_RADIUS_M = 6_371_000

/** Rays within this many degrees of parallel (or anti-parallel) are unstable. */
export const WEAK_CROSSING_DEG = 8

export interface LatLng {
  lat: number
  lng: number
}

export interface RayInput {
  lat: number
  lng: number
  /** Compass bearing, degrees, 0 = north, clockwise. */
  bearingDeg: number
}

export interface Resection {
  /** The crossing point, or null if the rays do not usefully cross. */
  point: LatLng | null
  /** Acute crossing angle in degrees, 0..90. Near 90 is a strong fix. */
  crossingAngleDeg: number
  /** sin(angle), 0..1: a convenience confidence weight. */
  quality: number
  /** True when the rays are too close to parallel for a stable fix. */
  weak: boolean
  /** True when the crossing lies ahead of both cameras (not behind them). */
  inFront: boolean
  /** True when the fix is usable: a point, ahead of both cameras, not weak. */
  ok: boolean
  /** Metres from each ray origin to the crossing (for ray drawing). */
  distancesM: [number, number]
}

const DEG = Math.PI / 180

interface XY {
  x: number
  y: number
}

/** Project a point to local metres (east, north) about a reference latitude. */
export function toLocal(ref: LatLng, p: LatLng): XY {
  const cos0 = Math.cos(ref.lat * DEG)
  return {
    x: (p.lng - ref.lng) * DEG * EARTH_RADIUS_M * cos0,
    y: (p.lat - ref.lat) * DEG * EARTH_RADIUS_M,
  }
}

/** Inverse of {@link toLocal}. */
export function toLatLng(ref: LatLng, xy: XY): LatLng {
  const cos0 = Math.cos(ref.lat * DEG)
  return {
    lat: ref.lat + xy.y / (EARTH_RADIUS_M * DEG),
    lng: ref.lng + xy.x / (EARTH_RADIUS_M * DEG * cos0),
  }
}

/** Unit vector (east, north) for a compass bearing. */
export function bearingToVector(bearingDeg: number): XY {
  const r = bearingDeg * DEG
  return { x: Math.sin(r), y: Math.cos(r) }
}

/** A point a given distance along a bearing from an origin (planar approx). */
export function destinationPoint(
  origin: LatLng,
  bearingDeg: number,
  distM: number,
): LatLng {
  const v = bearingToVector(bearingDeg)
  return toLatLng(origin, { x: v.x * distM, y: v.y * distM })
}

/** Great-ish-circle planar distance in metres between two points. */
export function distanceM(a: LatLng, b: LatLng): number {
  const ref = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
  const pa = toLocal(ref, a)
  const pb = toLocal(ref, b)
  return Math.hypot(pa.x - pb.x, pa.y - pb.y)
}

/**
 * Cross two rays and report the fix with an honest quality assessment.
 */
export function intersectRays(a: RayInput, b: RayInput): Resection {
  const ref: LatLng = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
  const A = toLocal(ref, a)
  const B = toLocal(ref, b)
  const d1 = bearingToVector(a.bearingDeg)
  const d2 = bearingToVector(b.bearingDeg)

  // Acute crossing angle from the directions.
  const dot = Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y))
  const between = Math.acos(dot) / DEG // 0..180
  const acute = Math.min(between, 180 - between) // 0..90
  const weak = acute < WEAK_CROSSING_DEG
  const quality = Math.sin(acute * DEG)

  // Solve A + t d1 = B + u d2.
  const det = d2.x * d1.y - d1.x * d2.y
  if (Math.abs(det) < 1e-9) {
    return {
      point: null,
      crossingAngleDeg: acute,
      quality,
      weak: true,
      inFront: false,
      ok: false,
      distancesM: [0, 0],
    }
  }
  const rx = B.x - A.x
  const ry = B.y - A.y
  const t = (-rx * d2.y + d2.x * ry) / det
  const u = (-rx * d1.y + d1.x * ry) / det
  const inFront = t > 0 && u > 0

  const point = toLatLng(ref, { x: A.x + t * d1.x, y: A.y + t * d1.y })
  return {
    point,
    crossingAngleDeg: acute,
    quality,
    weak,
    inFront,
    ok: !weak && inFront,
    distancesM: [Math.abs(t), Math.abs(u)],
  }
}

export interface ResectionInput {
  id: string
  lat: number
  lng: number
  bearingDeg: number
}

export interface ResectionSet {
  /** Best usable pairwise fix, or the best available if none is fully usable. */
  best: Resection | null
  bestPair?: [string, string]
  /** Every pairwise crossing, for showing a cluster and its spread. */
  pairs: { a: string; b: string; resection: Resection }[]
  /** Usable crossing points only (ok === true). */
  points: LatLng[]
  /** Spread of the usable points in metres (0 or 1 point => 0). */
  spreadM: number
}

/**
 * Resect from any number of vantages. Computes every pairwise crossing, keeps
 * the usable ones, and offers the strongest (largest crossing angle) as the
 * candidate. With three or more vantages the spread of the crossings is a
 * rough check on the fix.
 */
export function resect(vantages: ResectionInput[]): ResectionSet {
  const pairs: { a: string; b: string; resection: Resection }[] = []
  for (let i = 0; i < vantages.length; i++) {
    for (let j = i + 1; j < vantages.length; j++) {
      pairs.push({
        a: vantages[i].id,
        b: vantages[j].id,
        resection: intersectRays(vantages[i], vantages[j]),
      })
    }
  }
  const usable = pairs.filter((p) => p.resection.ok && p.resection.point)
  const points = usable.map((p) => p.resection.point as LatLng)

  let best: Resection | null = null
  let bestPair: [string, string] | undefined
  const ranked = (usable.length ? usable : pairs)
    .slice()
    .sort((x, y) => y.resection.quality - x.resection.quality)
  if (ranked.length) {
    best = ranked[0].resection
    bestPair = [ranked[0].a, ranked[0].b]
  }

  let spreadM = 0
  if (points.length > 1) {
    const cx = points.reduce((s, p) => s + p.lng, 0) / points.length
    const cy = points.reduce((s, p) => s + p.lat, 0) / points.length
    const centroid = { lat: cy, lng: cx }
    spreadM = Math.max(...points.map((p) => distanceM(centroid, p)))
  }

  return { best, bestPair, pairs, points, spreadM }
}

/**
 * The field-of-view cone for a vantage, as a closed ring of [lng, lat] for a
 * deck.gl PolygonLayer. Returns null when there is no field of view to draw.
 */
export function fovConeRing(
  vantage: RayInput & { fovDeg?: number },
  lengthM: number,
): [number, number][] | null {
  if (!vantage.fovDeg || vantage.fovDeg <= 0) return null
  const origin: LatLng = { lat: vantage.lat, lng: vantage.lng }
  const half = vantage.fovDeg / 2
  const steps = 12
  const ring: [number, number][] = [[origin.lng, origin.lat]]
  for (let i = 0; i <= steps; i++) {
    const bearing = vantage.bearingDeg - half + (vantage.fovDeg * i) / steps
    const p = destinationPoint(origin, bearing, lengthM)
    ring.push([p.lng, p.lat])
  }
  ring.push([origin.lng, origin.lat])
  return ring
}
