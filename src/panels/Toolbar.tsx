import { useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { APP_NAME, buildProjectFile, importProjectFile, isProjectFile } from '../core'
import { useStore } from '../state/store'
import { setThemePref, useThemePref, type ThemePref } from '../state/theme'
import { Dir, Menu, type MenuEntry } from '../components/ui'
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

/** The id of the tool bar slot the map fills with its own tools. */
export const MAP_TOOLS_SLOT = 'map-tools-slot'

const ICONS: Record<string, ReactNode> = {
  select: <path d="M5 3l10 6-4.5 1.2L13 15l-1.8.8-2.4-4.6L5 14z" />,
  vantage: (
    <>
      <circle cx="6" cy="13" r="2.6" />
      <path d="M8 11l7-7M11 4h4v4" fill="none" />
    </>
  ),
  subject: (
    <>
      <circle cx="10" cy="10" r="5.5" fill="none" />
      <circle cx="10" cy="10" r="1.8" />
    </>
  ),
  place: (
    <>
      <path d="M10 17s-5-5.2-5-9a5 5 0 0110 0c0 3.8-5 9-5 9z" fill="none" />
      <circle cx="10" cy="8" r="1.6" />
    </>
  ),
  measure: (
    <>
      <path d="M3 14L14 3l3 3L6 17z" fill="none" />
      <path d="M7 10l1.5 1.5M9.5 7.5L11 9M12 5l1.5 1.5" fill="none" />
    </>
  ),
  sun: (
    <>
      <circle cx="10" cy="10" r="3.2" fill="none" />
      <path
        d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8"
        fill="none"
      />
    </>
  ),
  ground: <path d="M3 6l7-3 7 3-7 3zM3 10l7 3 7-3M3 14l7 3 7-3" fill="none" />,
}

/** A plain line icon for a tool, drawn in the current text colour. */
export function ToolIcon({ name }: { name: keyof typeof ICONS | string }) {
  return (
    <svg className="ic" viewBox="0 0 20 20" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export function Toolbar() {
  const project = useStore((s) => s.project)
  const adoptProject = useStore((s) => s.adoptProject)
  const resetToSample = useStore((s) => s.resetToSample)
  const newBlankProject = useStore((s) => s.newBlankProject)
  const notify = useStore((s) => s.notify)
  const placing = useStore((s) => s.placing)
  const setPlacing = useStore((s) => s.setPlacing)
  const selectedSourceId = useStore((s) => s.selectedSourceId)
  const themePref = useThemePref()

  const [publishOpen, setPublishOpen] = useState(false)
  const [geoOpen, setGeoOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const importInput = useRef<HTMLInputElement | null>(null)

  const exportJson = async () => {
    const file = await buildProjectFile(project, new Date().toISOString())
    downloadJson(`${slugify(project.incident.titles[0]?.text ?? 'project')}.sightlines.json`, file)
    notify('Project file saved.')
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await readFileText(file))
      if (!isProjectFile(parsed)) throw new Error('Not a Sightlines project file.')
      const loaded = await importProjectFile(parsed)
      adoptProject(loaded)
      notify('Project imported.')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Import failed.')
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
      .then(() => notify(kind === 'new' ? 'New blank investigation.' : 'Reset to the sample.'))
      .catch((e) => notify(e instanceof Error ? e.message : 'Action failed.'))
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
  ]
  const viewEntries: MenuEntry[] = [
    { heading: true, label: 'Appearance' },
    theme('system', 'Match the system'),
    theme('light', 'Light'),
    theme('dark', 'Dark'),
  ]
  const helpEntries: MenuEntry[] = [
    { label: `About ${APP_NAME}`, onSelect: () => setAboutOpen(true) },
    { label: "Researcher's guide", hint: 'opens online', onSelect: () => window.open(GUIDE_URL, '_blank', 'noopener') },
  ]

  const caseTitle = project.incident.titles[0]?.text
  const selectedSource = project.sources.find((s) => s.id === selectedSourceId)
  const needSource = selectedSource ? undefined : 'Select a source first'

  return (
    <>
      <div className="topbar">
        <span className="wordmark">{APP_NAME}</span>
        <nav className="menus" aria-label="Menus">
          <Menu label="Case" entries={caseEntries} align="left" />
          <Menu label="View" entries={viewEntries} align="left" />
          <Menu label="Help" entries={helpEntries} align="left" />
        </nav>
        {caseTitle && (
          <span className="case-title">
            <Dir text={caseTitle} />
          </span>
        )}
        <div className="topbar-spacer" />
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

      <div className="toolstrip" role="toolbar" aria-label="Tools">
        <button className="tool" aria-pressed={!placing} onClick={() => setPlacing(null)}>
          <ToolIcon name="select" />
          Select
        </button>
        <span className="tool-sep" />
        <button
          className="tool"
          aria-pressed={placing?.kind === 'vantage'}
          disabled={!selectedSource}
          title={needSource ?? 'Click the map to place the camera vantage of the selected source'}
          onClick={() => selectedSource && setPlacing({ kind: 'vantage', sourceId: selectedSource.id })}
        >
          <ToolIcon name="vantage" />
          Place vantage
        </button>
        <button
          className="tool"
          aria-pressed={placing?.kind === 'subject'}
          disabled={!selectedSource}
          title={needSource ?? 'Click the map to place the subject of the selected source'}
          onClick={() => selectedSource && setPlacing({ kind: 'subject', sourceId: selectedSource.id })}
        >
          <ToolIcon name="subject" />
          Place subject
        </button>
        <button
          className="tool"
          aria-pressed={placing?.kind === 'incident-place'}
          title="Click the map to place the incident"
          onClick={() => setPlacing({ kind: 'incident-place' })}
        >
          <ToolIcon name="place" />
          Place incident
        </button>
        <span className="tool-sep" />
        <div id={MAP_TOOLS_SLOT} className="tool-slot" />
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
    </>
  )
}
