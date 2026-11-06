import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDateTime, formatMediaTime, parseMediaTime, type MediaClock, type Source } from '../core'
import { useStore } from '../state/store'
import { solveClocks } from '../lib/clock'
import { Dir, Field, Toggle } from '../components/ui'

/**
 * A source's media clock: how long its media runs, and whether its absolute
 * start is trusted enough to anchor the others. Below it, what the alignment
 * derives for this source, and where that disagrees with the source's own
 * claimed time. The claim is never overwritten; adopting the synced time is a
 * deliberate act.
 */
export function MediaClockPanel({ source }: { source: Source }) {
  const project = useStore((s) => s.project)
  const updateSource = useStore((s) => s.updateSource)
  const sol = useMemo(() => solveClocks(project), [project])
  const c = sol.sources[source.id]
  const clock = source.clock
  const setClock = (partial: Partial<MediaClock> | undefined) => {
    const cur = useStore.getState().project.sources.find((s) => s.id === source.id)?.clock
    const next = partial === undefined ? undefined : { ...cur, ...partial }
    updateSource(source.id, { clock: next && (next.durationSec !== undefined || next.anchor) ? next : undefined })
  }

  const [durText, setDurText] = useState(clock?.durationSec !== undefined ? formatMediaTime(clock.durationSec) : '')
  const lastDur = useRef(clock?.durationSec)
  useEffect(() => {
    if (clock?.durationSec !== lastDur.current) {
      lastDur.current = clock?.durationSec
      setDurText(clock?.durationSec !== undefined ? formatMediaTime(clock.durationSec) : '')
    }
  }, [clock?.durationSec])

  const anchor = clock?.anchor
  const refTitle = c?.refSourceId ? project.sources.find((s) => s.id === c.refSourceId)?.title : undefined

  const adopt = () => {
    if (!c?.anchored) return
    updateSource(source.id, {
      datetime: { value: new Date(Math.round(c.startSec) * 1000).toISOString().replace('.000Z', 'Z'), precision: 'second' },
    })
  }

  return (
    <>
      <div className="divider" />
      <span className="label">Media clock</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        For clips aligned on shared events. A photograph is media of zero length.
      </p>
      <Field label="Duration (m:ss)">
        <input
          className="input input-mono"
          inputMode="decimal"
          aria-label="media duration"
          placeholder="6:00"
          value={durText}
          onChange={(e) => {
            setDurText(e.target.value)
            if (!e.target.value.trim()) {
              lastDur.current = undefined
              setClock({ durationSec: undefined })
              return
            }
            const n = parseMediaTime(e.target.value)
            if (n !== null && n >= 0) {
              lastDur.current = n
              setClock({ durationSec: n })
            }
          }}
        />
      </Field>
      <Toggle
        checked={!!anchor}
        onChange={(on) =>
          setClock({
            anchor: on
              ? { startIso: source.datetime?.value ?? new Date().toISOString(), uncertaintySec: 1, basis: '' }
              : undefined,
          })
        }
        label="Anchor: this source's start time is trusted"
      />
      {anchor && (
        <div className="stack" style={{ marginTop: 8 }}>
          <div className="field-row">
            <Field label="Start (ISO, UTC)">
              <input
                className="input input-mono"
                value={anchor.startIso}
                onChange={(e) => setClock({ anchor: { ...anchor, startIso: e.target.value } })}
              />
            </Field>
            <Field label="± seconds">
              <input
                className="input input-mono"
                type="number"
                min={0}
                step={0.1}
                value={anchor.uncertaintySec}
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  if (Number.isFinite(n) && n >= 0) setClock({ anchor: { ...anchor, uncertaintySec: n } })
                }}
              />
            </Field>
          </div>
          <Field label="Basis" hint="Why this clock is trusted. Published with the alignment.">
            <input
              className="input"
              placeholder="e.g. the broadcaster's on-air clock, burned into the frame"
              value={anchor.basis}
              onChange={(e) => setClock({ anchor: { ...anchor, basis: e.target.value } })}
            />
          </Field>
          {Number.isNaN(Date.parse(anchor.startIso)) && (
            <div className="warn">The start time does not parse, so this anchor is ignored.</div>
          )}
        </div>
      )}

      {c && (
        <div className="note" style={{ marginTop: 10 }}>
          {c.anchored ? (
            <>
              Synced start <b className="mono">{new Date(c.startSec * 1000).toISOString().slice(11, 21)}</b> UTC,
              plus or minus {c.sigmaSec.toFixed(1)} s.
            </>
          ) : (
            <>
              Floating: aligned only relative to <Dir text={refTitle ?? 'its group'} />
              {c.refSourceId !== source.id && (
                <>, starting {formatMediaTime(c.startSec)} after it</>
              )}
              . Anchor any source in the group to place it in absolute time.
            </>
          )}
        </div>
      )}
      {c?.claimConflict && source.datetime && (
        <div className="warn clock-claim">
          The source&apos;s claimed time ({formatDateTime(source.datetime.value, source.datetime.precision)}) falls
          outside the synced start. The claim is kept as recorded; the disagreement may itself be a finding.
          <div style={{ marginTop: 6 }}>
            <button className="btn btn-sm" onClick={adopt}>
              Adopt the synced time
            </button>
          </div>
        </div>
      )}
    </>
  )
}
