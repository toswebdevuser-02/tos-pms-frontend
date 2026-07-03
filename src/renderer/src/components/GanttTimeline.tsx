import { Project } from '../types'

interface Props {
  projects: Project[]
  statusMap: Record<number, string>
  onSelect: (id: number) => void
}

const C = { green: '#22c55e', amber: '#f59e0b', purple: '#a78bfa' }

function stage(s: string): 'On-going' | 'On-hold' | 'Completed' {
  if (s === 'Completed') return 'Completed'
  if (s === 'On-hold' || s === 'On Hold') return 'On-hold'
  return 'On-going'
}
function parseDate(s?: string): Date | null {
  if (!s) return null
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}
const fmt = (d: Date): string => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function GanttTimeline({ projects, statusMap, onSelect }: Props) {
  const rows = projects
    .map((p) => {
      const start = parseDate(p.start_date) || parseDate(p.created_at)
      let end = parseDate(p.end_date)
      if (start && !end) { end = new Date(start); end.setDate(end.getDate() + 14) }
      return { p, start, end, st: stage(statusMap[p.id] ?? 'On-going') }
    })
    .filter((r): r is { p: Project; start: Date; end: Date; st: 'On-going' | 'On-hold' | 'Completed' } => !!r.start && !!r.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  if (!rows.length) return null

  const min = Math.min(...rows.map((r) => r.start.getTime()))
  const max = Math.max(...rows.map((r) => r.end.getTime()))
  const span = Math.max(1, max - min)
  const ticks = Array.from({ length: 6 }, (_, i) => new Date(min + (span * i) / 5))
  const colorFor = (st: string): string => (st === 'Completed' ? C.purple : st === 'On-hold' ? C.amber : C.green)

  return (
    <div className="home-panel" style={{ marginTop: 16 }}>
      <div className="home-panel-head">
        <h3>Project Timeline</h3>
        <span className="heat-legend">
          <i style={{ background: C.green }} />On-going <i style={{ background: C.amber }} />On-hold <i style={{ background: C.purple }} />Completed
        </span>
      </div>
      <div className="gantt">
        <div className="gantt-axis">
          {ticks.map((t, i) => (
            <span key={i} className="gantt-tick" style={{ left: `${(i / 5) * 100}%`, transform: i === 0 ? 'none' : i === 5 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{fmt(t)}</span>
          ))}
        </div>
        <div className="gantt-rows">
          {rows.map(({ p, start, end, st }) => {
            const left = ((start.getTime() - min) / span) * 100
            const width = Math.max(2.5, ((end.getTime() - start.getTime()) / span) * 100)
            return (
              <div key={p.id} className="gantt-row" onClick={() => onSelect(p.id)}>
                <div className="gantt-label" title={p.name}>{p.name}</div>
                <div className="gantt-track">
                  <div className="gantt-bar" style={{ left: `${left}%`, width: `${width}%`, background: colorFor(st) }} title={`${p.name}: ${fmt(start)} → ${fmt(end)}`}>
                    <span>{p.name}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
