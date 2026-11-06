/**
 * The Clock view: every clock-aligned source on one zoomed clock. One track per
 * source, its media span drawn from its synced start, with the start's
 * two-sigma band; shared events as lines across the tracks they were read in.
 * A reading the screening flags is marked where it would put the event, so the
 * disagreement is visible as a distance, not just a number.
 *
 * Anchored groups read in absolute time; a group no anchor reaches is drawn
 * relative to its reference source and labelled as floating.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { solveClocks, type ClockGroup, type ClockSolution } from '../lib/clock'
import { formatMediaTime } from '../core'
import { token, useTheme } from '../state/theme'

function readPal() {
  return {
    axis: token('--text-3'),
    grid: token('--line'),
    track: token('--line-strong'),
    sigma: token('--mark'),
    event: token('--text-2'),
    eventSel: token('--primary'),
    flag: token('--alert'),
    label: token('--text-2'),
    sel: token('--primary'),
  }
}
type Pal = ReturnType<typeof readPal>
const MONO = "'Plex Mono', ui-monospace, monospace"
const SANS = "'Archivo', sans-serif"
const M = { top: 30, right: 18, bottom: 24, left: 170 }
const TRACK_H = 22

/** Shorten at a word boundary, with an ellipsis, so a label never ends mid-word. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[,.;:]$/, '') + '\u2026'
}

function fmtClock(sec: number, anchored: boolean): string {
  if (!anchored) return (sec >= 0 ? '+' : '') + formatMediaTime(sec)
  return new Date(sec * 1000).toISOString().slice(11, 19)
}

function GroupChart({ group, sol, width, PAL }: { group: ClockGroup; sol: ClockSolution; width: number; PAL: Pal }) {
  const project = useStore((s) => s.project)
  const selectedSourceId = useStore((s) => s.selectedSourceId)
  const selectedSyncEventId = useStore((s) => s.selectedSyncEventId)
  const titleOf = (id: string) => project.sources.find((s) => s.id === id)?.title ?? id

  const srcs = group.sourceIds.map((id) => sol.sources[id]).filter(Boolean)
  const evs = group.eventIds.map((id) => sol.events[id]).filter(Boolean)
  const lo = Math.min(...srcs.map((s) => s.startSec - 2 * s.sigmaSec), ...evs.map((e) => e.timeSec))
  const hi = Math.max(...srcs.map((s) => s.startSec + (s.durationSec ?? 0)), ...evs.map((e) => e.timeSec))
  const pad = Math.max((hi - lo) * 0.06, 5)
  const d0 = lo - pad
  const d1 = hi + pad
  const innerW = Math.max(60, width - M.left - M.right)
  const x = (sec: number) => M.left + ((sec - d0) / (d1 - d0)) * innerW
  const height = M.top + srcs.length * (TRACK_H + 6) + M.bottom
  // One tick per ~90 px, so labels never collide.
  const nTicks = Math.max(2, Math.min(8, Math.floor(innerW / 90)))
  const ticks = Array.from({ length: nTicks + 1 }, (_, i) => d0 + ((d1 - d0) * i) / nTicks)
  const flagged = sol.residuals.filter((r) => r.flagged && group.eventIds.includes(r.eventId))
  const flaggedEvents = new Set(flagged.map((r) => r.eventId))
  const eventLabel = (id: string) => project.syncEvents.find((e) => e.id === id)?.label || 'Event'

  return (
    <svg width={width} height={height} style={{ display: 'block' }} role="img" aria-label="Clock alignment">
      <text x={8} y={16} fill={PAL.label} fontSize={12} fontFamily={SANS}>
        {group.anchored ? 'Anchored clock' : `Floating, relative to ${clip(titleOf(group.refSourceId!), 40)}`}
        {group.redundancy <= 0 ? ', no internal check possible yet' : ''}
      </text>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={x(t)} x2={x(t)} y1={M.top - 4} y2={height - M.bottom} stroke={PAL.grid} />
          <text x={x(t)} y={height - 6} fill={PAL.axis} fontSize={11} fontFamily={MONO} textAnchor="middle">
            {fmtClock(t, group.anchored)}
          </text>
        </g>
      ))}
      {srcs.map((s, i) => {
        const y = M.top + i * (TRACK_H + 6)
        const sel = s.sourceId === selectedSourceId
        const x0 = x(s.startSec)
        const x1 = x(s.startSec + (s.durationSec ?? 0))
        return (
          <g
            key={s.sourceId}
            style={{ cursor: 'pointer' }}
            onPointerDown={() => useStore.getState().select(s.sourceId)}
            aria-label={titleOf(s.sourceId)}
          >
            <text x={8} y={y + TRACK_H / 2 + 4} fill={sel ? PAL.eventSel : PAL.label} fontSize={12} fontFamily={SANS} fontWeight={sel ? 700 : 400}>
              {clip(titleOf(s.sourceId), 22)}
              <title>{titleOf(s.sourceId)}</title>
            </text>
            <rect
              x={x0}
              y={y}
              width={Math.max(2, x1 - x0)}
              height={TRACK_H}
              rx={2}
              fill={PAL.track}
              fillOpacity={sel ? 0.55 : 0.3}
              stroke={sel ? PAL.eventSel : PAL.track}
              strokeWidth={sel ? 1.6 : 0.8}
            />
            {s.sigmaSec > 0 && (
              <line x1={x(s.startSec - 2 * s.sigmaSec)} x2={x(s.startSec + 2 * s.sigmaSec)} y1={y + TRACK_H / 2} y2={y + TRACK_H / 2} stroke={PAL.sigma} strokeWidth={1.5} />
            )}
            {s.claimConflict && (
              <text x={x1 + 6} y={y + TRACK_H / 2 + 4} fill={PAL.flag} fontSize={12} fontFamily={SANS}>
                Claimed time differs
              </text>
            )}
          </g>
        )
      })}
      {evs.map((e) => {
        const sel = e.eventId === selectedSyncEventId
        const bad = flaggedEvents.has(e.eventId)
        return (
          <g key={e.eventId} style={{ cursor: 'pointer' }} onPointerDown={() => useStore.getState().selectSyncEvent(e.eventId)}>
            <line
              x1={x(e.timeSec)}
              x2={x(e.timeSec)}
              y1={M.top - 6}
              y2={height - M.bottom}
              stroke={bad ? PAL.flag : sel ? PAL.eventSel : PAL.event}
              strokeWidth={sel ? 2 : 1.2}
            />
            <rect x={x(e.timeSec) - 5} y={M.top - 6} width={10} height={height - M.bottom - M.top + 6} fill="transparent" />
            <title>{eventLabel(e.eventId)}</title>
          </g>
        )
      })}
      {flagged.filter((r) => !r.ambiguous).map((r) => {
        // Where this reading, taken alone, would put the event. An ambiguous
        // flag (an event read in only two sources) is shown on the event line
        // alone: drawing it on one track would blame a source the evidence
        // cannot single out.
        const s = sol.sources[r.sourceId]
        const i = srcs.indexOf(s)
        if (i < 0) return null
        const y = M.top + i * (TRACK_H + 6) + TRACK_H / 2
        const ev = sol.events[r.eventId]
        const implied = ev.timeSec - r.residualSec
        return (
          <g key={r.eventId + r.sourceId} pointerEvents="none">
            <line x1={x(ev.timeSec)} x2={x(implied)} y1={y} y2={y} stroke={PAL.flag} strokeWidth={1.5} strokeDasharray="2 2" />
            <circle cx={x(implied)} cy={y} r={3.5} fill={PAL.flag} />
          </g>
        )
      })}
    </svg>
  )
}

export function ClockView() {
  const project = useStore((s) => s.project)
  const theme = useTheme()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const PAL = useMemo(() => readPal(), [theme])
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(600)
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])
  const sol = useMemo(() => solveClocks(project), [project])
  const groups = [...sol.groups].sort((a, b) => Number(b.anchored) - Number(a.anchored))

  return (
    <div className="timeline-wrap" ref={wrapRef} style={{ overflowY: 'auto' }}>
      {groups.length === 0 ? (
        <div className="empty">
          No clock alignment yet. Add a sync event, then record where it falls in each source's media.
        </div>
      ) : (
        groups.map((g) => <GroupChart key={g.id} group={g} sol={sol} width={width} PAL={PAL} />)
      )}
    </div>
  )
}
