import {
  formatDateTimeShort,
  newId,
  type Finding,
  type Source,
} from '../core'
import { useStore } from '../state/store'
import { CertaintyBadge, ConsentBadge, Dir, KindBadge, rowButton } from '../components/ui'

export function Rail() {
  const project = useStore((s) => s.project)
  const selectedSourceId = useStore((s) => s.selectedSourceId)
  const selectedFindingId = useStore((s) => s.selectedFindingId)
  const hoveredId = useStore((s) => s.hoveredId)
  const select = useStore((s) => s.select)
  const selectFinding = useStore((s) => s.selectFinding)
  const hover = useStore((s) => s.hover)
  const addSource = useStore((s) => s.addSource)
  const addFinding = useStore((s) => s.addFinding)

  const incident = project.incident
  const editingIncident = !selectedSourceId && !selectedFindingId

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

  return (
    <>
      {/* Incident summary / open incident editor */}
      <button
        className="incident-card"
        data-active={editingIncident}
        onClick={() => select(null)}
      >
        <div className="between">
          <span className="label"><span className="label-num">01</span>Incident</span>
          <span className="tag">{incident.type}</span>
        </div>
        <div className="incident-titles">
          {incident.titles.map((t, i) => (
            <div key={i} className={i === 0 ? 'incident-title' : 'incident-title-alt'}>
              <Dir text={t.text || 'Untitled'} />
            </div>
          ))}
        </div>
        <div className="row-sub" style={{ padding: 0 }}>
          {incident.window.start ? formatDateTimeShort(incident.window.start, incident.window.precision) : 'no window'}
          {incident.window.end ? ` -> ${formatDateTimeShort(incident.window.end, incident.window.precision)}` : ''}
        </div>
      </button>

      {/* Exhibits */}
      <div className="panel">
        <div className="panel-head">
          <span className="label"><span className="label-num">02</span>Exhibits</span>
          <span className="faint mono" style={{ fontSize: 11 }}>{project.sources.length}</span>
          <button className="btn btn-sm btn-ghost" onClick={onAddSource}>+ Source</button>
        </div>
        <div className="list">
          {project.sources.length === 0 && <div className="empty">No sources yet.</div>}
          {project.sources.map((s) => (
            <div
              key={s.id}
              className="row"
              data-selected={s.id === selectedSourceId}
              data-hovered={s.id === hoveredId && s.id !== selectedSourceId}
              {...rowButton(() => select(s.id))}
              onMouseEnter={() => hover(s.id)}
              onMouseLeave={() => hover(null)}
            >
              <div className="row-main">
                <div className="row-title"><Dir text={s.title} /></div>
                <div className="row-sub">
                  <KindBadge kind={s.kind} />
                  <ConsentBadge consent={s.consent} />
                  {s.vantage && <span title="has a vantage">V</span>}
                  {s.subject && <span title="has a subject">S</span>}
                  {s.datetime && <span>{formatDateTimeShort(s.datetime.value, s.datetime.precision)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Findings */}
      <div className="panel">
        <div className="panel-head">
          <span className="label"><span className="label-num">03</span>Findings</span>
          <span className="faint mono" style={{ fontSize: 11 }}>{project.findings.length}</span>
          <button className="btn btn-sm btn-ghost" onClick={onAddFinding}>+ Finding</button>
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
                  <CertaintyBadge certainty={f.certainty} />
                  <span>{f.supportedBy.length} cited</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
