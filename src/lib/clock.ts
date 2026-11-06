/**
 * Clock alignment: put many sources on one clock from the events they share.
 *
 * Each observation says: event e appears in source s at media time m, read to
 * within u seconds. With S_s the absolute start of source s and T_e the true
 * time of event e, every observation is one equation T_e - S_s = m (weight
 * 1/u^2), and every trusted anchor is one more, S_a = A (weight 1/u^2). The
 * weighted least-squares solution gives each source's start and each event's
 * time with a standard error.
 *
 * Sources that share no chain of events with an anchor cannot be placed in
 * absolute time. Such a group is still aligned internally, relative to a
 * reference source, and reported as floating rather than given a false clock.
 *
 * With redundancy (more equations than unknowns), readings are screened one at
 * a time: the worst-fitting observation, if it exceeds three times its own
 * stated uncertainty, is set aside and the clocks refitted, until the rest
 * agree. A flagged reading is one the remaining evidence cannot accommodate,
 * which may mark a splice, an edit, a mislabelled clip, or a misread; it is
 * reported against the clean fit, at its full disagreement. Without
 * redundancy nothing can be flagged, and the result says so rather than
 * implying agreement.
 *
 * Pure and synchronous; derived at read time, never stored as fact.
 */

import { timeInterval } from '../core/time'
import type { MediaClock, SyncEvent, TimePrecision } from '../core/types'

/** The fields the solver reads; a Source and a PublicSource both qualify. */
export interface ClockSourceInput {
  id: string
  datetime?: { value: string; precision: TimePrecision }
  clock?: MediaClock
}
export interface ClockInput {
  sources: ClockSourceInput[]
  syncEvents?: SyncEvent[]
}

/** Floor on any stated uncertainty, so a typed 0 cannot claim infinite weight. */
const MIN_UNCERTAINTY_SEC = 0.01
/** Weight of the gauge row fixing a floating group's reference source at 0. */
const GAUGE_WEIGHT = 1e12
/** A residual beyond this many of its own uncertainties is flagged. */
const FLAG_Z = 3

export interface ClockedSource {
  sourceId: string
  group: number
  /** True when the group reaches an anchor: the start is absolute (epoch s). */
  anchored: boolean
  /** For a floating group, the source the others are measured from. */
  refSourceId?: string
  /** Absolute start (epoch seconds) when anchored; else seconds from the ref's start. */
  startSec: number
  sigmaSec: number
  durationSec?: number
  /**
   * Anchored sources only: the source's own claimed datetime, when the synced
   * start (plus or minus two sigma) falls outside it. Shown, never overwritten.
   */
  claimConflict?: { claimedStartMs: number; claimedEndMs: number }
}

export interface ClockedEvent {
  eventId: string
  group: number
  anchored: boolean
  refSourceId?: string
  timeSec: number
  sigmaSec: number
}

export interface ClockResidual {
  eventId: string
  sourceId: string
  residualSec: number
  /** Residual in units of the observation's own stated uncertainty. */
  z: number
  flagged: boolean
  /**
   * True when the event has only two readings: they disagree equally and
   * oppositely, so the evidence shows the event is inconsistent but cannot
   * say which reading is wrong. Name the event, never the source.
   */
  ambiguous: boolean
}

export interface ClockGroup {
  id: number
  anchored: boolean
  refSourceId?: string
  sourceIds: string[]
  eventIds: string[]
  /** Equations minus unknowns; zero means no internal check is possible. */
  redundancy: number
  /** Sigma inflation applied when the readings scatter more than stated. */
  scatterFactor: number
}

export interface ClockSolution {
  sources: Record<string, ClockedSource>
  events: Record<string, ClockedEvent>
  residuals: ClockResidual[]
  groups: ClockGroup[]
}

type Row = { cols: [number, number][]; rhs: number; w: number; obs?: { eventId: string; sourceId: string; u: number } }

const isoToSec = (iso: string): number => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? NaN : t / 1000
}

/** Solve a small dense symmetric positive-definite system, returning x and N^-1. */
function solveWithInverse(N: number[][], b: number[]): { x: number[]; inv: number[][] } | null {
  const n = N.length
  const a = N.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  const y = [...b]
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r
    if (Math.abs(a[p][c]) < 1e-18) return null
    ;[a[c], a[p]] = [a[p], a[c]]
    ;[y[c], y[p]] = [y[p], y[c]]
    const d = a[c][c]
    for (let k = 0; k < 2 * n; k++) a[c][k] /= d
    y[c] /= d
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = a[r][c]
      if (f === 0) continue
      for (let k = 0; k < 2 * n; k++) a[r][k] -= f * a[c][k]
      y[r] -= f * y[c]
    }
  }
  return { x: y, inv: a.map((row) => row.slice(n)) }
}

