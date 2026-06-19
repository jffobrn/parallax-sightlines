import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Layer } from '@deck.gl/core'
import { useStore } from '../state/store'
import { getResection } from '../lib/derive'
import { buildMapLayers } from './layers'
import {
  graticuleLines,
  makeBasemapStyle,
  registerPmtilesProtocol,
  type Bounds,
} from './basemap'
import { CrossingCard } from './CrossingCard'

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const loadedRef = useRef(false)

  const project = useStore((s) => s.project)
  const selectedSourceId = useStore((s) => s.selectedSourceId)
  const hoveredId = useStore((s) => s.hoveredId)
  const placing = useStore((s) => s.placing)

  const resection = useMemo(() => getResection(project), [project])

  // Keep the latest data for imperative rebuilds (on map move).
  const dataRef = useRef({ project, selectedSourceId, hoveredId, resection })
  dataRef.current = { project, selectedSourceId, hoveredId, resection }

  const buildLayers = (): Layer[] => {
    const map = mapRef.current
    if (!map) return []
    const b = map.getBounds()
    const bounds: Bounds = {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    }
    const d = dataRef.current
    return buildMapLayers({
      project: d.project,
      selectedSourceId: d.selectedSourceId,
      hoveredId: d.hoveredId,
      resection: d.resection,
      graticule: graticuleLines(bounds),
      onPickSource: (id) => useStore.getState().select(id),
    })
  }

  const rebuild = () => {
    if (!loadedRef.current || !overlayRef.current) return
    overlayRef.current.setProps({ layers: buildLayers() })
  }

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return
    registerPmtilesProtocol()

    const s = useStore.getState().project
    const anchor =
      s.incident.place ??
      s.sources.find((x) => x.subject)?.subject ??
      s.sources.find((x) => x.vantage)?.vantage
    const center: [number, number] = anchor
      ? [anchor.lng, anchor.lat]
      : [-19.85, 34.405]

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: makeBasemapStyle(),
      center,
      zoom: 16.2,
      attributionControl: false,
      dragRotate: false,
      maxPitch: 0,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    const overlay = new MapboxOverlay({ interleaved: true, layers: [] })
    overlayRef.current = overlay
    map.addControl(overlay)

    map.on('load', () => {
      loadedRef.current = true
      rebuild()
    })
    map.on('move', rebuild)

    // Placement: a click while in placing mode drops the point.
    map.on('click', (e) => {
      const p = useStore.getState().placing
      if (p) useStore.getState().applyPlacement(e.lngLat.lat, e.lngLat.lng)
    })

    // Cursor readout, throttled to one update per frame.
    let raf = 0
    let pending: { lat: number; lng: number } | null = null
    map.on('mousemove', (e) => {
      pending = { lat: e.lngLat.lat, lng: e.lngLat.lng }
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (pending) useStore.getState().setCursor(pending)
      })
    })
    map.on('mouseout', () => useStore.getState().setCursor(null))

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
      map.remove()
      mapRef.current = null
      overlayRef.current = null
      loadedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild layers whenever the data the map draws from changes.
  useEffect(() => {
    rebuild()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, selectedSourceId, hoveredId, resection])

  // Crosshair cursor while placing.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = placing ? 'crosshair' : ''
  }, [placing])

  return (
    <>
      <div className="map-fill" ref={containerRef} />
      <MapPlacementBanner />
      <CrossingCard resection={resection} />
      <MapLegend />
    </>
  )
}

function MapPlacementBanner() {
  const placing = useStore((s) => s.placing)
  const setPlacing = useStore((s) => s.setPlacing)
  if (!placing) return null
  const what =
    placing.kind === 'incident-place'
      ? 'incident place'
      : placing.kind === 'subject'
        ? 'subject point'
        : 'camera vantage'
  return (
    <div className="map-banner">
      <span>
        Click the map to place the <b>{what}</b>
      </span>
      <button className="btn btn-sm btn-ghost" onClick={() => setPlacing(null)}>
        Cancel
      </button>
    </div>
  )
}

function MapLegend() {
  return (
    <div className="map-legend mono">
      <div className="legend-row"><span className="sw sw-vantage" /> vantage</div>
      <div className="legend-row"><span className="sw sw-subject" /> subject</div>
      <div className="legend-row"><span className="sw sw-cross" /> crossing</div>
      <div className="legend-row"><span className="sw sw-place" /> incident</div>
      <div className="legend-row"><span className="sw sw-unsafe" /> protected</div>
    </div>
  )
}
