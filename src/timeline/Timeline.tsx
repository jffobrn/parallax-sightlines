import { useEffect, useMemo, useRef, useState } from 'react'
import { scaleTime } from '@visx/scale'
import { AxisBottom } from '@visx/axis'
import { Group } from '@visx/group'
import { useStore } from '../state/store'
import { timeExtent, timelineItems, type TimelineItem } from '../lib/derive'
import { token, useTheme } from '../state/theme'

/** Timeline colours, read from the design tokens so both themes follow. */
function readPal() {
  return {
    axis: token('--text-3'),
    label: token('--text-2'),
    halo: token('--surface-2'),
    grid: token('--line-2'),
    window: token('--signal-wash'),
    windowLine: token('--signal-line'),
    public: token('--line-strong'),
    restricted: token('--alert'),
    embargoed: token('--alert'),
    attested: token('--mark'),
    probable: token('--text-2'),
    uncertain: token('--text-3'),
    sel: token('--primary'),
    brush: token('--signal-wash'),
    brushLine: token('--signal-line'),
  }
}
type Pal = ReturnType<typeof readPal>

const M = { top: 12, right: 18, bottom: 24, left: 18 }
const MONO = "'Plex Mono', ui-monospace, monospace"
const SANS = "'Syne', sans-serif"

function itemColor(it: TimelineItem, PAL: Pal): string {
  if (it.kind === 'finding') {
    return it.certainty === 'attested'
      ? PAL.attested
      : it.certainty === 'probable'
        ? PAL.probable
        : PAL.uncertain
  }
  return it.consent === 'embargoed'
    ? PAL.embargoed
    : it.consent === 'restricted'
      ? PAL.restricted
      : PAL.public
}

function fmtTick(d: Date, spanMs: number): string {
  const iso = d.toISOString()
  if (spanMs < 2 * 86_400_000) return iso.slice(11, 16)
  if (spanMs < 120 * 86_400_000) return iso.slice(5, 10)
  return iso.slice(0, 7)
}

