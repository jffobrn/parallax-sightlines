import { useEffect, useMemo, useRef, useState } from 'react'
import { formatMediaTime, parseMediaTime, type SyncEvent, type SyncObservation } from '../core'
import { useStore } from '../state/store'
import { solveClocks } from '../lib/clock'
import { originZones, DEFAULT_RANGE_M } from '../lib/zones'
import { ConsentBadge, Dir, EnumSeg, Field, SelectMenu } from '../components/ui'

const KIND_OPTIONS = [
  { value: 'visual', label: 'SEEN' },
  { value: 'sound', label: 'HEARD' },
  { value: 'both', label: 'BOTH' },
] as const

/**
 * A text field that holds what is typed and commits only a valid parse, so a
 * partial entry ("1:4", "12.") never writes NaN into the record. It resyncs
 * when the stored value changes from outside.
 */
function ParsedInput({
  value,
  format,
  parse,
  onCommit,
  placeholder,
  ariaLabel,
}: {
  value: number | undefined
  format: (n: number) => string
  parse: (t: string) => number | null
  onCommit: (n: number | undefined) => void
  placeholder?: string
  ariaLabel: string
}) {
  const [text, setText] = useState(value === undefined ? '' : format(value))
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setText(value === undefined ? '' : format(value))
    }
  }, [value, format])
  return (
    <input
      className="input input-mono"
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        if (!e.target.value.trim()) {
          last.current = undefined
          onCommit(undefined)
          return
        }
        const n = parse(e.target.value)
        if (n !== null && Number.isFinite(n)) {
          last.current = n
          onCommit(n)
        }
      }}
    />
  )
}

const num = (t: string) => {
  const v = Number(t.trim())
  return t.trim() && Number.isFinite(v) ? v : null
}
const plain = (n: number) => String(n)

/**
 * A sync event is a moment observable in more than one source. Each reading
 * records where in one source's media the moment falls, how precisely, and
 * optionally the bearing band in which its origin lies. The clocks and the zone
 * of possible origin are derived from the readings, live.
 */
