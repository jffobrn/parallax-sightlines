/**
 * The consent boundary (shared core): publicClone.
 *
 * This is the contribution the suite makes over straight counter-forensics:
 * consent enforced by architecture, not by discipline. ONE function produces
 * every export and every published view. It takes the full project and returns
 * a sanitized copy in which:
 *
 *   - sources that are not `public` (restricted, embargoed) are dropped;
 *   - provider names are reduced to stable aliases;
 *   - provenance and held filenames are removed;
 *   - coordinates are withheld (or coarsened) wherever `safeToPublish` is false;
 *   - findings keep only support from surviving sources, and a finding left
 *     with no support is dropped, because an unsupported claim is not a finding.
 *
 * Sensitive data cannot leak by accident because nothing sensitive crosses this
 * boundary: the public types in `types.ts` simply do not have fields for it.
 *
 * The function is pure and synchronous. It takes no clock and no I/O so it is
 * trivially testable; the caller stamps `generatedAt` and supplies thumbnails.
 */

import type {
  Finding,
  GeoPoint,
  Project,
  PublicFile,
  PublicFinding,
  PublicGeoPoint,
  PublicIncident,
  PublicLink,
  PublicProject,
  PublicSource,
  PublicVantage,
  Redactions,
  Source,
  Vantage,
} from './types'

export type UnsafeCoordinatePolicy = 'withhold' | 'coarsen'

export interface PublicCloneOptions {
  /** What to do with a point whose safeToPublish is false. Default: withhold. */
  unsafeCoordinatePolicy?: UnsafeCoordinatePolicy
  /** Decimal places when coarsening an unsafe point. Default 2 (~1.1 km). */
  coarsenDecimals?: number
  /** Precision cap applied to safe coordinates too. Default 5 (~1.1 m). */
  roundSafeDecimals?: number
  /** Pre-generated thumbnails (data URLs) keyed by source id, public only. */
  thumbnails?: Record<string, string>
  /** Timestamp to stamp on the output; the caller owns the clock. */
  generatedAt?: string
}

const DEFAULTS = {
  unsafeCoordinatePolicy: 'withhold' as UnsafeCoordinatePolicy,
  coarsenDecimals: 2,
  roundSafeDecimals: 5,
}

function roundTo(n: number, decimals: number): number {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

/** Stable alias generator: A, B, ... Z, AA, AB, ... */
function aliasFor(index: number): string {
  let i = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (i % 26)) + s
    i = Math.floor(i / 26) - 1
  } while (i >= 0)
  return `Source ${s}`
}

