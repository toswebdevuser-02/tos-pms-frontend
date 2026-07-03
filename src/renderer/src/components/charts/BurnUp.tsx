import { useMemo, useId } from 'react'
import { BurnPoint, Forecast } from '../../forecast'

interface Props {
  points: BurnPoint[]
  forecast: Forecast
  now?: Date
}

const W = 580, H = 230
const PAD = { l: 46, r: 14, t: 16, b: 30 }
const fmtDay = (t: number): string => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const tOf = (s: string): number => new Date(s + 'T00:00:00').getTime()

/**
 * Cumulative productive-hours burn-up: the solid line is logged-to-date, the
 * dashed ray is the projection at the recent pace, and the horizontal dashed
 * line is the quoted budget. Pure SVG, themed via CSS variables.
 */
export default function BurnUp({ points, forecast, now = new Date() }: Props) {
  const uid = useId().replace(/:/g, '')
  const model = useMemo(() => {
    if (!points.length) return null
    const nowT = tOf(now.toISOString().slice(0, 10))
    const firstT = points[0].t
    const lastP = points[points.length - 1]

    // Projection endpoint (chart ray): to the deadline if it's ahead, else to
    // the budget-exhaustion date.
    let projT: number | null = null, projV: number | null = null
    if (forecast.endDate && forecast.daysToDeadline != null && forecast.daysToDeadline > 0 && forecast.projectedAtDeadline != null) {
      projT = tOf(forecast.endDate); projV = forecast.projectedAtDeadline
    } else if (forecast.exhaustDate && forecast.daysToExhaust != null && forecast.daysToExhaust > 0) {
      projT = tOf(forecast.exhaustDate); projV = forecast.quoted
    }

    const maxT = Math.max(lastP.t, nowT, projT ?? 0)
    const maxV = Math.max(forecast.quoted || 0, lastP.cumulative, projV ?? 0, forecast.projectedFinal ?? 0) * 1.12 || 1

    const x = (t: number): number => PAD.l + ((t - firstT) / Math.max(1, maxT - firstT)) * (W - PAD.l - PAD.r)
    const y = (v: number): number => H - PAD.b - (v / maxV) * (H - PAD.t - PAD.b)

    const line = points.map((p) => `${x(p.t).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join(' ')
    const area = `${PAD.l},${(H - PAD.b).toFixed(1)} ${line} ${x(lastP.t).toFixed(1)},${(H - PAD.b).toFixed(1)}`

    return { firstT, maxT, maxV, lastP, projT, projV, nowT, x, y, line, area }
  }, [points, forecast, now])

  if (!model) return <div className="chart-empty">No timesheet history yet — log hours to see the burn-up.</div>

  const { lastP, projT, projV, nowT, x, y, line, area } = model
  const quoted = forecast.quoted

  return (
    <div className="burnup">
      <svg viewBox={`0 0 ${W} ${H}`} className="burnup-svg" role="img"
        aria-label={`Cumulative productive hours over time${quoted ? `, against a ${quoted} hour budget` : ''}`}>
        <defs>
          <linearGradient id={`bu-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* y baseline + zero label */}
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--border)" strokeWidth="1" />
        <text x={PAD.l - 8} y={H - PAD.b + 4} className="bu-axis" textAnchor="end">0</text>

        {/* budget line */}
        {quoted > 0 && (
          <>
            <line x1={PAD.l} y1={y(quoted)} x2={W - PAD.r} y2={y(quoted)} stroke="var(--warning)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.85" />
            <text x={W - PAD.r} y={y(quoted) - 5} className="bu-axis bu-budget" textAnchor="end">Quoted {quoted}h</text>
          </>
        )}

        {/* actual area + line */}
        <polygon points={area} fill={`url(#bu-fill-${uid})`} />
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* projection ray */}
        {projT != null && projV != null && (
          <>
            <line x1={x(lastP.t)} y1={y(lastP.cumulative)} x2={x(projT)} y2={y(projV)}
              stroke={projV > quoted && quoted > 0 ? 'var(--danger)' : 'var(--text-muted)'} strokeWidth="2" strokeDasharray="4 4" />
            <circle cx={x(projT)} cy={y(projV)} r="3.5" fill={projV > quoted && quoted > 0 ? 'var(--danger)' : 'var(--text-muted)'} />
            <text x={x(projT)} y={y(projV) - 8} className="bu-axis" textAnchor="end">~{Math.round(projV)}h</text>
          </>
        )}

        {/* today marker */}
        {nowT >= model.firstT && (
          <line x1={x(nowT)} y1={PAD.t} x2={x(nowT)} y2={H - PAD.b} stroke="var(--text-dim)" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
        )}

        {/* last actual point */}
        <circle cx={x(lastP.t)} cy={y(lastP.cumulative)} r="3.5" fill="var(--accent)" />

        {/* x labels */}
        <text x={PAD.l} y={H - 9} className="bu-axis" textAnchor="start">{fmtDay(model.firstT)}</text>
        {projT != null && <text x={x(projT)} y={H - 9} className="bu-axis" textAnchor="end">{fmtDay(projT)}</text>}
      </svg>
      <div className="burnup-legend">
        <span><i className="bu-k-line" />Logged (productive)</span>
        {projT != null && <span><i className="bu-k-proj" />Projection</span>}
        {quoted > 0 && <span><i className="bu-k-budget" />Quoted budget</span>}
      </div>
    </div>
  )
}
