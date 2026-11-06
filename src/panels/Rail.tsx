import { useMemo, useState, type ReactNode } from 'react'
import {
  formatDateTimeShort,
  newId,
  type Finding,
  type Source,
  type SyncEvent,
} from '../core'
import { useStore } from '../state/store'
import { solveClocks } from '../lib/clock'
import { CertaintyBadge, ConsentBadge, Dir, kindLabel, Menu, rowButton } from '../components/ui'

/** A collapsible group in the case outline. */
function Group({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="group">
      <button type="button" className="group-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="twisty" aria-hidden="true" />
        {title}
        {count !== undefined && <span className="count">{count}</span>}
      </button>
      {open && children}
    </section>
  )
}

const SHORT_KIND: Record<string, string> = {
  photograph: 'Photo',
  'video-link': 'Video',
  document: 'Doc',
  testimony: 'Account',
  audio: 'Audio',
}

export function Rail() {
  const project = useStore((s) => s.project)
  const selectedSourceId = useStore((s) => s.selectedSourceId)
  const selectedFindingId = useStore((s) => s.selectedFindingId)
  const selectedSyncEventId = useStore((s) => s.selectedSyncEventId)
  const hoveredId = useStore((s) => s.hoveredId)
  const select = useStore((s) => s.select)
  const selectFinding = useStore((s) => s.selectFinding)
  const selectSyncEvent = useStore((s) => s.selectSyncEvent)
  const addSyncEvent = useStore((s) => s.addSyncEvent)
  const hover = useStore((s) => s.hover)
  const addSource = useStore((s) => s.addSource)
  const addFinding = useStore((s) => s.addFinding)

  const incident = project.incident
  const editingIncident = !selectedSourceId && !selectedFindingId && !selectedSyncEventId
  const clocks = useMemo(() => solveClocks(project), [project])
  const flaggedEvents = new Set(clocks.residuals.filter((r) => r.flagged).map((r) => r.eventId))

  const onAddSyncEvent = () => {
    const e: SyncEvent = { id: newId('sync'), label: 'New sync event', kind: 'both', observations: [] }
    addSyncEvent(e)
  }

  const onAddSource = () => {
    const s: Source = {
      id: newId('src'),
      kind: 'photograph',
      title: 'Untitled source',
      consent: 'public',
    }
    addSource(s)
  }

  const onAddFinding = () => {
    const f: Finding = {
      id: newId('find'),
      statement: 'New finding',
      supportedBy: [],
      certainty: 'probable',
    }
    addFinding(f)
  }

  const withheld = (s: Source) => s.consent !== 'public'
  const typeLabel = incident.type ? incident.type.charAt(0).toUpperCase() + incident.type.slice(1).replace(/-/g, ' ') : ''

  return (
    <>
      <div className="pane-head">
        <span>Case</span>
        <Menu
          label="Add"
          entries={[
            { label: 'Source', onSelect: onAddSource },
            { label: 'Finding', onSelect: onAddFinding },
            { label: 'Sync event', onSelect: onAddSyncEvent },
          ]}
        />
      </div>

      <Group title="Incident">
        <button className="incident-card" data-active={editingIncident} onClick={() => select(null)}>
          <div className="incident-titles">
            {incident.titles.map((t, i) => (
              <div key={i} className={i === 0 ? 'incident-title' : 'incident-title-alt'}>
                <Dir text={t.text || 'Untitled'} />
              </div>
            ))}
          </div>
          <div className="row-sub wrap">
            {typeLabel}
            {typeLabel ? ', ' : ''}
            {incident.window.start
              ? `${formatDateTimeShort(incident.window.start, incident.window.precision)}${
                  incident.window.end ? ` to ${formatDateTimeShort(incident.window.end, incident.window.precision)}` : ''
                }`
              : 'no time window yet'}
          </div>
        </button>
      </Group>

      <Group title="Sources" count={project.sources.length}>
        {project.sources.length === 0 ? (
          <div className="empty">No sources yet. Add one from the Add menu.</div>
        ) : (
          <table className="outline">
            <colgroup>
              <col />
              <col className="c-kind" />
              <col className="c-time" />
              <col className="c-consent" />
            </colgroup>
            <thead>
              <tr>
                <th>Title</th>
                <th>Kind</th>
                <th>UTC</th>
                <th>Consent</th>
              </tr>
            </thead>
            <tbody>
              {project.sources.map((s) => (
                <tr
                  key={s.id}
                  className="row"
                  data-selected={s.id === selectedSourceId}
                  data-hovered={s.id === hoveredId && s.id !== selectedSourceId}
                  data-withheld={withheld(s)}
                  {...rowButton(() => select(s.id))}
                  onMouseEnter={() => hover(s.id)}
                  onMouseLeave={() => hover(null)}
                  title={`${s.title}, ${kindLabel(s.kind).toLowerCase()}`}
                >
                  <td className="row-title"><Dir text={s.title} /></td>
                  <td>{SHORT_KIND[s.kind] ?? kindLabel(s.kind)}</td>
                  <td className="mono">{s.datetime ? formatDateTimeShort(s.datetime.value, s.datetime.precision).replace(/^\d{4}-/, '') : ''}</td>
                  <td><ConsentBadge consent={s.consent} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Group>

      <Group title="Findings" count={project.findings.length}>
        {project.findings.length === 0 ? (
          <div className="empty">No findings yet.</div>
        ) : (
          <table className="outline">
            <colgroup>
              <col />
              <col className="c-consent" />
              <col className="c-num" />
            </colgroup>
            <thead>
              <tr>
                <th>Statement</th>
                <th>Certainty</th>
                <th>Cites</th>
              </tr>
            </thead>
            <tbody>
              {project.findings.map((f) => (
                <tr
                  key={f.id}
                  className="row"
                  data-selected={f.id === selectedFindingId}
                  data-hovered={f.id === hoveredId && f.id !== selectedFindingId}
                  {...rowButton(() => selectFinding(f.id))}
                  onMouseEnter={() => hover(f.id)}
                  onMouseLeave={() => hover(null)}
                  title={f.statement}
                >
                  <td className="row-title">{f.statement}</td>
                  <td><CertaintyBadge certainty={f.certainty} /></td>
                  <td className="mono">{f.supportedBy.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Group>

      <Group title="Sync events" count={project.syncEvents.length}>
        {project.syncEvents.length === 0 ? (
          <div className="empty">No sync events. Add a moment seen or heard in more than one source to align their clocks.</div>
        ) : (
          <table className="outline">
            <colgroup>
              <col />
              <col className="c-kind" />
              <col className="c-time" />
              <col className="c-num" />
            </colgroup>
            <thead>
              <tr>
                <th>Event</th>
                <th>Observed</th>
                <th>UTC</th>
                <th>Reads</th>
              </tr>
            </thead>
            <tbody>
              {project.syncEvents.map((e) => {
                const t = clocks.events[e.id]
                const flagged = flaggedEvents.has(e.id)
                return (
                  <tr
                    key={e.id}
                    className="row"
                    data-selected={e.id === selectedSyncEventId}
                    data-hovered={e.id === hoveredId && e.id !== selectedSyncEventId}
                    data-withheld={flagged}
                    {...rowButton(() => selectSyncEvent(e.id))}
                    onMouseEnter={() => hover(e.id)}
                    onMouseLeave={() => hover(null)}
                    title={flagged ? 'Its readings disagree with the other events' : e.label}
                  >
                    <td className="row-title">
                      <Dir text={e.label || 'Untitled event'} />
                    </td>
                    <td>{e.kind === 'sound' ? 'Heard' : e.kind === 'visual' ? 'Seen' : 'Both'}</td>
                    <td className="mono">
                      {flagged ? <span className="alert">Inconsistent</span> : t?.anchored ? new Date(t.timeSec * 1000).toISOString().slice(11, 19) : ''}
                    </td>
                    <td className="mono">{e.observations.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Group>
    </>
  )
}
