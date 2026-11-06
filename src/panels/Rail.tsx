import { useMemo } from 'react'
import {
  formatDateTimeShort,
  newId,
  type Finding,
  type Source,
  type SyncEvent,
} from '../core'
import { useStore } from '../state/store'
import { solveClocks } from '../lib/clock'
import { CertaintyBadge, ConsentBadge, Dir, kindLabel, Meta, rowButton } from '../components/ui'
import { CrossingCard } from '../map/CrossingCard'

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
      {/* Incident summary / open incident editor */}
      <button
        className="incident-card"
        data-active={editingIncident}
        onClick={() => select(null)}
      >
        <h2 className="sec-title">Incident</h2>
        <div className="incident-titles">
          {incident.titles.map((t, i) => (
            <div key={i} className={i === 0 ? 'incident-title' : 'incident-title-alt'}>
              <Dir text={t.text || 'Untitled'} />
            </div>
          ))}
        </div>
        <div className="row-sub wrap" style={{ padding: 0 }}>
          <Meta
            parts={[
              typeLabel,
              incident.window.start
                ? `${formatDateTimeShort(incident.window.start, incident.window.precision)}${
                    incident.window.end ? ` to ${formatDateTimeShort(incident.window.end, incident.window.precision)}` : ''
                  }`
                : 'No time window yet',
            ]}
          />
        </div>
      </button>

      <CrossingCard />

      {/* Sources */}
      <div className="panel">
        <div className="panel-head">
          <h2 className="sec-title">
            Sources <span className="count">{project.sources.length}</span>
          </h2>
          <button className="btn-link" onClick={onAddSource}>Add source</button>
        </div>
        <div className="list">
          {project.sources.length === 0 && <div className="empty">No sources yet.</div>}
          {project.sources.map((s) => (
            <div
              key={s.id}
              className="row"
              data-selected={s.id === selectedSourceId}
              data-hovered={s.id === hoveredId && s.id !== selectedSourceId}
              data-withheld={withheld(s)}
              {...rowButton(() => select(s.id))}
              onMouseEnter={() => hover(s.id)}
              onMouseLeave={() => hover(null)}
            >
              <div className="row-main">
                <div className="row-title"><Dir text={s.title} /></div>
                <div className="row-sub">
                  <Meta
                    parts={[
                      kindLabel(s.kind),
                      s.datetime ? formatDateTimeShort(s.datetime.value, s.datetime.precision) : null,
                      <ConsentBadge key="c" consent={s.consent} />,
                    ]}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Findings */}
      <div className="panel">
        <div className="panel-head">
          <h2 className="sec-title">
            Findings <span className="count">{project.findings.length}</span>
          </h2>
          <button className="btn-link" onClick={onAddFinding}>Add finding</button>
        </div>
        <div className="list">
          {project.findings.length === 0 && <div className="empty">No findings yet.</div>}
          {project.findings.map((f) => (
            <div
              key={f.id}
              className="row"
              data-selected={f.id === selectedFindingId}
              data-hovered={f.id === hoveredId && f.id !== selectedFindingId}
              {...rowButton(() => selectFinding(f.id))}
              onMouseEnter={() => hover(f.id)}
              onMouseLeave={() => hover(null)}
            >
              <div className="row-main">
                <div className="row-title" style={{ whiteSpace: 'normal' }}>{f.statement}</div>
                <div className="row-sub">
                  <Meta
                    parts={[
                      <CertaintyBadge key="c" certainty={f.certainty} />,
                      `${f.supportedBy.length} source${f.supportedBy.length === 1 ? '' : 's'} cited`,
                    ]}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sync events: shared moments that put the sources on one clock */}
      <div className="panel">
        <div className="panel-head">
          <h2 className="sec-title">
            Sync events <span className="count">{project.syncEvents.length}</span>
          </h2>
          <button className="btn-link" onClick={onAddSyncEvent}>Add event</button>
        </div>
        <div className="list">
          {project.syncEvents.length === 0 && (
            <div className="empty">No sync events. Add a moment seen or heard in more than one source to align their clocks.</div>
          )}
          {project.syncEvents.map((e) => {
            const t = clocks.events[e.id]
            const flagged = flaggedEvents.has(e.id)
            return (
              <div
                key={e.id}
                className="row"
                data-selected={e.id === selectedSyncEventId}
                data-hovered={e.id === hoveredId && e.id !== selectedSyncEventId}
                data-withheld={flagged}
                {...rowButton(() => selectSyncEvent(e.id))}
                onMouseEnter={() => hover(e.id)}
                onMouseLeave={() => hover(null)}
              >
                <div className="row-main">
                  <div className="row-title"><Dir text={e.label || 'Untitled event'} /></div>
                  <div className="row-sub">
                    <Meta
                      parts={[
                        e.kind === 'sound' ? 'Heard' : e.kind === 'visual' ? 'Seen' : 'Seen and heard',
                        `${e.observations.length} reading${e.observations.length === 1 ? '' : 's'}`,
                        t?.anchored ? <span key="t" className="mono">{new Date(t.timeSec * 1000).toISOString().slice(11, 19)}</span> : null,
                        flagged ? <span key="f" className="alert">Inconsistent</span> : null,
                      ]}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
