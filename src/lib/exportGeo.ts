/**
 * Sightlines-specific mapping of the project's placed geometry into interchange
 * points and GeoJSON features. This export is for the operator's own use (QGIS and
 * the like) and carries full coordinates; it is not the consent-cleared
 * publication, which the publish path handles separately.
 */

import { getResection } from './derive'
import {
  featureCollection,
  pointFeature,
  pointsToCsv,
  toGeoJsonString,
  type GeoFeature,
  type NamedPoint,
} from './interchange'
import type { Project } from '../core'

/** Every placed point across the project, as named points. */
export function collectPoints(project: Project): NamedPoint[] {
  const pts: NamedPoint[] = []
  const inc = project.incident
  const incName = inc.place?.name ?? inc.titles[0]?.text ?? 'incident'
  if (inc.place) pts.push({ lat: inc.place.lat, lng: inc.place.lng, name: incName, kind: 'incident' })
  for (const s of project.sources) {
    if (s.subject) pts.push({ lat: s.subject.lat, lng: s.subject.lng, name: s.title, kind: 'subject' })
    if (s.vantage)
      pts.push({
        lat: s.vantage.lat,
        lng: s.vantage.lng,
        name: s.title,
        kind: 'vantage',
        bearingDeg: s.vantage.bearingDeg,
      })
  }
  const best = getResection(project).best
  if (best?.point)
    pts.push({ lat: best.point.lat, lng: best.point.lng, name: 'resection crossing', kind: 'crossing' })
  for (const f of project.findings) {
    if (f.at?.place)
      pts.push({ lat: f.at.place.lat, lng: f.at.place.lng, name: f.statement.slice(0, 80), kind: 'finding' })
  }
  return pts
}

/** GeoJSON features for the project's placed geometry. */
export function collectFeatures(project: Project): GeoFeature[] {
  return collectPoints(project).map((p) =>
    pointFeature(p.lng, p.lat, {
      name: p.name,
      kind: p.kind,
      ...(p.bearingDeg !== undefined ? { bearing_deg: p.bearingDeg } : {}),
    }),
  )
}

export function projectGeoJson(project: Project): string {
  return toGeoJsonString(featureCollection(collectFeatures(project)))
}

export function projectCsv(project: Project): string {
  return pointsToCsv(collectPoints(project))
}
