import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
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
import { setThemePref, useThemePref, type ThemePref } from '../state/theme'
import { Count, Dir, Menu, type MenuEntry } from '../components/ui'
import { downloadJson, readFileText, slugify } from '../lib/download'
import { PublishDialog } from '../publish/PublishDialog'
import { AboutDialog } from './AboutDialog'
import { GeoDataDialog } from './GeoDataDialog'

const GUIDE_URL = 'https://github.com/jffobrn/parallax-sightlines/blob/main/docs/GUIDE.md'

type Confirm = 'new' | 'reset' | null

const CONFIRM_COPY: Record<'new' | 'reset', { title: string; body: string; action: string }> = {
  new: {
    title: 'Start a new investigation?',
    body: 'The current investigation is replaced by an empty one. Save it first to keep it.',
    action: 'Start new',
  },
  reset: {
    title: 'Reset to the sample?',
    body: 'The current investigation is replaced by the fictional sample. Save it first to keep it.',
    action: 'Reset to the sample',
  },
}

export function Toolbar() {
  const project = useStore((s) => s.project)
  const cursor = useStore((s) => s.cursor)
  const cursorElev = useCursorElevation()
  const adoptProject = useStore((s) => s.adoptProject)
  const resetToSample = useStore((s) => s.resetToSample)
  const newBlankProject = useStore((s) => s.newBlankProject)
  const themePref = useThemePref()

  const [publishOpen, setPublishOpen] = useState(false)
  const [geoOpen, setGeoOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [msg, setMsg] = useState<string | null>(null)
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

  // New and Reset both discard the current project, so each asks to confirm in
  // an in-app dialog (window.confirm is suppressed by some browsers and
  // installed PWAs), and the outcome is reported either way.
  const runConfirmed = () => {
    const kind = confirm
    setConfirm(null)
    if (!kind) return
    const run = kind === 'new' ? newBlankProject : resetToSample
    run()
      .then(() => flash(kind === 'new' ? 'New blank investigation.' : 'Reset to the sample.'))
      .catch((e) => flash(e instanceof Error ? e.message : 'Action failed.'))
  }

  const theme = (pref: ThemePref, label: string): MenuEntry => ({
    label,
    checked: themePref === pref,
    onSelect: () => setThemePref(pref),
  })

  const caseEntries: MenuEntry[] = [
    { label: 'New investigation', onSelect: () => setConfirm('new') },
    { label: 'Open project file', onSelect: () => importInput.current?.click() },
    { label: 'Save project file', onSelect: () => void exportJson() },
    { label: 'Export places', hint: 'GeoJSON, CSV', onSelect: () => setGeoOpen(true) },
    { separator: true, label: '' },
    { label: 'Reset to the sample', danger: true, onSelect: () => setConfirm('reset') },
    { separator: true, label: '' },
    { heading: true, label: 'Appearance' },
    theme('system', 'Match the system'),
    theme('light', 'Light'),
    theme('dark', 'Dark'),
  ]

  const helpEntries: MenuEntry[] = [
    { label: `About ${APP_NAME}`, onSelect: () => setAboutOpen(true) },
    { label: "Researcher's guide", hint: 'opens online', onSelect: () => window.open(GUIDE_URL, '_blank', 'noopener') },
  ]

  const publicCount = project.sources.filter((s) => s.consent === 'public').length
  const caseTitle = project.incident.titles[0]?.text

  return (
    <div className="topbar">
      <span className="wordmark">
        {SUITE_NAME}
        <span className="tool">{APP_NAME}</span>
      </span>
      {caseTitle && (
        <span className="case-title">
          <Dir text={caseTitle} />
        </span>
      )}

      <div className="topbar-spacer" />

      <div className="readout" aria-live="polite">
        {msg && <span className="signal">{msg}</span>}
        <span>
          <Count n={project.sources.length} noun="source" />, <b>{publicCount}</b> public
        </span>
        <span>
          <Count n={project.findings.length} noun="finding" />
        </span>
        <span className="cursor-readout">
          {cursor ? formatLatLng(cursor.lat, cursor.lng) : ''}
          {cursor && cursorElev !== null ? `, ${cursorElev} m` : ''}
        </span>
      </div>

      <div className="btn-row">
        <Menu label="Case" entries={caseEntries} />
        <Menu label="Help" entries={helpEntries} />
        <button className="btn btn-primary" onClick={() => setPublishOpen(true)}>
          Publish
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => onImport(e.target.files?.[0])}
        />
      </div>

      <Dialog.Root open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content" style={{ width: 'min(460px, calc(100vw - 32px))' }}>
            {confirm && (
              <>
                <Dialog.Title className="dialog-title">{CONFIRM_COPY[confirm].title}</Dialog.Title>
                <Dialog.Description className="dialog-desc">{CONFIRM_COPY[confirm].body}</Dialog.Description>
                <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-danger btn-solid" onClick={runConfirmed}>
                    {CONFIRM_COPY[confirm].action}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />
      <GeoDataDialog open={geoOpen} onOpenChange={setGeoOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  )
}
