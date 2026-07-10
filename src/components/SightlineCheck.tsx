import { useState } from 'react'
import {
  DEFAULT_ZOOM,
  type ElevationProfile,
  type LineOfSight,
  lineOfSight,
  sampleLine,
  terrariumProvider,
} from '../lib/terrain'
import type { GeoPoint, Vantage } from '../core'

const OBSERVER_M = 1.6

function fmtM(m: number): string {
  return m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m'
}

/**
 * Terrain line-of-sight check between a camera vantage and its subject. Samples a
 * tokenless DEM along the line and reports whether the ground blocks the view. A
 * screening check over public elevation data, not a survey.
 */
export function SightlineCheck({ vantage, subject }: { vantage: Vantage; subject: GeoPoint }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [profile, setProfile] = useState<ElevationProfile | null>(null)
  const [los, setLos] = useState<LineOfSight | null>(null)

  const run = async () => {
    setBusy(true)
    setErr(null)
    try {
      const prof = await sampleLine(vantage, subject, 200, DEFAULT_ZOOM, terrariumProvider)
      if (!prof) {
        setErr('Elevation tiles could not be read (offline, blocked, or no coverage).')
        setProfile(null)
        setLos(null)
        return
      }
      setProfile(prof)
      setLos(lineOfSight(prof, OBSERVER_M))
    } catch {
      setErr('Terrain check failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="divider" />
      <span className="label">Terrain line of sight</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        Whether the ground between the vantage and the subject blocks the view.
      </p>
      <button className="btn btn-sm" onClick={run} disabled={busy}>
        {busy ? 'Sampling terrain...' : profile ? 'Re-check' : 'Check line of sight'}
      </button>
      {err && (
        <p className="alert" style={{ fontSize: 11, marginTop: 6 }}>
          {err}
        </p>
      )}
      {profile && los && (
        <>
          <div className={'sightline-verdict ' + (los.clear ? 'clear' : 'blocked')}>
            {los.clear ? 'Clear line of sight' : 'Blocked by terrain'}
          </div>
          <ProfileChart profile={profile} los={los} />
          <dl className="kv" style={{ marginTop: 8 }}>
            <dt>Distance</dt>
            <dd className="mono">{fmtM(profile.totalM)}</dd>
            <dt>Vantage</dt>
            <dd className="mono">{Math.round(los.observerElev)} m</dd>
            <dt>Subject</dt>
            <dd className="mono">{Math.round(los.targetElev)} m</dd>
            {los.clear ? (
              <>
                <dt>Min clearance</dt>
                <dd className="mono">
                  {Number.isFinite(los.minClearanceM) ? fmtM(los.minClearanceM) : '--'}
                </dd>
              </>
            ) : (
              <>
                <dt>Obstruction</dt>
                <dd className="mono">
                  {fmtM(los.maxIntrusionM)}
                  {los.intrusionAtM !== undefined ? ` at ${fmtM(los.intrusionAtM)}` : ''}
                </dd>
              </>
            )}
          </dl>
          <p className="faint" style={{ fontSize: 11, marginTop: 6 }}>
            Terrarium DEM, observer {OBSERVER_M} m above ground, curvature and refraction
            corrected. A screening check, not a survey.
          </p>
        </>
      )}
    </>
  )
}

function ProfileChart({ profile, los }: { profile: ElevationProfile; los: LineOfSight }) {
  const W = 220
  const H = 92
  const P = 5
  const obsEye = los.observerElev + OBSERVER_M
  const elevs = profile.points.map((p) => p.elev)
  const eMin = Math.min(...elevs, obsEye, los.targetElev)
  const eMax = Math.max(...elevs, obsEye, los.targetElev)
  const eRange = Math.max(1, eMax - eMin)
  const X = (d: number) => P + (d / profile.totalM) * (W - 2 * P)
  const Y = (e: number) => P + (1 - (e - eMin) / eRange) * (H - 2 * P)

  const terrain = profile.points.map((p) => `${X(p.d).toFixed(1)},${Y(p.elev).toFixed(1)}`)
  const terrainPath = 'M' + terrain.join(' L ')
  const areaPath = `${terrainPath} L ${X(profile.totalM).toFixed(1)},${H - P} L ${X(0).toFixed(1)},${H - P} Z`

  // Nearest sampled point to the obstruction, for the marker.
  let mark: { x: number; y: number } | null = null
  if (!los.clear && los.intrusionAtM !== undefined) {
    let best = profile.points[0]
    for (const p of profile.points)
      if (Math.abs(p.d - los.intrusionAtM) < Math.abs(best.d - los.intrusionAtM)) best = p
    mark = { x: X(best.d), y: Y(best.elev) }
  }

  return (
    <svg className="elev-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="elevation profile">
      <path d={areaPath} fill="rgba(127,168,191,0.16)" />
      <path d={terrainPath} fill="none" stroke="#7fa8bf" strokeWidth="1" />
      <line
        x1={X(0)}
        y1={Y(obsEye)}
        x2={X(profile.totalM)}
        y2={Y(los.targetElev)}
        stroke={los.clear ? '#9cc98a' : '#e5544b'}
        strokeWidth="1.2"
        strokeDasharray={los.clear ? '' : '3 2'}
      />
      {mark && <circle cx={mark.x} cy={mark.y} r="2.6" fill="#e5544b" />}
    </svg>
  )
}
