import { useMemo } from 'react'
import { formatLatLng, type ResectionSet } from '../core'
import { getResection } from '../lib/derive'
import {
  type EllipseInput,
  resectionEllipse,
  sigmaForConfidence,
  type UncertaintyEllipse,
} from '../lib/uncertainty'
import { useStore } from '../state/store'

/** The resection and its 95% ellipse, derived from the project's vantages. */
export function useCrossing(): { resection: ResectionSet; ellipse: UncertaintyEllipse | null } {
  const project = useStore((s) => s.project)
  const resection = useMemo(() => getResection(project), [project])
  const ellipse = useMemo<UncertaintyEllipse | null>(() => {
    const inputs: EllipseInput[] = []
    for (const s of project.sources) {
      const v = s.vantage
      if (v && Number.isFinite(v.lat) && Number.isFinite(v.lng)) {
        inputs.push({ id: s.id, lat: v.lat, lng: v.lng, bearingDeg: v.bearingDeg, sigmaDeg: sigmaForConfidence(v.confidence) })
      }
    }
    return resectionEllipse(inputs)
  }, [project])
  return { resection, ellipse }
}

/** Round an adopted crossing to ~0.1 m so it does not carry float noise. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * The crossing, read in the rail beside the evidence rather than floated over
 * the map. It reports the strongest
 * crossing of the vantage rays, says plainly when the geometry is weak or the
 * crossing falls behind a camera, and offers the fix as a subject or incident
 * place the user accepts. Convergence of several rays is the image complex.
 */
export function CrossingCard() {
  const { resection, ellipse } = useCrossing()
  const project = useStore((s) => s.project)
  const selectedSourceId = useStore((s) => s.selectedSourceId)
  const patchIncident = useStore((s) => s.patchIncident)
  const updateSource = useStore((s) => s.updateSource)

  const vantageCount = project.sources.filter((s) => s.vantage).length
  if (vantageCount < 2) return null

  const best = resection.best
  const point = best?.point

  const adoptAsPlace = () => {
    if (!point) return
    const prev = project.incident.place
    patchIncident({
      place: {
        lat: round6(point.lat),
        lng: round6(point.lng),
        safeToPublish: prev?.safeToPublish ?? true,
        name: prev?.name,
      },
    })
  }

  const setAsSubject = () => {
    if (!point || !selectedSourceId) return
    const src = project.sources.find((s) => s.id === selectedSourceId)
    updateSource(selectedSourceId, {
      subject: {
        lat: round6(point.lat),
        lng: round6(point.lng),
        safeToPublish: src?.subject?.safeToPublish ?? true,
      },
    })
  }

  return (
    <section className="crossing" aria-label="Crossing">
      <div className="between">
        <h2 className="sec-title">
          Crossing <span className="count">{vantageCount} vantages</span>
        </h2>
      </div>

      {best && point ? (
        <>
          <dl className="kv">
            <dt>Fix</dt>
            <dd className="mono">{formatLatLng(point.lat, point.lng)}</dd>
            <dt>Angle</dt>
            <dd>
              <span className="mono">{best.crossingAngleDeg.toFixed(0)}&deg;</span>{' '}
              <span className="faint">({Math.round(best.quality * 100)}% strength)</span>
            </dd>
            {resection.points.length > 1 && (
              <>
                <dt>Spread</dt>
                <dd className="mono">{resection.spreadM.toFixed(0)} m</dd>
              </>
            )}
            {ellipse && (
              <>
                <dt>95% region</dt>
                <dd className="mono">
                  {ellipse.semiMajorM.toFixed(0)} &times; {ellipse.semiMinorM.toFixed(0)} m
                </dd>
              </>
            )}
          </dl>

          {best.weak && (
            <div className="warn" style={{ marginTop: 8 }}>
              Rays are close to parallel: this fix is unstable. Treat it as weak
              geometry, not a confident point.
            </div>
          )}

          <div className="btn-row">
            <button className="btn btn-sm" onClick={adoptAsPlace}>
              Adopt as incident place
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={setAsSubject}
              disabled={!selectedSourceId}
              title={
                selectedSourceId
                  ? 'Set this crossing as the subject of the selected source'
                  : 'Select a source first'
              }
            >
              Set as subject
            </button>
          </div>
        </>
      ) : (
        <div className="note-box" style={{ marginTop: 8 }}>
          The rays do not cross ahead of both cameras. Adjust a bearing or a
          station until they converge on the subject.
        </div>
      )}

      <p className="faint" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
        Planar resection at incident scale: a defensible candidate, not a
        verified geolocation.
      </p>
    </section>
  )
}
