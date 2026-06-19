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
      <circle cx={c} cy={c} r={r} fill="#0b0e13" stroke="#262f3b" />
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
            stroke="#38424f"
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
            fill={cd.t === 'N' ? '#f3a93c' : '#6f7989'}
            fontSize={9}
            fontFamily="'Spline Sans Mono', monospace"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {cd.t}
          </text>
        )
      })}
      <line x1={c} y1={c} x2={tip.x} y2={tip.y} stroke="#ffc163" strokeWidth={2} />
      <circle cx={tip.x} cy={tip.y} r={4} fill="#ffc163" />
      <circle cx={c} cy={c} r={2.5} fill="#a7b0bd" />
    </svg>
  )
}
