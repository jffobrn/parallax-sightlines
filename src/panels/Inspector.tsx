import { useStore } from '../state/store'
import { ConsentBadge, Dir, kindLabel } from '../components/ui'
import { SourceEditor } from './SourceEditor'
import { FindingEditor } from './FindingEditor'
import { IncidentEditor } from './IncidentEditor'
import { SyncEventEditor } from './SyncEventEditor'

export function Inspector() {
  const project = useStore((s) => s.project)
  const selectedSourceId = useStore((s) => s.selectedSourceId)
  const selectedFindingId = useStore((s) => s.selectedFindingId)
  const selectedSyncEventId = useStore((s) => s.selectedSyncEventId)

  const source = selectedSourceId
    ? project.sources.find((s) => s.id === selectedSourceId)
    : undefined
  const finding = selectedFindingId
    ? project.findings.find((f) => f.id === selectedFindingId)
    : undefined

  const syncEvent = selectedSyncEventId
    ? project.syncEvents.find((e) => e.id === selectedSyncEventId)
    : undefined

  if (syncEvent) {
    return (
      <>
        <div className="inspector-head">
          <div className="kicker">Sync event</div>
          <div className="inspector-title">
            <Dir text={syncEvent.label || 'Untitled event'} />
          </div>
        </div>
        <div className="scroll-y grow">
          <SyncEventEditor key={syncEvent.id} event={syncEvent} />
        </div>
      </>
    )
  }

  if (source) {
    return (
      <>
        <div className="inspector-head">
          <div className="kicker">
            <span>Source, {kindLabel(source.kind).toLowerCase()}</span>
            <ConsentBadge consent={source.consent} />
          </div>
          <div className="inspector-title">
            <Dir text={source.title} />
          </div>
        </div>
        <div className="scroll-y grow">
          <SourceEditor source={source} />
        </div>
      </>
    )
  }

  if (finding) {
    return (
      <>
        <div className="inspector-head">
          <div className="kicker">Finding</div>
        </div>
        <div className="scroll-y grow">
          <FindingEditor finding={finding} />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="inspector-head">
        <div className="kicker">Incident</div>
        <div className="inspector-title">Editing the incident</div>
      </div>
      <div className="scroll-y grow">
        <IncidentEditor />
      </div>
    </>
  )
}
