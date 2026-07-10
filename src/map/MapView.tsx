import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Layer } from '@deck.gl/core'
import { useStore } from '../state/store'
import { getResection } from '../lib/derive'
import type { Project } from '../core'
import { buildMapLayers } from './layers'
import {
  type BasemapOpts,
  type BasemapSource,
  type Bounds,
  fetchWaybackReleases,
  graticuleLines,
  makeBasemapStyle,
  registerBasemapFile,
  registerPmtilesProtocol,
  type WaybackRelease,
} from './basemap'
import { geocodePlace, type GeoResult, parseCoordinate } from './geocode'
import { CrossingCard } from './CrossingCard'

const BASEMAP_KEY = 'sightlines.basemap'
const LABELS_KEY = 'sightlines.labels'

/** Persisted default. 'file' is a per-session choice and is never persisted. */
function loadBasemapPref(): BasemapSource {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(BASEMAP_KEY) : null
  return v === 'streets' || v === 'topo' || v === 'graticule' ? v : 'satellite'
}

function loadLabelsPref(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(LABELS_KEY) === '1'
}

/** Every placed point in the project, as [lng, lat], for fitting the view. */
function collectPoints(project: Project): [number, number][] {
  const out: [number, number][] = []
  const push = (p?: { lat: number; lng: number }) => {
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) out.push([p.lng, p.lat])
  }
  push(project.incident.place)
  for (const s of project.sources) {
    push(s.subject)
    push(s.vantage)
  }
  return out
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const loadedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const fileKeyRef = useRef<string | undefined>(undefined)

  const project = useStore((s) => s.project)
  const selectedSourceId = useStore((s) => s.selectedSourceId)
  const hoveredId = useStore((s) => s.hoveredId)
  const placing = useStore((s) => s.placing)

  const resection = useMemo(() => getResection(project), [project])
  const [basemap, setBasemap] = useState<BasemapSource>(loadBasemapPref)
  const [labels, setLabels] = useState<boolean>(loadLabelsPref)
  const [waybackDate, setWaybackDate] = useState('')
  const [releases, setReleases] = useState<WaybackRelease[]>([])

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

    // 'file' cannot be restored without a re-picked file, so fall back to satellite.
    const initial = basemap === 'file' ? 'satellite' : basemap

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: makeBasemapStyle(initial, { labels }),
      center,
      zoom: 16.2,
      attributionControl: false,
      dragRotate: false,
      maxPitch: 0,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

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

  // Build the style options for the current control state, with overrides so a
  // handler can apply its own new value before React state has flushed.
  const buildOpts = (over: { labels?: boolean; date?: string } = {}): BasemapOpts => {
    const date = over.date ?? waybackDate
    const opts: BasemapOpts = { labels: over.labels ?? labels }
    if (fileKeyRef.current) opts.fileKey = fileKeyRef.current
    const r = releases.find((x) => x.date === date)
    if (date && r) opts.satelliteUrl = r.url
    return opts
  }

  // Swap the basemap style; deck layers are re-added once the new style parses.
  const applyBasemap = (source: BasemapSource, opts: BasemapOpts) => {
    const map = mapRef.current
    if (!map) return
    loadedRef.current = false
    map.setStyle(makeBasemapStyle(source, opts))
    map.once('styledata', () => {
      loadedRef.current = true
      rebuild()
    })
  }

  const chooseBasemap = (source: BasemapSource) => {
    if (source === 'file') {
      fileInputRef.current?.click()
      return
    }
    setBasemap(source)
    try {
      localStorage.setItem(BASEMAP_KEY, source)
    } catch {
      /* storage unavailable; the choice still applies for the session */
    }
    applyBasemap(source, buildOpts())
  }

  const toggleLabels = () => {
    const next = !labels
    setLabels(next)
    try {
      localStorage.setItem(LABELS_KEY, next ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
    applyBasemap(basemap === 'file' ? 'file' : basemap, buildOpts({ labels: next }))
  }

  const chooseWayback = (date: string) => {
    setWaybackDate(date)
    applyBasemap('satellite', buildOpts({ date }))
  }

  const onFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const key = await registerBasemapFile(f)
      fileKeyRef.current = key
      setBasemap('file')
      applyBasemap('file', buildOpts())
    } catch {
      // Leave the current basemap in place; a bad file changes nothing.
      // eslint-disable-next-line no-console
      console.warn('Could not read that .pmtiles basemap.')
    }
  }

  const gotoPoint = (lat: number, lng: number) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 900 })
  }

  // Load the Wayback release list the first time satellite is active.
  useEffect(() => {
    if (basemap !== 'satellite' || releases.length > 0) return
    let live = true
    fetchWaybackReleases()
      .then((r) => {
        if (live) setReleases(r)
      })
      .catch(() => {
        /* live imagery only; the date control stays at Live */
      })
    return () => {
      live = false
    }
  }, [basemap, releases.length])

  // Rebuild layers whenever the data the map draws from changes.
  useEffect(() => {
    rebuild()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, selectedSourceId, hoveredId, resection])

  // Fit the view to placed points shortly after they change, so a coordinate
  // typed into the inspector becomes visible without a reload.
  const pointsKey = useMemo(
    () => collectPoints(project).map((p) => p[0].toFixed(5) + ',' + p[1].toFixed(5)).join('|'),
    [project],
  )
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const pts = collectPoints(project)
    if (pts.length === 0) return
    const t = window.setTimeout(() => {
      if (pts.length === 1) {
        map.easeTo({ center: pts[0], zoom: Math.max(map.getZoom(), 15), duration: 600 })
      } else {
        const b = new maplibregl.LngLatBounds(pts[0], pts[0])
        for (const p of pts) b.extend(p)
        map.fitBounds(b, { padding: 90, maxZoom: 17, duration: 600 })
      }
    }, 500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey])

  // Crosshair cursor while placing.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = placing ? 'crosshair' : ''
  }, [placing])

  return (
    <>
      <div className="map-fill" ref={containerRef} />
      <MapControls
        basemap={basemap}
        labels={labels}
        waybackDate={waybackDate}
        releases={releases}
        onChoose={chooseBasemap}
        onToggleLabels={toggleLabels}
        onChooseWayback={chooseWayback}
        onGoto={gotoPoint}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pmtiles"
        style={{ display: 'none' }}
        onChange={onFilePicked}
      />
      <MapPlacementBanner />
      <CrossingCard resection={resection} />
      <MapLegend />
    </>
  )
}

