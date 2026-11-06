import { useStore } from '../state/store'
import { ConsentBadge, Dir, kindLabel } from '../components/ui'
import { SourceEditor } from './SourceEditor'
import { FindingEditor } from './FindingEditor'
import { IncidentEditor } from './IncidentEditor'
import { SyncEventEditor } from './SyncEventEditor'

function PaneHead({ where }: { where: string }) {
  return (
    <div className="pane-head">
      <span>Properties</span>
      <span className="faint" style={{ fontWeight: 400 }}>{where}</span>
    </div>
  )
}

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
        <PaneHead where={`Sync event ${project.syncEvents.indexOf(syncEvent) + 1} of ${project.syncEvents.length}`} />
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
        <PaneHead where={`Source ${project.sources.indexOf(source) + 1} of ${project.sources.length}`} />
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
        <PaneHead where={`Finding ${project.findings.indexOf(finding) + 1} of ${project.findings.length}`} />
        <div className="scroll-y grow">
          <FindingEditor finding={finding} />
        </div>
      </>
    )
  }

  return (
    <>
      <PaneHead where="Incident" />
      <div className="scroll-y grow">
        <IncidentEditor />
      </div>
    </>
  )
}