export function publicClone(
  project: Project,
  options: PublicCloneOptions = {},
): PublicProject {
  const opts = { ...DEFAULTS, ...options }
  const redactions: Redactions = {
    sourcesDropped: 0,
    droppedByConsent: { restricted: 0, embargoed: 0 },
    providersAliased: 0,
    coordinatesWithheld: 0,
    coordinatesCoarsened: 0,
    findingsDropped: 0,
    findingsSupportReduced: 0,
  }

  // 1. Keep only public sources.
  const publicSources: Source[] = []
  for (const s of project.sources) {
    if (s.consent === 'public') {
      publicSources.push(s)
    } else {
      redactions.sourcesDropped++
      if (s.consent === 'restricted') redactions.droppedByConsent.restricted++
      if (s.consent === 'embargoed') redactions.droppedByConsent.embargoed++
    }
  }
  const survivingIds = new Set(publicSources.map((s) => s.id))

  // 2. Provider -> alias, stable in source order, shared across same provider.
  const aliasByProvider = new Map<string, string>()
  for (const s of publicSources) {
    if (s.provider && !aliasByProvider.has(s.provider)) {
      aliasByProvider.set(s.provider, aliasFor(aliasByProvider.size))
    }
  }
  // Count distinct provider names reduced, not sources, so the disclosure is honest.
  redactions.providersAliased = aliasByProvider.size

  // Coordinate handling, shared by every point. Returns undefined when withheld.
  const cleanPoint = (p?: GeoPoint): PublicGeoPoint | undefined => {
    if (!p) return undefined
    // Invalid coordinates are simply absent; they are not a safety withholding.
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return undefined
    if (p.safeToPublish) {
      return {
        lat: roundTo(p.lat, opts.roundSafeDecimals),
        lng: roundTo(p.lng, opts.roundSafeDecimals),
      }
    }
    if (opts.unsafeCoordinatePolicy === 'coarsen') {
      redactions.coordinatesCoarsened++
      return {
        lat: roundTo(p.lat, opts.coarsenDecimals),
        lng: roundTo(p.lng, opts.coarsenDecimals),
        coarsened: true,
      }
    }
    redactions.coordinatesWithheld++
    return undefined
  }

  const cleanVantage = (v?: Vantage): PublicVantage | undefined => {
    if (!v) return undefined
    const base = cleanPoint(v)
    if (!base) return undefined // no origin => no ray to draw
    return {
      ...base,
      bearingDeg: v.bearingDeg,
      fovDeg: v.fovDeg,
      confidence: v.confidence,
    }
  }

  const cleanSource = (s: Source): PublicSource => {
    const file: PublicFile | undefined = s.file
      ? {
          mime: s.file.mime,
          bytes: s.file.bytes,
          sha256: s.file.sha256,
          w: s.file.w,
          h: s.file.h,
          thumbnailDataUrl: opts.thumbnails?.[s.id],
        }
      : undefined
    const link: PublicLink | undefined = s.link
      ? {
          url: s.link.url,
          archivedUrl: s.link.archivedUrl,
          archivedSha256: s.link.archivedSha256,
          archivedAt: s.link.archivedAt,
        }
      : undefined
    return {
      id: s.id,
      kind: s.kind,
      title: s.title,
      datetime: s.datetime,
      providerAlias: s.provider ? aliasByProvider.get(s.provider) : undefined,
      file,
      link,
      subject: cleanPoint(s.subject),
      vantage: cleanVantage(s.vantage),
      rights: s.rights,
      note: s.note,
      // Intentionally omitted: provider (real name), provenance, file.name,
      // file.blobKey, consent flag.
    }
  }

  const sources = publicSources.map(cleanSource)

  // 3. Findings keep only surviving support; an unsupported finding is dropped.
  const cleanFinding = (f: Finding): PublicFinding | null => {
    const supportedBy = f.supportedBy.filter((id) => survivingIds.has(id))
    if (supportedBy.length === 0) {
      redactions.findingsDropped++
      return null
    }
    if (supportedBy.length < f.supportedBy.length) {
      redactions.findingsSupportReduced++
    }
    return {
      id: f.id,
      statement: f.statement,
      supportedBy,
      certainty: f.certainty,
      at: f.at
        ? { time: f.at.time, place: cleanPoint(f.at.place) }
        : undefined,
    }
  }
  const findings = project.findings
    .map(cleanFinding)
    .filter((f): f is PublicFinding => f !== null)

  // 4. Incident, with the same coordinate discipline on its place.
  const incidentPlacePublic = project.incident.place
    ? cleanPoint(project.incident.place)
    : undefined
  const incident: PublicIncident = {
    id: project.incident.id,
    titles: project.incident.titles,
    type: project.incident.type,
    place:
      project.incident.place && incidentPlacePublic
        ? { ...incidentPlacePublic, name: project.incident.place.name }
        : undefined,
    window: project.incident.window,
    summary: project.incident.summary,
    tags: project.incident.tags,
  }

  return {
    incident,
    sources,
    findings,
    redactions,
    generatedAt: opts.generatedAt,
  }
}

/** Human-readable lines describing what the boundary removed, for disclosure. */
export function redactionLines(r: Redactions): string[] {
  const lines: string[] = []
  if (r.sourcesDropped > 0) {
    const parts: string[] = []
    if (r.droppedByConsent.embargoed)
      parts.push(`${r.droppedByConsent.embargoed} embargoed`)
    if (r.droppedByConsent.restricted)
      parts.push(`${r.droppedByConsent.restricted} restricted`)
    lines.push(
      `${r.sourcesDropped} source${r.sourcesDropped === 1 ? '' : 's'} withheld (${parts.join(', ')})`,
    )
  }
  if (r.providersAliased > 0)
    lines.push(`${r.providersAliased} provider name${r.providersAliased === 1 ? '' : 's'} reduced to aliases`)
  if (r.coordinatesWithheld > 0)
    lines.push(`${r.coordinatesWithheld} coordinate${r.coordinatesWithheld === 1 ? '' : 's'} withheld as unsafe to publish`)
  if (r.coordinatesCoarsened > 0)
    lines.push(`${r.coordinatesCoarsened} coordinate${r.coordinatesCoarsened === 1 ? '' : 's'} coarsened`)
  if (r.findingsDropped > 0)
    lines.push(`${r.findingsDropped} finding${r.findingsDropped === 1 ? '' : 's'} dropped for lack of public support`)
  if (r.findingsSupportReduced > 0)
    lines.push(`${r.findingsSupportReduced} finding${r.findingsSupportReduced === 1 ? '' : 's'} kept with reduced support`)
  if (lines.length === 0) lines.push('Nothing required redaction.')
  return lines
}