export function Timeline() {
  const theme = useTheme()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const PAL = useMemo(() => readPal(), [theme])
  const project = useStore((s) => s.project)
  const selectedSourceId = useStore((s) => s.selectedSourceId)
  const selectedFindingId = useStore((s) => s.selectedFindingId)
  const hoveredId = useStore((s) => s.hoveredId)
  const timeBrush = useStore((s) => s.timeBrush)

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 600, h: 150 })

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const items = useMemo(() => timelineItems(project), [project])
  const extent = useMemo(() => timeExtent(project), [project])

  const innerW = Math.max(40, size.w - M.left - M.right)
  const innerH = Math.max(30, size.h - M.top - M.bottom)

  const domain = useMemo<[number, number]>(() => {
    if (!extent) return [0, 1]
    const [a, b] = extent
    const pad = Math.max((b - a) * 0.05, 60_000)
    return [a - pad, b + pad]
  }, [extent])

  const scale = useMemo(
    () =>
      scaleTime({
        domain: [new Date(domain[0]), new Date(domain[1])],
        range: [0, innerW],
      }),
    [domain, innerW],
  )

  const x = (ms: number) => scale(new Date(ms))
  const spanMs = domain[1] - domain[0]

  // Lanes: claimed source times, then (when any source is clock-aligned) the
  // synced spans directly beneath them, then findings. A source's claim and
  // its synced time stay side by side; neither overwrites the other.
  const hasSynced = items.some((it) => it.kind === 'synced')
  const laneH = Math.min(hasSynced ? 14 : 18, innerH / (hasSynced ? 3 : 2) - 6)
  const sourcesY = innerH * (hasSynced ? 0.2 : 0.32)
  const syncedY = innerH * 0.5
  const findingsY = innerH * (hasSynced ? 0.8 : 0.72)
  const laneOf = (it: TimelineItem) =>
    it.kind === 'source' ? sourcesY : it.kind === 'synced' ? syncedY : findingsY

  const isSelected = (it: TimelineItem) =>
    ((it.kind === 'source' || it.kind === 'synced') && (it.sourceId ?? it.id) === selectedSourceId) ||
    (it.kind === 'finding' && it.id === selectedFindingId)

  const inBrush = (it: TimelineItem) =>
    !timeBrush || (it.end >= timeBrush.start && it.start <= timeBrush.end)

  const selectItem = (it: TimelineItem) => {
    if (it.kind === 'source') useStore.getState().select(it.id)
    else if (it.kind === 'synced') useStore.getState().select(it.sourceId!)
    else useStore.getState().selectFinding(it.id)
  }

  // ---- Brush (drag to filter; click to clear) ----
  const drag = useRef<{ x0: number } | null>(null)
  const [dragNow, setDragNow] = useState<{ a: number; b: number } | null>(null)

  const localX = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    return (rect ? clientX - rect.left : 0) - M.left
  }

  const onDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const px = Math.max(0, Math.min(innerW, localX(e.clientX)))
    drag.current = { x0: px }
    setDragNow({ a: px, b: px })
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const px = Math.max(0, Math.min(innerW, localX(e.clientX)))
    setDragNow({ a: Math.min(drag.current.x0, px), b: Math.max(drag.current.x0, px) })
  }
  const onUp = (e: React.PointerEvent) => {
    if (!drag.current) return
    // Compute from the final pointer position, not from intermediate state, so a
    // fast drag (or a programmatic one) commits reliably.
    const px = Math.max(0, Math.min(innerW, localX(e.clientX)))
    const a = Math.min(drag.current.x0, px)
    const b = Math.max(drag.current.x0, px)
    if (b - a < 4) {
      useStore.getState().setTimeBrush(null) // a click clears the filter
    } else {
      useStore.getState().setTimeBrush({
        start: scale.invert(a).getTime(),
        end: scale.invert(b).getTime(),
      })
    }
    drag.current = null
    setDragNow(null)
  }

  if (!extent) {
    return (
      <div className="timeline-wrap" ref={wrapRef}>
        <div className="empty">No dated sources yet. Add a datetime to place a source on the chronology.</div>
      </div>
    )
  }

  const win = project.incident.window
  const winStart = win.start ? Date.parse(win.start) : NaN
  const winEnd = win.end ? Date.parse(win.end) : NaN

  return (
    <div className="timeline-wrap" ref={wrapRef}>
      <svg width={size.w} height={size.h} style={{ display: 'block' }}>
        <Group left={M.left} top={M.top}>
          {/* incident window band */}
          {!Number.isNaN(winStart) && !Number.isNaN(winEnd) && (
            <rect
              x={x(winStart)}
              y={0}
              width={Math.max(1, x(winEnd) - x(winStart))}
              height={innerH}
              fill={PAL.window}
              stroke={PAL.windowLine}
              strokeDasharray="2 3"
            />
          )}

          {/* brush capture surface, painted under the items so item clicks win */}
          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            style={{ cursor: 'crosshair' }}
          />

          {/* lane labels */}
          <text x={0} y={sourcesY - laneH / 2 - 4} fill={PAL.label} fontSize={12} fontFamily={SANS} stroke={PAL.halo} strokeWidth={4} paintOrder="stroke">
            Sources
          </text>
          {hasSynced && (
            <text x={0} y={syncedY - laneH / 2 - 4} fill={PAL.label} fontSize={12} fontFamily={SANS} stroke={PAL.halo} strokeWidth={4} paintOrder="stroke">
              Synced
            </text>
          )}
          <text x={0} y={findingsY - laneH / 2 - 4} fill={PAL.label} fontSize={12} fontFamily={SANS} stroke={PAL.halo} strokeWidth={4} paintOrder="stroke">
            Findings
          </text>

          {/* items */}
          {items.map((it) => {
            const laneY = laneOf(it)
            const x0 = x(it.start)
            const x1 = x(it.end)
            const w = Math.max(0, x1 - x0)
            const col = itemColor(it, PAL)
            const sel = isSelected(it)
            const hov = (it.sourceId ?? it.id) === hoveredId
            const active = sel || hov
            const dim = !inBrush(it)
            const isPoint = w < 2

            return (
              <g
                key={it.id}
                style={{ cursor: 'pointer', opacity: dim ? 0.32 : 1 }}
                aria-label={it.kind === 'synced' ? `${it.label}, synced` : it.label}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  selectItem(it)
                }}
                onPointerEnter={() => useStore.getState().hover(it.sourceId ?? it.id)}
                onPointerLeave={() => useStore.getState().hover(null)}
              >
                {it.kind === 'synced' && it.sigmaMs !== undefined && it.sigmaMs > 0 && (
                  // The start's two-sigma band: where the clip could begin.
                  <line
                    x1={x(it.start - 2 * it.sigmaMs)}
                    x2={x(it.start + 2 * it.sigmaMs)}
                    y1={laneY}
                    y2={laneY}
                    stroke={PAL.attested}
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                )}
                {it.conflict && (
                  <text
                    x={x0 + 3}
                    y={laneY - laneH / 2 - 3}
                    fill={PAL.embargoed}
                    fontSize={12}
                    fontFamily={SANS}
                    pointerEvents="none"
                  >
                    Claimed time differs
                  </text>
                )}
                {isPoint ? (
                  <>
                    <line
                      x1={x0}
                      x2={x0}
                      y1={laneY - laneH / 2 - 3}
                      y2={laneY + laneH / 2 + 3}
                      stroke={col}
                      strokeWidth={active ? 2.5 : 1.5}
                    />
                    <circle cx={x0} cy={laneY - laneH / 2 - 5} r={active ? 3.5 : 2.5} fill={col} />
                  </>
                ) : (
                  <rect
                    x={x0}
                    y={laneY - laneH / 2}
                    width={w}
                    height={laneH}
                    rx={2}
                    fill={col}
                    fillOpacity={it.kind === 'finding' ? 0.5 : it.kind === 'synced' ? 0.6 : 0.35}
                    stroke={active ? PAL.sel : col}
                    strokeWidth={active ? 1.8 : 1}
                    strokeDasharray={it.certainty === 'uncertain' ? '3 2' : undefined}
                  />
                )}
              </g>
            )
          })}

          {/* live brush preview / committed brush */}
          {(() => {
            const band = dragNow ?? (timeBrush ? { a: x(timeBrush.start), b: x(timeBrush.end) } : null)
            if (!band) return null
            return (
              <rect
                x={band.a}
                y={0}
                width={Math.max(1, band.b - band.a)}
                height={innerH}
                fill={PAL.brush}
                stroke={PAL.brushLine}
                pointerEvents="none"
              />
            )
          })()}

          <AxisBottom
            top={innerH}
            scale={scale}
            numTicks={6}
            stroke={PAL.grid}
            tickStroke={PAL.grid}
            tickFormat={(v) => fmtTick(v as Date, spanMs)}
            tickLabelProps={() => ({
              fill: PAL.axis,
              fontSize: 11,
              fontFamily: MONO,
              textAnchor: 'middle',
              dy: '0.2em',
            })}
          />
        </Group>
      </svg>
    </div>
  )
}
