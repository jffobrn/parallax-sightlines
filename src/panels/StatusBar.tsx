import { formatLatLng } from '../core'
import { useStore } from '../state/store'
import { useCursorElevation } from '../state/useCursorElevation'
import { useCrossing } from '../map/CrossingCard'
import { Count } from '../components/ui'

/**
 * The status bar: where the cursor is, what the crossing currently says, and
 * what the case holds, including how much is withheld from publication.
 * Outcome messages (saved, imported, reset) appear here too.
 */
export function StatusBar() {
  const project = useStore((s) => s.project)
  const cursor = useStore((s) => s.cursor)
  const notice = useStore((s) => s.notice)
  const elev = useCursorElevation()
  const { resection } = useCrossing()

  const vantages = project.sources.filter((s) => s.vantage).length
  const best = resection.best
  const publicCount = project.sources.filter((s) => s.consent === 'public').length
  const withheld = project.sources.length - publicCount

  return (
    <footer className="statusbar readout" aria-live="polite">
      <span className="status-cursor">
        {cursor ? <span className="mono">{formatLatLng(cursor.lat, cursor.lng)}</span> : 'Move over the map for coordinates'}
        {cursor && elev !== null ? `, elevation ${elev} m` : ''}
      </span>
      {vantages >= 2 && (
        <span>
          {best
            ? `Crossing: ${vantages} vantages, ${Math.round(best.crossingAngleDeg)}°${best.weak ? ', weak geometry' : ''}${
                resection.points.length > 1 ? `, spread ${resection.spreadM.toFixed(0)} m` : ''
              }`
            : 'Crossing: rays do not meet ahead of the cameras'}
        </span>
      )}
      <span className="status-right">
        {notice && <span className="status-notice">{notice}</span>}
        <span>
          <Count n={project.sources.length} noun="source" />, <b>{publicCount}</b> public
        </span>
        <span>
          <Count n={project.findings.length} noun="finding" />
        </span>
        {withheld > 0 && (
          <span className="alert">
            {withheld} withheld from publication
          </span>
        )}
      </span>
    </footer>
  )
}
