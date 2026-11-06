/**
 * Derived state: computed from the project, never stored as truth. The map, the
 * timeline, and the published artifact all read from here so they agree.
 */

import {
  resect,
  timeInterval,
  type Certainty,
  type Consent,
  type Project,
  type PublicProject,
  type ResectionInput,
  type ResectionSet,
  type SourceKind,
} from '../core'
import { solveClocks } from './clock'

/** Vantages with a usable origin and bearing, as resection inputs. */
export function projectVantages(
  project: Pick<Project, 'sources'>,
): ResectionInput[] {
  const out: ResectionInput[] = []
  for (const s of project.sources) {
    const v = s.vantage
    if (v && Number.isFinite(v.lat) && Number.isFinite(v.lng)) {
      out.push({ id: s.id, lat: v.lat, lng: v.lng, bearingDeg: v.bearingDeg })
    }
  }
  return out
}

export function getResection(project: Pick<Project, 'sources'>): ResectionSet {
  return resect(projectVantages(project))
}

export interface TimelineItem {
  id: string
  /** 'synced' is a source's media span on the aligned clock, beside its claim. */
  kind: 'source' | 'finding' | 'synced'
  /** For a synced span: the source it belongs to. */
  sourceId?: string
  /** For a synced span: the start's standard error, in ms. */
  sigmaMs?: number
  /** For a synced span: the source's own claimed time disagrees. */
  conflict?: boolean
  sourceKind?: SourceKind
  label: string
  start: number
  end: number
  hasTime: boolean
  certainty?: Certainty
  consent?: Consent
}

/** Timeline items from sources (by datetime) and findings (by at.time). */
export function timelineItems(
  project: Project | PublicProject,
): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const s of project.sources) {
    if (!s.datetime) continue
    const iv = timeInterval(s.datetime.value, s.datetime.precision)
    if (!iv) continue
    items.push({
      id: s.id,
      kind: 'source',
      sourceKind: s.kind,
      label: s.title,
      start: iv.start,
      end: iv.end,
      hasTime: true,
      consent: 'consent' in s ? (s as { consent?: Consent }).consent : undefined,
    })
  }
  // Synced spans: only anchored sources have an absolute place on the clock;
  // a floating group is shown in the Clock view, relative to its reference.
  const clocks = solveClocks(project)
  for (const s of project.sources) {
    const c = clocks.sources[s.id]
    if (!c || !c.anchored) continue
    const start = c.startSec * 1000
    items.push({
      id: 'synced:' + s.id,
      kind: 'synced',
      sourceId: s.id,
      sourceKind: s.kind,
      label: s.title,
      start,
      end: start + (c.durationSec ?? 0) * 1000,
      hasTime: true,
      sigmaMs: c.sigmaSec * 1000,
      conflict: !!c.claimConflict,
      consent: 'consent' in s ? (s as { consent?: Consent }).consent : undefined,
    })
  }
  for (const f of project.findings) {
    if (!f.at?.time) continue
    const t = Date.parse(f.at.time)
    if (Number.isNaN(t)) continue
    items.push({
      id: f.id,
      kind: 'finding',
      label: f.statement,
      start: t,
      end: t,
      hasTime: true,
      certainty: f.certainty,
    })
  }
  return items.sort((a, b) => a.start - b.start)
}

/** Overall time extent across the incident window and every dated item. */
export function timeExtent(
  project: Project | PublicProject,
): [number, number] | null {
  const points: number[] = []
  const w = project.incident.window
  if (w.start) {
    const t = Date.parse(w.start)
    if (!Number.isNaN(t)) points.push(t)
  }
  if (w.end) {
    const t = Date.parse(w.end)
    if (!Number.isNaN(t)) points.push(t)
  }
  for (const it of timelineItems(project)) {
    points.push(it.start, it.end)
  }
  if (points.length === 0) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  if (min === max) return [min - 3_600_000, max + 3_600_000]
  return [min, max]
}
