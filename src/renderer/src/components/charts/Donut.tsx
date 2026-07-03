import CountUp from '../CountUp'

export interface Segment {
  label: string
  value: number
  color: string
}

interface Props {
  segments: Segment[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerSub?: string
}

export default function Donut({ segments, size = 160, thickness = 20, centerLabel, centerSub }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2

  let offset = 0
  const arcs = total > 0
    ? segments.filter((s) => s.value > 0).map((s) => {
        const frac = s.value / total
        const dash = frac * c
        const el = (
          <circle
            key={s.label}
            cx={cx} cy={cx} r={r}
            fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        )
        offset += dash
        return el
      })
    : []

  return (
    <div className="donut">
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--card)" strokeWidth={thickness} />
        {arcs}
      </svg>
      <div className="donut-center">
        <span className="donut-value">{centerLabel != null ? <CountUp value={centerLabel} /> : null}</span>
        {centerSub && <span className="donut-sub">{centerSub}</span>}
      </div>
    </div>
  )
}
