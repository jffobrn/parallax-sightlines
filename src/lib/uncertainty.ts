/**
 * Resection uncertainty (Sightlines): a crossing is only as sharp as the bearings
 * that make it. This perturbs each vantage's bearing by an angular uncertainty
 * (from its confidence), recomputes the fix many times, and fits a 95% error
 * ellipse to the resulting cloud, so the map can show how tightly the location is
 * actually pinned rather than a false point. Deterministic (seeded) so the ellipse
 * is stable across redraws.
 */

import { resect, type Certainty, type ResectionInput } from '../core'

const DEG = Math.PI / 180
const EARTH_R = 6371000
// Chi-square, 2 dof, 95%: sqrt(5.991) scales 1-sigma axes to the 95% ellipse.
const K95 = Math.sqrt(5.991)

/** One-sigma bearing uncertainty (degrees) implied by a placement confidence. */
export function sigmaForConfidence(c: Certainty): number {
  return c === 'attested' ? 1 : c === 'uncertain' ? 6 : 3
}

export interface EllipseInput extends ResectionInput {
  sigmaDeg: number
}

export interface UncertaintyEllipse {
  center: [number, number]
  /** Closed ring [lng, lat] for drawing. */
  ring: [number, number][]
  semiMajorM: number
  semiMinorM: number
  angleDeg: number
  /** How many perturbed samples produced a usable fix. */
  n: number
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gauss(rng: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Fit a 95% error ellipse to the resected fix under bearing uncertainty. */
export function resectionEllipse(
  inputs: EllipseInput[],
  samples = 400,
): UncertaintyEllipse | null {
  const usable = inputs.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng))
  if (usable.length < 2) return null

  let seed = usable.length
  for (const i of usable) {
    seed = (seed * 31 + Math.round((i.lat + i.lng + i.bearingDeg) * 1000)) | 0
  }
  const rng = mulberry32(seed)

  const pts: [number, number][] = []
  for (let s = 0; s < samples; s++) {
    const perturbed: ResectionInput[] = usable.map((i) => ({
      id: i.id,
      lat: i.lat,
      lng: i.lng,
      bearingDeg: i.bearingDeg + gauss(rng) * i.sigmaDeg,
    }))
    const best = resect(perturbed).best
    if (best?.point) pts.push([best.point.lng, best.point.lat])
  }
  if (pts.length < 20) return null

  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  const cos0 = Math.cos(cy * DEG)

  // Sample covariance in local metres about the mean.
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of pts) {
    const x = (p[0] - cx) * DEG * EARTH_R * cos0
    const y = (p[1] - cy) * DEG * EARTH_R
    sxx += x * x
    syy += y * y
    sxy += x * y
  }
  const n = pts.length
  sxx /= n
  syy /= n
  sxy /= n

  const tr = sxx + syy
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - (sxx * syy - sxy * sxy)))
  const l1 = tr / 2 + disc
  const l2 = tr / 2 - disc
  const semiMajorM = K95 * Math.sqrt(Math.max(0, l1))
  const semiMinorM = K95 * Math.sqrt(Math.max(0, l2))
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy)

  const ring: [number, number][] = []
  const steps = 48
  for (let t = 0; t <= steps; t++) {
    const th = (2 * Math.PI * t) / steps
    const ex = semiMajorM * Math.cos(th)
    const ey = semiMinorM * Math.sin(th)
    const rx = ex * Math.cos(ang) - ey * Math.sin(ang)
    const ry = ex * Math.sin(ang) + ey * Math.cos(ang)
    ring.push([cx + rx / (DEG * EARTH_R * cos0), cy + ry / (DEG * EARTH_R)])
  }

  return { center: [cx, cy], ring, semiMajorM, semiMinorM, angleDeg: ang / DEG, n: pts.length }
}
