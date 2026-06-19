/**
 * Sightlines / Parallax suite: the typed data model.
 *
 * This is shared core. Later Parallax tools (Atlas, Situated Testimony,
 * Verification) reuse these shapes, the consent boundary in `consent.ts`, the
 * hashing in `hash.ts`, and the geometry in `geo.ts`. Keep it a clean module
 * with no UI or framework imports.
 *
 * A note on truth: only the project (incident, sources, findings) is stored.
 * Everything derived (timeline order, map layers, resected intersections, the
 * narrative) is computed at read time, never persisted as fact.
 */

/** Whether a source may appear in anything published. */
export type Consent = 'public' | 'restricted' | 'embargoed'

/** How sure an assertion or a placement is. */
export type Certainty = 'attested' | 'probable' | 'uncertain'

/** A datetime carries the precision it was actually known to, never more. */
export type TimePrecision = 'minute' | 'hour' | 'day' | 'approximate'

export type SourceKind =
  | 'photograph'
  | 'video-link'
  | 'document'
  | 'testimony'
  | 'audio'

export type IncidentType =
  | 'shelling'
  | 'fire'
  | 'raid'
  | 'demolition'
  | 'protest'
  | 'looting'
  | 'destruction-of-work'
  | 'dispersal'
  | 'other'

/** A point on the ground, with a per-point decision about publication. */
export interface GeoPoint {
  lat: number
  lng: number
  /** When false, the consent boundary withholds or coarsens this point. */
  safeToPublish: boolean
}

/**
 * A camera position. The bearing is the compass direction (degrees, 0 = north,
 * clockwise) the camera looked along. An optional field of view widens the ray
 * into a cone; confidence records how sure the placement is.
 */
export interface Vantage extends GeoPoint {
  bearingDeg: number
  fovDeg?: number
  confidence: Certainty
}

/** A title in one language, so a record can be multilingual (including RTL). */
export interface LocalizedText {
  text: string
  /** BCP-47-ish language tag, e.g. 'en', 'ar'. Direction is derived per string. */
  lang: string
}

export interface Incident {
  id: string
  titles: LocalizedText[]
  type: IncidentType
  place?: GeoPoint & { name?: string }
  window: { start?: string; end?: string; precision: TimePrecision }
  summary?: string
  tags: string[]
}

/** Bytes actually held on the user's machine, with their fixity hash. */
export interface HeldFile {
  name: string
  mime: string
  bytes: number
  /** Lowercase hex sha-256 of the held bytes (Berkeley Protocol fixity). */
  sha256: string
  w?: number
  h?: number
  /** Key into the media store (IndexedDB). Not part of the evidentiary record. */
  blobKey?: string
}

/** A link to material not downloaded (video). We can only hash what we hold. */
export interface ExternalLink {
  url: string
  archivedUrl?: string
  /** sha-256 of the archived snapshot we hold, never of the remote bytes. */
  archivedSha256?: string
  archivedAt?: string
}

export interface Source {
  id: string
  kind: SourceKind
  title: string
  datetime?: { value: string; precision: TimePrecision }
  /** Who provided it. Reduced to an alias in anything published. */
  provider?: string
  /** Origin and how obtained. Withheld from anything published. */
  provenance?: string
  file?: HeldFile
  link?: ExternalLink
  /** Where the depicted thing is. */
  subject?: GeoPoint
  /** Where the camera was, and which way it looked. */
  vantage?: Vantage
  consent: Consent
  rights?: string
  note?: string
}

export interface Finding {
  id: string
  statement: string
  /** Source ids this assertion rests on. A finding with no support is not kept. */
  supportedBy: string[]
  certainty: Certainty
  at?: { time?: string; place?: GeoPoint }
}

export interface Project {
  incident: Incident
  sources: Source[]
  findings: Finding[]
}

// --- Export envelope -------------------------------------------------------

export const SCHEMA_VERSION = 1

/**
 * The full project as written to a single file (the user's own keeping). This
 * is the one output that is NOT sanitized; it never leaves the machine unless
 * the user saves it. Media bytes are inlined as base64 so the project is one
 * portable file.
 */
export interface ProjectFile {
  format: 'sightlines-project'
  schemaVersion: number
  app: { name: string; version: string }
  exportedAt: string
  project: Project
  /** blobKey -> { mime, base64 } for every held file referenced above. */
  media: Record<string, { mime: string; base64: string }>
}

// --- Public (consent-cleared) projection -----------------------------------
// What survives the consent boundary. Sensitive fields are simply absent from
// these types, so they cannot be rendered even by mistake downstream.

export interface PublicGeoPoint {
  lat: number
  lng: number
  /** True when the coordinate was coarsened because it was not safe to publish. */
  coarsened?: boolean
}

export interface PublicVantage extends PublicGeoPoint {
  bearingDeg: number
  fovDeg?: number
  confidence: Certainty
}

export interface PublicFile {
  mime: string
  bytes: number
  sha256: string
  w?: number
  h?: number
  /** Public sources may carry an inlined thumbnail (data URL) for the dossier. */
  thumbnailDataUrl?: string
}

export interface PublicLink {
  url: string
  archivedUrl?: string
  archivedSha256?: string
  archivedAt?: string
}

export interface PublicSource {
  id: string
  kind: SourceKind
  title: string
  datetime?: { value: string; precision: TimePrecision }
  /** Provider reduced to a stable alias, e.g. "Source A". Never the real name. */
  providerAlias?: string
  file?: PublicFile
  link?: PublicLink
  subject?: PublicGeoPoint
  vantage?: PublicVantage
  rights?: string
  note?: string
}

export interface PublicIncident {
  id: string
  titles: LocalizedText[]
  type: IncidentType
  place?: PublicGeoPoint & { name?: string }
  window: { start?: string; end?: string; precision: TimePrecision }
  summary?: string
  tags: string[]
}

export interface PublicFinding {
  id: string
  statement: string
  supportedBy: string[]
  certainty: Certainty
  at?: { time?: string; place?: PublicGeoPoint }
}

/** A record of what the consent boundary removed or altered, for honest disclosure. */
export interface Redactions {
  sourcesDropped: number
  droppedByConsent: { restricted: number; embargoed: number }
  providersAliased: number
  coordinatesWithheld: number
  coordinatesCoarsened: number
  findingsDropped: number
  findingsSupportReduced: number
}

export interface PublicProject {
  incident: PublicIncident
  sources: PublicSource[]
  findings: PublicFinding[]
  redactions: Redactions
  generatedAt?: string
}