export function SyncEventEditor({ event }: { event: SyncEvent }) {
  const project = useStore((s) => s.project)
  const updateSyncEvent = useStore((s) => s.updateSyncEvent)
  const removeSyncEvent = useStore((s) => s.removeSyncEvent)
  const [confirmDel, setConfirmDel] = useState(false)
  const id = event.id

  const sol = useMemo(() => solveClocks(project), [project])
  const zone = useMemo(() => originZones(project).find((z) => z.eventId === id), [project, id])
  const ev = sol.events[id]
  const group = ev ? sol.groups.find((g) => g.id === ev.group) : undefined
  const residualOf = (sid: string) => sol.residuals.find((r) => r.eventId === id && r.sourceId === sid)
  const flagged = sol.residuals.filter((r) => r.eventId === id && r.flagged)

  const setObs = (i: number, partial: Partial<SyncObservation>) =>
    updateSyncEvent(id, (e) => ({
      observations: e.observations.map((o, j) => (j === i ? { ...o, ...partial } : o)),
    }))
  const removeObs = (i: number) =>
    updateSyncEvent(id, (e) => ({ observations: e.observations.filter((_, j) => j !== i) }))
  const addObs = () => {
    const used = new Set(event.observations.map((o) => o.sourceId))
    const next = project.sources.find((s) => !used.has(s.id)) ?? project.sources[0]
    if (!next) return
    updateSyncEvent(id, (e) => ({
      observations: [...e.observations, { sourceId: next.id, mediaTimeSec: 0, uncertaintySec: 0.5 }],
    }))
  }
  const sourceOptions = project.sources.map((s) => ({ value: s.id, label: s.title }))

  return (
    <div className="panel-body" style={{ paddingTop: 12 }}>
      <Field label="Label">
        <input
          className="input"
          dir="auto"
          value={event.label}
          onChange={(e) => updateSyncEvent(id, { label: e.target.value })}
        />
      </Field>
      <Field label="Observed as">
        <EnumSeg
          value={event.kind}
          options={KIND_OPTIONS as unknown as { value: SyncEvent['kind']; label: string }[]}
          onChange={(kind) => updateSyncEvent(id, { kind })}
        />
      </Field>

      {ev && (
        <div className="note" style={{ marginTop: 4 }}>
          {ev.anchored ? (
            <>
              Happened at <b className="mono">{new Date(ev.timeSec * 1000).toISOString().slice(11, 21)}</b> UTC,
              plus or minus {ev.sigmaSec.toFixed(1)} s.
            </>
          ) : (
            <>
              Floating: no anchored clock reaches this event, so it is placed only relative to{' '}
              <Dir text={project.sources.find((s) => s.id === ev.refSourceId)?.title ?? 'the reference'} />, at{' '}
              <span className="mono">{formatMediaTime(ev.timeSec)}</span> into it.
            </>
          )}
          {group && group.redundancy <= 0 && (
            <> No reading can yet be checked against the others: add another event or reading.</>
          )}
        </div>
      )}
      {flagged.length > 0 && (
        <div className="warn" style={{ marginTop: 8 }}>
          {flagged[0].ambiguous ? (
            <>
              The two readings of this event disagree with the other events by{' '}
              {Math.abs(flagged[0].residualSec).toFixed(1)} s. One of them is off, which may mark a splice, an edit, or a
              misread, and the evidence cannot yet say which. A third reading would tell.
            </>
          ) : (
            flagged.map((r) => (
              <div key={r.sourceId}>
                The reading in <Dir text={project.sources.find((s) => s.id === r.sourceId)?.title ?? r.sourceId} />{' '}
                disagrees with the rest by {Math.abs(r.residualSec).toFixed(1)} s and is set aside from the alignment.
              </div>
            ))
          )}
        </div>
      )}

      <div className="divider" />
      <span className="label">Readings</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        Where the moment falls in each source&apos;s media (m:ss.s), and how precisely. A bearing band, from a source
        with a placed vantage, bounds where the moment came from.
      </p>
      {event.observations.length === 0 && <div className="empty">No readings yet.</div>}
      {event.observations.map((o, i) => {
        const src = project.sources.find((s) => s.id === o.sourceId)
        const r = residualOf(o.sourceId)
        return (
          <div key={i} className="sync-reading" data-flagged={!!r?.flagged}>
            <div className="sync-reading-head">
              <SelectMenu value={o.sourceId} options={sourceOptions} onChange={(v) => setObs(i, { sourceId: v })} ariaLabel="source" />
              {src && <ConsentBadge consent={src.consent} />}
            </div>
            <div className="field-row">
              <Field label="At (in media)">
                <ParsedInput
                  value={o.mediaTimeSec}
                  format={formatMediaTime}
                  parse={parseMediaTime}
                  onCommit={(n) => n !== undefined && setObs(i, { mediaTimeSec: n })}
                  placeholder="1:42.3"
                  ariaLabel="media time"
                />
              </Field>
              <Field label="± seconds">
                <ParsedInput
                  value={o.uncertaintySec}
                  format={plain}
                  parse={num}
                  onCommit={(n) => n !== undefined && n >= 0 && setObs(i, { uncertaintySec: n })}
                  ariaLabel="uncertainty"
                />
              </Field>
            </div>
            <div className="field-row field-row-3">
              <Field label="Origin bearing from">
                <ParsedInput
                  value={o.bearingFromDeg}
                  format={plain}
                  parse={num}
                  onCommit={(n) => setObs(i, { bearingFromDeg: n })}
                  placeholder="deg"
                  ariaLabel="bearing from"
                />
              </Field>
              <Field label="to">
                <ParsedInput
                  value={o.bearingToDeg}
                  format={plain}
                  parse={num}
                  onCommit={(n) => setObs(i, { bearingToDeg: n })}
                  placeholder="deg"
                  ariaLabel="bearing to"
                />
              </Field>
              <Field label="Range m">
                <ParsedInput
                  value={o.maxRangeM}
                  format={plain}
                  parse={num}
                  onCommit={(n) => setObs(i, { maxRangeM: n })}
                  placeholder={String(DEFAULT_RANGE_M)}
                  ariaLabel="max range"
                />
              </Field>
            </div>
            {o.bearingFromDeg !== undefined && o.bearingToDeg !== undefined && !src?.vantage && (
              <div className="warn" style={{ fontSize: 11 }}>This source has no placed vantage, so the band cannot be drawn.</div>
            )}
            {r && !r.flagged && group && group.redundancy > 0 && (
              <span className="faint mono" style={{ fontSize: 10 }}>fits the others to {Math.abs(r.residualSec).toFixed(2)} s</span>
            )}
            <button className="btn btn-sm btn-ghost" style={{ marginTop: 4 }} onClick={() => removeObs(i)}>
              Remove reading
            </button>
          </div>
        )
      })}
      <button className="btn btn-sm btn-ghost" onClick={addObs} disabled={project.sources.length === 0}>
        + Reading
      </button>

      {zone && (
        <>
          <div className="divider" />
          <span className="label">Zone of possible origin</span>
          <p className="faint" style={{ fontSize: 11, margin: '4px 0 0' }}>
            {zone.empty
              ? 'The bearing bands do not meet: the readings contradict each other on where this came from.'
              : zone.wedges === 1
                ? `One band, ${Math.round(zone.areaM2).toLocaleString()} m², bounded only by its range. A second band from another vantage would close it.`
                : `${zone.wedges} bands meet in ${Math.round(zone.areaM2).toLocaleString()} m². The origin lies inside it; a point outside contradicts at least one source.`}
          </p>
        </>
      )}

      <div className="divider" />
      <Field label="Note">
        <textarea className="textarea" value={event.note ?? ''} onChange={(e) => updateSyncEvent(id, { note: e.target.value || undefined })} />
      </Field>
      <div className="divider" />
      {confirmDel ? (
        <div className="btn-row">
          <button className="btn btn-sm btn-danger" onClick={() => removeSyncEvent(id)}>Confirm delete</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirmDel(true)}>Delete event</button>
      )}
    </div>
  )
}
