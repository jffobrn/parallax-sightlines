import { useStore } from '../state/store'
import { ConsentBadge, Dir } from '../components/ui'
import { SourceEditor } from './SourceEditor'
import { FindingEditor } from './FindingEditor'
import { IncidentEditor } from './IncidentEditor'

export function Inspector() {
  const project = useStore((s) => s.project)
  const selectedSourceId = useStore((s) => s.selectedSourceId)
  const selectedFindingId = useStore((s) => s.selectedFindingId)

  const source = selectedSourceId
    ? project.sources.find((s) => s.id === selectedSourceId)
    : undefined
  const finding = selectedFindingId
    ? project.findings.find((f) => f.id === selectedFindingId)
    : undefined

  if (source) {
    return (
      <>
        <div className="panel-head">
          <span className="label"><span className="label-num">EX</span>Exhibit</span>
          <ConsentBadge consent={source.consent} />
        </div>
        <div className="inspector-title">
          <Dir text={source.title} />
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
        <div className="panel-head">
          <span className="label"><span className="label-num">FN</span>Finding</span>
        </div>
        <div className="scroll-y grow">
          <FindingEditor finding={finding} />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="panel-head">
        <span className="label"><span className="label-num">IN</span>Incident</span>
      </div>
      <div className="scroll-y grow">
        <IncidentEditor />
      </div>
    </>
  )
}
