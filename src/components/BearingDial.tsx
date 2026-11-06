import { useRef } from 'react'

/**
 * A circular bearing control. Drag the needle to swing the camera direction;
 * the map rays update live. North is up, clockwise positive, matching the
 * compass bearings used throughout.
 */
export function BearingDial({
  value,
  onChange,
  size = 92,
}: {
  value: number
  onChange: (deg: number) => void
  size?: number
}) {
  const ref = useRef<SVGSVGElement | null>(null)
  const c = size / 2
  const r = c - 12

  const bearingFromEvent = (clientX: number, clientY: number): number => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return value
    const dx = clientX - (rect.left + rect.width / 2)
    const dy = clientY - (rect.top + rect.height / 2)
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (deg < 0) deg += 360
    return Math.round(deg)
  }

  const handle = (e: React.PointerEvent) => {
    onChange(bearingFromEvent(e.clientX, e.clientY))
  }

  const rad = ((value - 90) * Math.PI) / 180 // 0deg -> up
  const tip = { x: c + r * Math.cos(rad), y: c + r * Math.sin(rad) }

  const cardinals = [
    { t: 'N', a: 0 },
    { t: 'E', a: 90 },
    { t: 'S', a: 180 },
    { t: 'W', a: 270 },
  ]

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      style={{ touchAction: 'none', cursor: 'grab', flex: 'none' }}
      onPointerDown={(e) => {
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
        handle(e)
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) handle(e)
      }}
    >
      <circle cx={c} cy={c} r={r} style={{ fill: "var(--surface-2)", stroke: "var(--line-2)" }} />
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i * 15 * Math.PI) / 180 - Math.PI / 2
        const inner = i % 6 === 0 ? r - 7 : r - 4
        return (
          <line
            key={i}
            x1={c + inner * Math.cos(a)}
            y1={c + inner * Math.sin(a)}
            x2={c + r * Math.cos(a)}
            y2={c + r * Math.sin(a)}
            style={{ stroke: "var(--line-strong)" }}
            strokeWidth={1}
          />
        )
      })}
      {cardinals.map((cd) => {
        const a = ((cd.a - 90) * Math.PI) / 180
        return (
          <text
            key={cd.t}
            x={c + (r - 16) * Math.cos(a)}
            y={c + (r - 16) * Math.sin(a)}
            style={{ fill: cd.t === 'N' ? 'var(--primary)' : 'var(--text-3)', fontWeight: cd.t === 'N' ? 700 : 400 }}
            fontSize={11}
            fontFamily="'Archivo', sans-serif"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {cd.t}
          </text>
        )
      })}
      <line x1={c} y1={c} x2={tip.x} y2={tip.y} style={{ stroke: "var(--mark)" }} strokeWidth={2} />
      <circle cx={tip.x} cy={tip.y} r={4} style={{ fill: "var(--mark)" }} />
      <circle cx={c} cy={c} r={2.5} style={{ fill: "var(--text-2)" }} />
    </svg>
  )
}
