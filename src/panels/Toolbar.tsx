import { useRef, useState } from 'react'
import {
  APP_NAME,
  SUITE_NAME,
  buildProjectFile,
  formatLatLng,
  importProjectFile,
  isProjectFile,
} from '../core'
import { useStore } from '../state/store'
import { useCursorElevation } from '../state/useCursorElevation'
import { Count } from '../components/ui'
import { downloadJson, readFileText, slugify } from '../lib/download'
import { PublishDialog } from '../publish/PublishDialog'
import { AboutDialog } from './AboutDialog'
import { GeoDataDialog } from './GeoDataDialog'

export function Toolbar() {
  const project = useStore((s) => s.project)
  const cursor = useStore((s) => s.cursor)
  const cursorElev = useCursorElevation()
  const adoptProject = useStore((s) => s.adoptProject)
  const resetToSample = useStore((s) => s.resetToSample)
  const newBlankProject = useStore((s) => s.newBlankProject)

  const [publishOpen, setPublishOpen] = useState(false)
  const [geoOpen, setGeoOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [armed, setArmed] = useState<'reset' | 'new' | null>(null)
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const importInput = useRef<HTMLInputElement | null>(null)

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 3000)
  }

  const exportJson = async () => {
    const file = await buildProjectFile(project, new Date().toISOString())
    downloadJson(`${slugify(project.incident.titles[0]?.text ?? 'project')}.sightlines.json`, file)
    flash('Project file saved.')
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await readFileText(file))
      if (!isProjectFile(parsed)) throw new Error('Not a Sightlines project file.')
      const loaded = await importProjectFile(parsed)
      adoptProject(loaded)
      flash('Project imported.')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  // New and Reset both discard the current project, so each asks to confirm. We
  // do this in-app (a two-step button) rather than with window.confirm, which
  // some browsers and installed PWAs suppress, and we surface the outcome, which
  // a bare `void` would have swallowed. Only one action is armed at a time.
  const armOrRun = (kind: 'reset' | 'new', run: () => Promise<void>, ok: string) => {
    if (armed !== kind) {
      setArmed(kind)
      if (armTimer.current) clearTimeout(armTimer.current)
      armTimer.current = setTimeout(() => setArmed(null), 4000)
      return
    }
    if (armTimer.current) clearTimeout(armTimer.current)
    setArmed(null)
    run()
      .then(() => flash(ok))
      .catch((e) => flash(e instanceof Error ? e.message : 'Action failed.'))
  }
  const reset = () => armOrRun('reset', resetToSample, 'Reset to the sample.')
  const newBlank = () => armOrRun('new', newBlankProject, 'New blank investigation.')

  const armedStyle = {
    background: 'var(--alert-wash)',
    borderColor: 'var(--alert-dim)',
    color: 'var(--alert-bright)',
  }

  const publicCount = project.sources.filter((s) => s.consent === 'public').length

  return (
    <div className="topbar">
      <span className="wordmark">
        <span className="suite">{SUITE_NAME}</span>
        <span className="sep">//</span>
        {APP_NAME}
      </span>

      <div className="btn-row">
        <button className="btn btn-sm btn-mono btn-primary" onClick={() => setPublishOpen(true)}>
          Publish
        </button>
        <button className="btn btn-sm btn-mono btn-ghost" onClick={exportJson}>
          Export
        </button>
        <button className="btn btn-sm btn-mono btn-ghost" onClick={() => importInput.current?.click()}>
          Import
        </button>
        <button
          className="btn btn-sm btn-mono btn-ghost"
          onClick={() => setGeoOpen(true)}
          title="Export placed points as GeoJSON or CSV (for QGIS)"
        >
          Geo
        </button>
        <button
          className="btn btn-sm btn-mono btn-ghost"
          onClick={newBlank}
          title="Start a new, empty investigation (export first to keep this one)"
          style={armed === 'new' ? armedStyle : undefined}
        >
          {armed === 'new' ? 'Confirm new' : 'New'}
        </button>
        <button
          className="btn btn-sm btn-mono btn-ghost"
          onClick={reset}
          title="Replace the current investigation with the fictional sample"
          style={armed === 'reset' ? armedStyle : undefined}
        >
          {armed === 'reset' ? 'Confirm reset' : 'Reset'}
        </button>
        <button className="btn btn-sm btn-mono btn-ghost" onClick={() => setAboutOpen(true)}>
          About
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => onImport(e.target.files?.[0])}
        />
      </div>

      <div className="topbar-spacer" />

      <div className="readout">
        {msg && <span className="signal">{msg}</span>}
        <span>
          <Count n={project.sources.length} noun="source" />
        </span>
        <span>
          <b>{publicCount}</b> public
        </span>
        <span>
          <Count n={project.findings.length} noun="finding" />
        </span>
        <span className="cursor-readout">
          {cursor ? formatLatLng(cursor.lat, cursor.lng) : '--'}
          {cursor && cursorElev !== null ? `  ${cursorElev} m` : ''}
        </span>
      </div>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />
      <GeoDataDialog open={geoOpen} onOpenChange={setGeoOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  )
}
