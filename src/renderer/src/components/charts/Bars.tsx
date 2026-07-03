import CountUp from '../CountUp'

export interface Bar {
  label: string
  value: number
  color?: string
}

interface Props {
  data: Bar[]
  unit?: string
}

export default function Bars({ data, unit }: Props) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (!data.length || data.every((d) => d.value === 0)) {
    return <div className="chart-empty">No data yet.</div>
  }
  return (
    <div className="bars">
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <div className="bar-label" title={d.label}>{d.label}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color || 'var(--accent)' }}
            />
          </div>
          <div className="bar-value"><CountUp value={d.value} />{unit || ''}</div>
        </div>
      ))}
    </div>
  )
}
