/**
 * deck.gl layer construction for the map. Pure: given the project, the current
 * selection, the resection, and a graticule, it returns the layer stack. The
 * MapView owns the map and the store; this owns the drawing.
 */

import type { Layer } from '@deck.gl/core'
import { LineLayer, PathLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers'
import {
  destinationPoint,
  fovConeRing,
  type Project,
  type ResectionSet,
} from '../core'
import type { Graticule } from './basemap'

const RAY_LEN_M = 520
const CONE_LEN_M = 360

type RGBA = [number, number, number, number]

const C = {
  minor: [40, 48, 60, 110] as RGBA,
  major: [56, 66, 79, 170] as RGBA,
  subject: [127, 168, 191, 255] as RGBA,
  subjectLine: [188, 214, 228, 255] as RGBA,
  vantage: [216, 210, 192, 255] as RGBA,
  vantageLine: [245, 242, 230, 255] as RGBA,
  ray: [216, 210, 192, 140] as RGBA,
  raySel: [255, 193, 99, 235] as RGBA,
  cone: [216, 210, 192, 16] as RGBA,
  coneSel: [243, 169, 60, 28] as RGBA,
  cross: [243, 169, 60, 255] as RGBA,
  crossRing: [243, 169, 60, 95] as RGBA,
  place: [167, 176, 189, 255] as RGBA,
  alert: [229, 84, 75, 255] as RGBA,
  sel: [255, 193, 99, 255] as RGBA,
}

export interface BuildLayersArgs {
  project: Project
  selectedSourceId: string | null
  hoveredId: string | null
  resection: ResectionSet
  graticule: Graticule
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
      const end = destinationPoint(origin, v.bearingDeg, RAY_LEN_M)
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
      if (ring) cones.push({ polygon: ring, color: emph ? C.coneSel : C.cone })
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
        getRadius: 4,
        radiusUnits: 'pixels',
        filled: true,
        getFillColor: C.crossRing,
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }
  if (resection.best?.point) {
    const bp = resection.best.point
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
        getLineColor: [10, 12, 16, 255],
        getLineWidth: 1,
        lineWidthUnits: 'pixels',
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }

  return layers
}
