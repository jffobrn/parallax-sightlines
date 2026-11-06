/**
 * Zones of possible origin. A source with a placed vantage can say of an event
 * "its origin lies somewhere between these two bearings": the trace in a frame
 * bounded by the frame's edges, or the direction a sound was heard from. Each
 * such band is a wedge from the vantage out to a stated range. Where several
 * sources see the same event, the wedges intersect, and the intersection is
 * the zone the origin must lie in. A bounded region, not a best guess: a point
 * outside it contradicts at least one source.
 *
 * Computed in a local metric plane around the first vantage; the wedges are
 * convex (bands under 180 degrees), so the intersection is convex too.
 */

import { bearingToVector, toLatLng, toLocal, type LatLng } from '../core/geo'
import type { SyncEvent } from '../core/types'

/** The fields the zones read; a Source and a PublicSource both qualify. */
export interface ZoneInput {
  sources: { id: string; vantage?: { lat: number; lng: number } }[]
  syncEvents?: SyncEvent[]
}

export const DEFAULT_RANGE_M = 3000
const ARC_STEP_DEG = 4

type XY = { x: number; y: number }

export interface OriginZone {
  eventId: string
  /** Closed ring of [lng, lat], ready for a polygon layer. */
  ring: [number, number][]
  areaM2: number
  /** How many wedges were intersected; one means the zone is a single band. */
  wedges: number
  /** True when the wedges do not overlap at all: the readings contradict. */
  empty: boolean
}

export interface Wedge {
  eventId: string
  sourceId: string
  ring: [number, number][]
}

/** Clockwise span from a to b in degrees, in [0, 360). */
const span = (a: number, b: number) => (((b - a) % 360) + 360) % 360

function wedgeXY(apex: XY, fromDeg: number, toDeg: number, rangeM: number): XY[] | null {
  const s = span(fromDeg, toDeg)
  if (s <= 0 || s >= 180) return null
  const pts: XY[] = [apex]
  const steps = Math.max(1, Math.ceil(s / ARC_STEP_DEG))
  for (let k = 0; k <= steps; k++) {
    const v = bearingToVector(fromDeg + (s * k) / steps)
    pts.push({ x: apex.x + v.x * rangeM, y: apex.y + v.y * rangeM })
  }
  return pts
}

const signedArea = (p: XY[]) => {
  let a = 0
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length
    a += p[i].x * p[j].y - p[j].x * p[i].y
  }
  return a / 2
}
const ccw = (p: XY[]) => (signedArea(p) < 0 ? [...p].reverse() : p)

/** Sutherland-Hodgman: clip a convex subject by a convex clip polygon (both CCW). */
function clip(subject: XY[], clipPoly: XY[]): XY[] {
  let out = subject
  for (let i = 0; i < clipPoly.length && out.length; i++) {
    const a = clipPoly[i]
    const b = clipPoly[(i + 1) % clipPoly.length]
    const inside = (p: XY) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0
    const cut = (p: XY, q: XY): XY => {
      const d = (b.x - a.x) * (q.y - p.y) - (b.y - a.y) * (q.x - p.x)
      const t = ((b.x - a.x) * (a.y - p.y) - (b.y - a.y) * (a.x - p.x)) / d
      return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) }
    }
    const input = out
    out = []
    for (let k = 0; k < input.length; k++) {
      const p = input[k]
      const q = input[(k + 1) % input.length]
      if (inside(q)) {
        if (!inside(p)) out.push(cut(p, q))
        out.push(q)
      } else if (inside(p)) {
        out.push(cut(p, q))
      }
    }
  }
  return out
}

function bands(project: ZoneInput, e: SyncEvent) {
  const byId = new Map(project.sources.map((s) => [s.id, s]))
  return e.observations
    .map((o) => ({ o, v: byId.get(o.sourceId)?.vantage }))
    .filter(
      (x): x is { o: typeof x.o; v: NonNullable<typeof x.v> } =>
        !!x.v && Number.isFinite(x.v.lat) && Number.isFinite(x.v.lng) &&
        Number.isFinite(x.o.bearingFromDeg) && Number.isFinite(x.o.bearingToDeg),
    )
}

/** Every drawable wedge, for the map. */
export function eventWedges(project: ZoneInput): Wedge[] {
  const out: Wedge[] = []
  for (const e of project.syncEvents ?? []) {
    for (const { o, v } of bands(project, e)) {
      const ref: LatLng = { lat: v.lat, lng: v.lng }
      const xy = wedgeXY({ x: 0, y: 0 }, o.bearingFromDeg!, o.bearingToDeg!, o.maxRangeM ?? DEFAULT_RANGE_M)
      if (!xy) continue
      const ring = xy.map((p) => {
        const ll = toLatLng(ref, p)
        return [ll.lng, ll.lat] as [number, number]
      })
      ring.push(ring[0])
      out.push({ eventId: e.id, sourceId: o.sourceId, ring })
    }
  }
  return out
}

/** The zone of possible origin for every event with at least one band. */
export function originZones(project: ZoneInput): OriginZone[] {
  const zones: OriginZone[] = []
  for (const e of project.syncEvents ?? []) {
    const bs = bands(project, e)
    if (bs.length === 0) continue
    const ref: LatLng = { lat: bs[0].v.lat, lng: bs[0].v.lng }
    const polys = bs
      .map(({ o, v }) => wedgeXY(toLocal(ref, v), o.bearingFromDeg!, o.bearingToDeg!, o.maxRangeM ?? DEFAULT_RANGE_M))
      .filter((p): p is XY[] => !!p)
      .map(ccw)
    if (polys.length === 0) continue
    let zone = polys[0]
    for (let i = 1; i < polys.length && zone.length; i++) zone = clip(zone, polys[i])
    const empty = zone.length < 3
    const ring = empty
      ? []
      : [...zone, zone[0]].map((p) => {
          const ll = toLatLng(ref, p)
          return [ll.lng, ll.lat] as [number, number]
        })
    zones.push({ eventId: e.id, ring, areaM2: empty ? 0 : Math.abs(signedArea(zone)), wedges: polys.length, empty })
  }
  return zones
}
