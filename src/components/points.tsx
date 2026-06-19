import type { GeoPoint } from '../core'
import { Toggle } from './ui'

/**
 * Editing fields for a single ground point. The safe-to-publish switch is the
 * per-point consent control the boundary reads: when it is off, the published
 * output withholds or coarsens this coordinate.
 */
export function PointFields({
  point,
  onChange,
  onRemove,
  onPlace,
  placeLabel,
  placingActive,
}: {
  point: GeoPoint | undefined
  onChange: (p: GeoPoint) => void
  onRemove: () => void
  onPlace: () => void
  placeLabel: string
  placingActive: boolean
}) {
  if (!point) {
    return (
      <button
        type="button"
        className={`btn btn-sm ${placingActive ? 'btn-primary' : 'btn-ghost'}`}
        onClick={onPlace}
      >
        {placingActive ? 'Click the map...' : placeLabel}
      </button>
    )
  }

  const set = (partial: Partial<GeoPoint>) => onChange({ ...point, ...partial })

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="field-row">
        <input
          className="input input-mono"
          type="number"
          step="0.00001"
          aria-label="latitude"
          value={Number.isFinite(point.lat) ? point.lat : ''}
          onChange={(e) => set({ lat: parseFloat(e.target.value) })}
        />
        <input
          className="input input-mono"
          type="number"
          step="0.00001"
          aria-label="longitude"
          value={Number.isFinite(point.lng) ? point.lng : ''}
          onChange={(e) => set({ lng: parseFloat(e.target.value) })}
        />
      </div>
      <div className="between">
        <Toggle
          checked={point.safeToPublish}
          onChange={(v) => set({ safeToPublish: v })}
          label={point.safeToPublish ? 'safe to publish' : 'protected'}
        />
        <div className="btn-row">
          <button
            type="button"
            className={`btn btn-sm ${placingActive ? 'btn-primary' : 'btn-ghost'}`}
            onClick={onPlace}
          >
            {placingActive ? 'Click map...' : 'Move on map'}
          </button>
          <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}
