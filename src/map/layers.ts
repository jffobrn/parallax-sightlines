/**
 * deck.gl layer construction for the map. Pure: given the project, the current
 * selection, the resection, and a graticule, it returns the layer stack. The
 * MapView owns the map and the store; this owns the drawing.
 */

import type { Layer } from '@deck.gl/core'
import { LineLayer, PathLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers'
import {
  destinationPoint,
  distanceM,
  fovConeRing,
  type Project,
  type ResectionSet,
} from '../core'
import { eventWedges, originZones } from '../lib/zones'
import type { Graticule } from './basemap'
import { mapPalette, type Ground } from './palette'

const RAY_LEN_M = 520
const CONE_LEN_M = 360

type RGBA = [number, number, number, number]


export interface BuildLayersArgs {
  project: Project
  selectedSourceId: string | null
  hoveredId: string | null
  resection: ResectionSet
  graticule: Graticule
  /** The fix to mark: the centre of the uncertainty estimate, when there is one. */
  fix?: { lat: number; lng: number } | null
  /** Whether the ground under the marks is dark (imagery) or light. */
  ground?: Ground
  /** The sync event in focus: its bearing bands and zone are emphasised. */
  selectedSyncEventId?: string | null
  onPickSource?: (id: string) => void
}

interface PointDatum {
  position: [number, number]
  sourceId: string
  emphasized: boolean
  unsafe: boolean
}

export function buildMapLayers(args: BuildLayersArgs): Layer[] {
  const { project, selectedSourceId, hoveredId, resection, graticule } = args
  const fix = args.fix ?? resection.best?.point ?? null
  const C = mapPalette(args.ground ?? 'dark')
  const isEmph = (id: string) => id === selectedSourceId || id === hoveredId

  const rays: {
    source: [number, number]
    target: [number, number]
    color: RGBA
    width: number
  }[] = []
  const cones: { polygon: [number, number][]; color: RGBA }[] = []
  const vantagePts: PointDatum[] = []
  const subjectPts: PointDatum[] = []

  for (const s of project.sources) {
    if (s.vantage) {
      const v = s.vantage
      const origin = { lat: v.lat, lng: v.lng }
      // A ray stops a little past the fix, so the rays are seen to converge on
      // it rather than radiate from it.
      const reach = fix ? distanceM(origin, fix) : null
      const len = reach !== null && reach > 5 ? Math.min(RAY_LEN_M, reach * 1.12 + 25) : RAY_LEN_M
      const end = destinationPoint(origin, v.bearingDeg, len)
      const emph = isEmph(s.id)
      rays.push({
        source: [v.lng, v.lat],
        target: [end.lng, end.lat],
        color: emph ? C.raySel : C.ray,
        width: emph ? 2.4 : 1.4,
      })
      const ring = fovConeRing(
        { lat: v.lat, lng: v.lng, bearingDeg: v.bearingDeg, fovDeg: v.fovDeg },
        CONE_LEN_M,
      )
      // The field of view is drawn only for the source in focus; five cones at
      // once hide the sightlines they are meant to explain.
      if (ring && emph) cones.push({ polygon: ring, color: C.coneSel })
      vantagePts.push({
        position: [v.lng, v.lat],
        sourceId: s.id,
        emphasized: emph,
        unsafe: !v.safeToPublish,
      })
    }
    if (s.subject) {
      subjectPts.push({
        position: [s.subject.lng, s.subject.lat],
        sourceId: s.id,
        emphasized: isEmph(s.id),
        unsafe: !s.subject.safeToPublish,
      })
    }
  }

  const layers: Layer[] = []

  // Graticule, drawn under everything.
  layers.push(
    new PathLayer({
      id: 'graticule-minor',
      data: graticule.minor,
      getPath: (d: [number, number][]) => d,
      getColor: C.minor,
      getWidth: 1,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      parameters: { depthTest: false },
      pickable: false,
    }),
    new PathLayer({
      id: 'graticule-major',
      data: graticule.major,
      getPath: (d: [number, number][]) => d,
      getColor: C.major,
      getWidth: 1,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      parameters: { depthTest: false },
      pickable: false,
    }),
  )

  // Field-of-view cones (faint fills).
  if (cones.length) {
    layers.push(
      new PolygonLayer({
        id: 'fov-cones',
        data: cones,
        getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
        getFillColor: (d: { color: RGBA }) => d.color,
        getLineColor: [0, 0, 0, 0],
        stroked: false,
        filled: true,
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }

  // Bearing bands from sync readings, and the zone of possible origin where
  // they meet. The bands are faint; the zone, the bounded region the origin
  // must lie in, is outlined.
  // Only the sync event in focus: its bands and zone are a separate
  // construct from the crossing and must not sit on it unasked.
  const wedges = eventWedges(project).filter((w) => w.eventId === args.selectedSyncEventId)
  if (wedges.length) {
    layers.push(
      new PolygonLayer({
        id: 'sync-wedges',
        data: wedges,
        getPolygon: (d: { ring: [number, number][] }) => d.ring,
        getFillColor: (d: { eventId: string }) => (d.eventId === args.selectedSyncEventId ? C.wedgeSel : C.wedge),
        getLineColor: C.wedgeLine,
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true,
        updateTriggers: { getFillColor: [args.selectedSyncEventId] },
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }
  const zones = originZones(project).filter((z) => !z.empty && z.wedges > 1 && z.eventId === args.selectedSyncEventId)
  if (zones.length) {
    layers.push(
      new PolygonLayer({
        id: 'origin-zones',
        data: zones,
        getPolygon: (d: { ring: [number, number][] }) => d.ring,
        getFillColor: C.zone,
        getLineColor: C.zoneLine,
        getLineWidth: (d: { eventId: string }) => (d.eventId === args.selectedSyncEventId ? 2.5 : 1.5),
        lineWidthUnits: 'pixels',
        stroked: true,
        filled: true,
        updateTriggers: { getLineWidth: [args.selectedSyncEventId] },
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }

  // Sightline rays.
  layers.push(
    new LineLayer({
      id: 'rays',
      data: rays,
      getSourcePosition: (d) => d.source,
      getTargetPosition: (d) => d.target,
      getColor: (d) => d.color,
      getWidth: (d) => d.width,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      parameters: { depthTest: false },
      pickable: false,
    }),
  )

  // Incident place (hollow neutral marker).
  if (project.incident.place) {
    const pl = project.incident.place
    layers.push(
      new ScatterplotLayer({
        id: 'incident-place',
        data: [{ position: [pl.lng, pl.lat] }],
        getPosition: (d: { position: [number, number] }) => d.position,
        getRadius: 9,
        radiusUnits: 'pixels',
        filled: false,
        stroked: true,
        getLineColor: C.place,
        getLineWidth: 1.5,
        lineWidthUnits: 'pixels',
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }

  // Unsafe markers get an alert ring behind them, in the editor only.
  const unsafe = [...subjectPts, ...vantagePts].filter((p) => p.unsafe)
  if (unsafe.length) {
    layers.push(
      new ScatterplotLayer({
        id: 'unsafe-rings',
        data: unsafe,
        getPosition: (d: PointDatum) => d.position,
        getRadius: 11,
        radiusUnits: 'pixels',
        filled: false,
        stroked: true,
        getLineColor: C.alert,
        getLineWidth: 1.5,
        lineWidthUnits: 'pixels',
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }

  // Subjects.
  layers.push(
    new ScatterplotLayer({
      id: 'subjects',
      data: subjectPts,
      getPosition: (d: PointDatum) => d.position,
      getRadius: (d: PointDatum) => (d.emphasized ? 7 : 5),
      radiusUnits: 'pixels',
      filled: true,
      getFillColor: C.subject,
      stroked: true,
      getLineColor: (d: PointDatum) => (d.emphasized ? C.sel : C.subjectLine),
      getLineWidth: (d: PointDatum) => (d.emphasized ? 2 : 1),
      lineWidthUnits: 'pixels',
      parameters: { depthTest: false },
      pickable: true,
      onClick: (info) => {
        const obj = info.object as PointDatum | undefined
        if (obj && args.onPickSource) args.onPickSource(obj.sourceId)
      },
      updateTriggers: {
        getRadius: [selectedSourceId, hoveredId],
        getLineColor: [selectedSourceId, hoveredId],
        getLineWidth: [selectedSourceId, hoveredId],
      },
    }),
  )

  // Vantages (camera stations).
  layers.push(
    new ScatterplotLayer({
      id: 'vantages',
      data: vantagePts,
      getPosition: (d: PointDatum) => d.position,
      getRadius: (d: PointDatum) => (d.emphasized ? 6 : 4.5),
      radiusUnits: 'pixels',
      filled: true,
      getFillColor: C.vantage,
      stroked: true,
      getLineColor: (d: PointDatum) => (d.emphasized ? C.sel : C.vantageLine),
      getLineWidth: (d: PointDatum) => (d.emphasized ? 2 : 1),
      lineWidthUnits: 'pixels',
      parameters: { depthTest: false },
      pickable: true,
      onClick: (info) => {
        const obj = info.object as PointDatum | undefined
        if (obj && args.onPickSource) args.onPickSource(obj.sourceId)
      },
      updateTriggers: {
        getRadius: [selectedSourceId, hoveredId],
        getLineColor: [selectedSourceId, hoveredId],
        getLineWidth: [selectedSourceId, hoveredId],
      },
    }),
  )

  // Resected crossings: all usable points faint, the best one bright with a ring.
  if (resection.points.length) {
    layers.push(
      new ScatterplotLayer({
        id: 'crossings',
        data: resection.points.map((p) => ({ position: [p.lng, p.lat] })),
        getPosition: (d: { position: [number, number] }) => d.position,
        getRadius: 3,
        radiusUnits: 'pixels',
        filled: true,
        getFillColor: C.crossRing,
        stroked: true,
        getLineColor: C.cross,
        getLineWidth: 1,
        lineWidthUnits: 'pixels',
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }
  if (fix) {
    const bp = fix
    layers.push(
      new ScatterplotLayer({
        id: 'crossing-best-ring',
        data: [{ position: [bp.lng, bp.lat] }],
        getPosition: (d: { position: [number, number] }) => d.position,
        getRadius: 13,
        radiusUnits: 'pixels',
        filled: false,
        stroked: true,
        getLineColor: C.crossRing,
        getLineWidth: 1.5,
        lineWidthUnits: 'pixels',
        parameters: { depthTest: false },
        pickable: false,
      }),
      new ScatterplotLayer({
        id: 'crossing-best',
        data: [{ position: [bp.lng, bp.lat] }],
        getPosition: (d: { position: [number, number] }) => d.position,
        getRadius: 5,
        radiusUnits: 'pixels',
        filled: true,
        getFillColor: C.cross,
        stroked: true,
        getLineColor: C.vantageLine,
        getLineWidth: 1.5,
        lineWidthUnits: 'pixels',
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }

  return layers
}
