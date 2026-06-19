import { useEffect, useMemo, useRef, useState } from 'react'
import { scaleTime } from '@visx/scale'
import { AxisBottom } from '@visx/axis'
import { Group } from '@visx/group'
import { useStore } from '../state/store'
import { timeExtent, timelineItems, type TimelineItem } from '../lib/derive'

const PAL = {
  axis: '#6f7989',
  grid: '#1b212b',
  window: 'rgba(127,168,191,0.07)',
  windowLine: 'rgba(127,168,191,0.35)',
  public: '#d8d2c0',
  restricted: '#f3a93c',
  embargoed: '#e5544b',
  attested: '#ffc163',
  probable: '#a7b0bd',
  uncertain: '#6f7989',
  sel: '#ffc163',
  brush: 'rgba(243,169,60,0.14)',
  brushLine: 'rgba(243,169,60,0.6)',
}

const M = { top: 12, right: 18, bottom: 24, left: 18 }
const MONO = "'Spline Sans Mono', ui-monospace, monospace"

function itemColor(it: TimelineItem): string {
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

  // Two lanes: sources above, findings below.
  const laneH = Math.min(18, innerH / 2 - 6)
  const sourcesY = innerH * 0.32
  const findingsY = innerH * 0.72

  const isSelected = (it: TimelineItem) =>
    (it.kind === 'source' && it.id === selectedSourceId) ||
    (it.kind === 'finding' && it.id === selectedFindingId)

  const inBrush = (it: TimelineItem) =>
    !timeBrush || (it.end >= timeBrush.start && it.start <= timeBrush.end)

  const selectItem = (it: TimelineItem) => {
    if (it.kind === 'source') useStore.getState().select(it.id)
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
          <text x={0} y={sourcesY - laneH / 2 - 4} fill={PAL.axis} fontSize={9} fontFamily={MONO} letterSpacing="1">
            SOURCES
          </text>
          <text x={0} y={findingsY - laneH / 2 - 4} fill={PAL.axis} fontSize={9} fontFamily={MONO} letterSpacing="1">
            FINDINGS
          </text>

          {/* items */}
          {items.map((it) => {
            const laneY = it.kind === 'source' ? sourcesY : findingsY
            const x0 = x(it.start)
            const x1 = x(it.end)
            const w = Math.max(0, x1 - x0)
            const col = itemColor(it)
            const sel = isSelected(it)
            const hov = it.id === hoveredId
            const active = sel || hov
            const dim = !inBrush(it)
            const isPoint = w < 2

            return (
              <g
                key={it.id}
                style={{ cursor: 'pointer', opacity: dim ? 0.32 : 1 }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  selectItem(it)
                }}
                onPointerEnter={() => useStore.getState().hover(it.id)}
                onPointerLeave={() => useStore.getState().hover(null)}
              >
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
                    fillOpacity={it.kind === 'finding' ? 0.5 : 0.35}
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
              fontSize: 9,
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
