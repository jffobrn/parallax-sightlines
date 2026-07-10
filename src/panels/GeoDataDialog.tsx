import * as Dialog from '@radix-ui/react-dialog'
import { useStore } from '../state/store'
import { downloadText } from '../lib/interchange'
import { collectPoints, projectCsv, projectGeoJson } from '../lib/exportGeo'
import { slugify } from '../lib/download'

export function GeoDataDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const project = useStore((s) => s.project)
  const pts = collectPoints(project)
  const base = slugify(project.incident.titles[0]?.text ?? 'project')

  const exportGeoJson = () =>
    downloadText(`${base}.geojson`, projectGeoJson(project), 'application/geo+json')
  const exportCsv = () => downloadText(`${base}.csv`, projectCsv(project), 'text/csv')

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content ticks">
          <Dialog.Title className="dialog-title">
            Map data <span className="faint">// GeoJSON and CSV</span>
          </Dialog.Title>
          <Dialog.Description className="dialog-desc">
            Export placed points for QGIS and other mapping tools.
          </Dialog.Description>

          <div className="prose" style={{ fontSize: 13 }}>
            <p style={{ marginBottom: 12 }}>
              {pts.length} placed point{pts.length === 1 ? '' : 's'}: the incident place,
              subjects, camera vantages, the resection crossing, and located findings.
              Vantages carry their bearing. Coordinates are written in full, so this is
              for your own use, not the consent-cleared publication.
            </p>
            <div className="btn-row">
              <button
                className="btn btn-sm btn-primary"
                onClick={exportGeoJson}
                disabled={pts.length === 0}
              >
                Export GeoJSON
              </button>
              <button className="btn btn-sm" onClick={exportCsv} disabled={pts.length === 0}>
                Export CSV
              </button>
            </div>
            {pts.length === 0 && (
              <p className="faint" style={{ marginTop: 10, fontSize: 12 }}>
                Nothing is placed yet. Add a subject or a vantage and it will appear here.
              </p>
            )}
          </div>

          <Dialog.Close asChild>
            <button className="dialog-close" aria-label="Close">
              &times;
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