function MapControls({
  basemap,
  labels,
  waybackDate,
  releases,
  onChoose,
  onToggleLabels,
  onChooseWayback,
  onGoto,
}: {
  basemap: BasemapSource
  labels: boolean
  waybackDate: string
  releases: WaybackRelease[]
  onChoose: (s: BasemapSource) => void
  onToggleLabels: () => void
  onChooseWayback: (date: string) => void
  onGoto: (lat: number, lng: number) => void
}) {
  const opts: { id: BasemapSource; label: string; title: string }[] = [
    { id: 'satellite', label: 'Satellite', title: 'Esri World Imagery (tokenless)' },
    { id: 'streets', label: 'Streets', title: 'OpenStreetMap' },
    { id: 'topo', label: 'Topo', title: 'Esri topographic, with hillshade' },
    { id: 'graticule', label: 'Grid', title: 'Coordinate grid only; nothing is fetched' },
    { id: 'file', label: 'File', title: 'Load a local .pmtiles basemap; nothing is fetched' },
  ]
  return (
    <div className="basemap-picker mono">
      <MapSearch onGoto={onGoto} />
      <div className="basemap-row">
        {opts.map((o) => (
          <button
            key={o.id}
            className="basemap-btn"
            data-active={basemap === o.id}
            title={o.title}
            onClick={() => onChoose(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <label className="basemap-toggle">
        <input type="checkbox" checked={labels} onChange={onToggleLabels} />
        Labels
      </label>
      {basemap === 'satellite' && (
        <div className="basemap-date">
          <span>Imagery</span>
          <select value={waybackDate} onChange={(e) => onChooseWayback(e.target.value)}>
            <option value="">Live</option>
            {releases.map((r) => (
              <option key={r.date} value={r.date}>
                {r.date}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

function MapSearch({ onGoto }: { onGoto: (lat: number, lng: number) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[] | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    const q = query.trim()
    if (!q) return
    const coord = parseCoordinate(q)
    if (coord) {
      onGoto(coord.lat, coord.lng)
      setResults(null)
      return
    }
    setBusy(true)
    try {
      const found = await geocodePlace(q)
      setResults(found)
    } catch {
      setResults([])
    } finally {
      setBusy(false)
    }
  }

  const pick = (r: GeoResult) => {
    onGoto(r.lat, r.lng)
    setResults(null)
    setQuery('')
  }

  return (
    <div className="map-search">
      <input
        className="map-search-input"
        placeholder="Search place or lat, lng"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') run()
          else if (e.key === 'Escape') setResults(null)
        }}
      />
      {results !== null && (
        <div className="map-results">
          {busy && <div className="map-search-msg">searching…</div>}
          {!busy && results.length === 0 && (
            <div className="map-search-msg">no match</div>
          )}
          {results.map((r, i) => (
            <button key={i} className="map-result" title={r.label} onClick={() => pick(r)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