export function solveClocks(project: ClockInput): ClockSolution {
  const sourceById = new Map(project.sources.map((s) => [s.id, s]))
  const events: SyncEvent[] = (project.syncEvents ?? [])
    .map((e) => ({ ...e, observations: e.observations.filter((o) => sourceById.has(o.sourceId) && Number.isFinite(o.mediaTimeSec)) }))
    .filter((e) => e.observations.length > 0)

  // Sources that take part: any anchored source, any observed source.
  const involved: ClockSourceInput[] = project.sources.filter(
    (s) =>
      (s.clock?.anchor && Number.isFinite(isoToSec(s.clock.anchor.startIso))) ||
      events.some((e) => e.observations.some((o) => o.sourceId === s.id)),
  )

  // Union-find over sources and events, to split independent groups.
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    let r = k
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(k, r)
    return r
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))
  for (const s of involved) parent.set('s:' + s.id, 's:' + s.id)
  for (const e of events) {
    parent.set('e:' + e.id, 'e:' + e.id)
    for (const o of e.observations) union('e:' + e.id, 's:' + o.sourceId)
  }

  const groupsByRoot = new Map<string, { sources: ClockSourceInput[]; events: SyncEvent[] }>()
  for (const s of involved) {
    const r = find('s:' + s.id)
    if (!groupsByRoot.has(r)) groupsByRoot.set(r, { sources: [], events: [] })
    groupsByRoot.get(r)!.sources.push(s)
  }
  for (const e of events) {
    const r = find('e:' + e.id)
    groupsByRoot.get(r)?.events.push(e)
  }

  const out: ClockSolution = { sources: {}, events: {}, residuals: [], groups: [] }
  let gid = 0
  for (const { sources, events: evs } of groupsByRoot.values()) {
    gid++
    const anchors = sources.filter((s) => s.clock?.anchor && Number.isFinite(isoToSec(s.clock.anchor.startIso)))
    const anchored = anchors.length > 0
    const ref = anchored ? undefined : sources[0]
    const vIndex = new Map<string, number>()
    sources.forEach((s, i) => vIndex.set('s:' + s.id, i))
    evs.forEach((e, i) => vIndex.set('e:' + e.id, sources.length + i))
    const n = vIndex.size

    const rows: Row[] = []
    for (const e of evs) {
      for (const o of e.observations) {
        const u = Math.max(MIN_UNCERTAINTY_SEC, Number.isFinite(o.uncertaintySec) ? o.uncertaintySec : 1)
        rows.push({
          cols: [[vIndex.get('e:' + e.id)!, 1], [vIndex.get('s:' + o.sourceId)!, -1]],
          rhs: o.mediaTimeSec,
          w: 1 / (u * u),
          obs: { eventId: e.id, sourceId: o.sourceId, u },
        })
      }
    }
    for (const s of anchors) {
      const u = Math.max(MIN_UNCERTAINTY_SEC, s.clock!.anchor!.uncertaintySec || 0)
      rows.push({ cols: [[vIndex.get('s:' + s.id)!, 1]], rhs: isoToSec(s.clock!.anchor!.startIso), w: 1 / (u * u) })
    }
    if (ref) rows.push({ cols: [[vIndex.get('s:' + ref.id)!, 1]], rhs: 0, w: GAUGE_WEIGHT })

    // Normal equations, centred on a working origin so epoch seconds keep precision.
    const origin = anchored ? isoToSec(anchors[0].clock!.anchor!.startIso) : 0
    const fit = (use: Row[]) => {
      const N = Array.from({ length: n }, () => new Array<number>(n).fill(0))
      const b = new Array<number>(n).fill(0)
      for (const r of use) {
        // Every unknown is shifted by the origin; a row's rhs shifts by origin
        // times the sum of its coefficients (zero for a difference row).
        const coefSum = r.cols.reduce((acc, [, c]) => acc + c, 0)
        const rhs = r.rhs - origin * coefSum
        for (const [i, ci] of r.cols) {
          b[i] += r.w * ci * rhs
          for (const [j, cj] of r.cols) N[i][j] += r.w * ci * cj
        }
      }
      const sol = solveWithInverse(N, b)
      return sol ? { x: sol.x.map((v) => v + origin), inv: sol.inv } : null
    }
    const predict = (r: Row, x: number[]) => r.cols.reduce((acc, [i, c]) => acc + c * x[i], 0)
    const unknowns = anchored ? n : n - 1
    const isEvidence = (r: Row) => r.w !== GAUGE_WEIGHT

    // Screen outliers one at a time: while the readings over-determine the
    // clocks, drop the single worst-fitting observation if it exceeds three
    // of its own uncertainties, and refit. A bad reading then shows its full
    // disagreement instead of being smeared across the good ones, and stops
    // bending every clock in the group.
    let active = rows
    const flaggedRows: Row[] = []
    let sol = fit(active)
    if (!sol) continue
    for (;;) {
      const evidence = active.filter(isEvidence)
      if (evidence.length - unknowns <= 0) break
      let worst: Row | null = null
      let worstZ = 0
      for (const r of evidence) {
        if (!r.obs) continue
        const z = Math.abs((predict(r, sol.x) - r.rhs) / r.obs.u)
        if (z > worstZ) { worstZ = z; worst = r }
      }
      if (!worst || worstZ <= FLAG_Z) break
      const trial = active.filter((r) => r !== worst)
      // Never drop a reading that is the only tie of an event or a source.
      const stillTied = worst.cols.every(([i]) => trial.some((r) => r.cols.some(([j]) => j === i)))
      if (!stillTied) break
      const next = fit(trial)
      if (!next) break
      active = trial
      flaggedRows.push(worst)
      sol = next
    }
    const x = sol.x

    const readingsPerEvent = new Map(evs.map((e) => [e.id, e.observations.length]))
    let chi2 = 0
    const evidenceRows = active.filter(isEvidence)
    const redundancy = evidenceRows.length - unknowns
    const residuals: ClockResidual[] = []
    for (const r of evidenceRows) {
      const res = predict(r, x) - r.rhs
      chi2 += r.w * res * res
      if (r.obs) residuals.push({ eventId: r.obs.eventId, sourceId: r.obs.sourceId, residualSec: res, z: res / r.obs.u, flagged: false, ambiguous: false })
    }
    for (const r of flaggedRows) {
      const res = predict(r, x) - r.rhs
      residuals.push({ eventId: r.obs!.eventId, sourceId: r.obs!.sourceId, residualSec: res, z: res / r.obs!.u, flagged: true, ambiguous: readingsPerEvent.get(r.obs!.eventId) === 2 })
    }
    const scatterFactor = redundancy > 0 ? Math.max(1, Math.sqrt(chi2 / redundancy)) : 1
    out.residuals.push(...residuals)

    const inv = sol.inv
    const sigma = (i: number) => Math.sqrt(Math.max(0, inv[i][i])) * scatterFactor
    for (const s of sources) {
      const i = vIndex.get('s:' + s.id)!
      const cs: ClockedSource = {
        sourceId: s.id,
        group: gid,
        anchored,
        refSourceId: ref?.id,
        startSec: x[i],
        sigmaSec: ref && s.id === ref.id ? 0 : sigma(i),
        durationSec: s.clock?.durationSec,
      }
      if (anchored && s.datetime?.value) {
        const claimed = timeInterval(s.datetime.value, s.datetime.precision)
        if (claimed) {
          const lo = (cs.startSec - 2 * cs.sigmaSec) * 1000
          const hi = (cs.startSec + 2 * cs.sigmaSec) * 1000
          if (hi < claimed.start || lo > claimed.end) {
            cs.claimConflict = { claimedStartMs: claimed.start, claimedEndMs: claimed.end }
          }
        }
      }
      out.sources[s.id] = cs
    }
    for (const e of evs) {
      const i = vIndex.get('e:' + e.id)!
      out.events[e.id] = { eventId: e.id, group: gid, anchored, refSourceId: ref?.id, timeSec: x[i], sigmaSec: sigma(i) }
    }
    out.groups.push({
      id: gid,
      anchored,
      refSourceId: ref?.id,
      sourceIds: sources.map((s) => s.id),
      eventIds: evs.map((e) => e.id),
      redundancy,
      scatterFactor,
    })
  }
  return out
}

/** The absolute time (epoch seconds) of a moment inside a synced source, if known. */
export function syncedMoment(sol: ClockSolution, sourceId: string, mediaTimeSec: number): { timeSec: number; sigmaSec: number } | null {
  const s = sol.sources[sourceId]
  if (!s || !s.anchored) return null
  return { timeSec: s.startSec + mediaTimeSec, sigmaSec: s.sigmaSec }
}
