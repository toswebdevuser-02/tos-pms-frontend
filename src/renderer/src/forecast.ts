// Forward-looking project analytics: cumulative hours burn-up and budget
// forecasting. Pure functions (no React / no IPC) so they can power the
// per-project Dashboard chart, the Executive overview early-warning table,
// and the PDF status report from one source of truth.
//
// Budget is measured in PRODUCTIVE hours (execution + overtime) against the
// quote — the same rule the Timesheet tab uses ("Remaining = Quoted −
// Productive"). Correction/IT/QC/discussion time is real work but is not the
// quoted deliverable effort, so it is excluded from the burn line.

const DAY = 86400000

const num = (v: unknown): number => { const n = parseFloat(String(v ?? '')); return isNaN(n) ? 0 : n }

const parseDate = (v: unknown): Date | null => {
  const s = String(v ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(s + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

const iso = (d: Date): string => d.toISOString().slice(0, 10)
const daysBetween = (a: Date, b: Date): number => Math.round((a.getTime() - b.getTime()) / DAY)
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY)

export interface TimesheetLike {
  date?: unknown
  execution_hrs?: unknown
  overtime_hrs?: unknown
  [k: string]: unknown
}

export const productiveOf = (r: TimesheetLike): number => num(r.execution_hrs) + num(r.overtime_hrs)

export interface BurnPoint { date: string; t: number; cumulative: number }

export interface BurnUpSeries {
  points: BurnPoint[]   // cumulative productive hours, one point per active day
  total: number         // total productive hours logged
  firstDate: string | null
  lastDate: string | null
  spanDays: number      // calendar days from first to last entry (>= 1)
  activeDays: number    // distinct days with logged hours
}

/** Aggregate timesheets into a cumulative productive-hours series, sorted by date. */
export function buildBurnUp(timesheets: TimesheetLike[]): BurnUpSeries {
  const byDay = new Map<string, number>()
  for (const r of timesheets) {
    const d = parseDate(r.date)
    if (!d) continue
    const key = iso(d)
    byDay.set(key, (byDay.get(key) ?? 0) + productiveOf(r))
  }
  const days = Array.from(byDay.keys()).sort()
  let cum = 0
  const points: BurnPoint[] = days.map((day) => {
    cum += byDay.get(day) ?? 0
    return { date: day, t: new Date(day + 'T00:00:00').getTime(), cumulative: Math.round(cum * 10) / 10 }
  })
  const firstDate = days[0] ?? null
  const lastDate = days[days.length - 1] ?? null
  const spanDays = firstDate && lastDate
    ? Math.max(1, daysBetween(new Date(lastDate + 'T00:00:00'), new Date(firstDate + 'T00:00:00')) + 1)
    : 0
  return { points, total: Math.round(cum * 10) / 10, firstDate, lastDate, spanDays, activeDays: days.length }
}

export type BudgetVerdict = 'over' | 'tight' | 'under' | 'unknown'

export interface Forecast {
  hasData: boolean
  loggedProductive: number
  quoted: number
  usedPct: number | null
  remaining: number | null

  dailyRate: number      // recent productive hrs / calendar day
  windowDays: number     // size of the window the rate was measured over

  // Budget-exhaustion projection (at the recent pace, when does the quote run out?)
  daysToExhaust: number | null
  exhaustDate: string | null

  // Deadline projection (if we keep this pace until the target end date)
  endDate: string | null
  daysToDeadline: number | null
  projectedAtDeadline: number | null
  projectedPctAtDeadline: number | null

  // Effort-to-complete projection (from task progress: hours per % achieved)
  taskPct: number | null
  projectedAtCompletion: number | null
  projectedPctAtCompletion: number | null

  // Single headline figure + outlook (most relevant projection, conservative)
  projectedFinal: number | null
  projectedFinalPct: number | null
  overBy: number | null   // projectedFinal − quoted when over, else null
  verdict: BudgetVerdict
}

export interface ForecastInput {
  timesheets: TimesheetLike[]
  quoted: number
  endDate?: string
  taskPct?: number       // weighted task completion %, 0-100
  windowDays?: number    // recent-pace window (default 28)
  now?: Date
}

const round1 = (n: number): number => Math.round(n * 10) / 10

/**
 * Project where a project's hours are heading. Two independent projections are
 * computed and the more conservative drives the verdict:
 *  - effort-to-complete: logged ÷ (taskPct/100) — total hours implied by the
 *    current hours-per-progress, the best signal when tasks are tracked.
 *  - pace-to-deadline: logged + dailyRate × days-until-deadline.
 * All divisions are guarded; missing inputs yield nulls rather than guesses.
 */
export function forecast(input: ForecastInput): Forecast {
  const { timesheets, quoted, endDate, taskPct, windowDays = 28 } = input
  const now = input.now ? new Date(iso(input.now) + 'T00:00:00') : new Date(iso(new Date()) + 'T00:00:00')
  const series = buildBurnUp(timesheets)
  const logged = series.total
  const hasData = series.activeDays > 0

  const empty: Forecast = {
    hasData, loggedProductive: logged, quoted, usedPct: quoted > 0 ? Math.round((logged / quoted) * 100) : null,
    remaining: quoted > 0 ? round1(quoted - logged) : null,
    dailyRate: 0, windowDays, daysToExhaust: null, exhaustDate: null,
    endDate: endDate ?? null, daysToDeadline: null, projectedAtDeadline: null, projectedPctAtDeadline: null,
    taskPct: taskPct ?? null, projectedAtCompletion: null, projectedPctAtCompletion: null,
    projectedFinal: null, projectedFinalPct: null, overBy: null, verdict: 'unknown'
  }
  if (!hasData || !series.lastDate || !series.firstDate) return empty

  // Recent pace: productive hours within the trailing window ending at the last
  // active day, divided by the window length (capped to the project's span).
  const last = new Date(series.lastDate + 'T00:00:00')
  const winStartMs = Math.max(
    new Date(series.firstDate + 'T00:00:00').getTime(),
    addDays(last, -(windowDays - 1)).getTime()
  )
  let hoursInWindow = 0
  for (const p of series.points) {
    const prev = series.points[series.points.indexOf(p) - 1]
    const dayHours = p.cumulative - (prev ? prev.cumulative : 0)
    if (p.t >= winStartMs) hoursInWindow += dayHours
  }
  const denomDays = Math.max(1, daysBetween(last, new Date(winStartMs)) + 1)
  const dailyRate = round1(hoursInWindow / denomDays)

  const remaining = quoted > 0 ? round1(quoted - logged) : null
  const usedPct = quoted > 0 ? Math.round((logged / quoted) * 100) : null

  // Budget exhaustion from today, at the recent pace.
  let daysToExhaust: number | null = null
  let exhaustDate: string | null = null
  if (remaining != null && remaining > 0 && dailyRate > 0) {
    daysToExhaust = Math.ceil(remaining / dailyRate)
    exhaustDate = iso(addDays(now, daysToExhaust))
  } else if (remaining != null && remaining <= 0) {
    daysToExhaust = 0
    exhaustDate = iso(now)
  }

  // Pace-to-deadline projection.
  const end = parseDate(endDate)
  let daysToDeadline: number | null = null
  let projectedAtDeadline: number | null = null
  let projectedPctAtDeadline: number | null = null
  if (end) {
    daysToDeadline = daysBetween(end, now)
    const ahead = Math.max(0, daysToDeadline)
    projectedAtDeadline = round1(logged + dailyRate * ahead)
    if (quoted > 0) projectedPctAtDeadline = Math.round((projectedAtDeadline / quoted) * 100)
  }

  // Effort-to-complete projection from task progress.
  let projectedAtCompletion: number | null = null
  let projectedPctAtCompletion: number | null = null
  if (taskPct != null && taskPct > 0 && taskPct < 100) {
    projectedAtCompletion = round1(logged / (taskPct / 100))
    if (quoted > 0) projectedPctAtCompletion = Math.round((projectedAtCompletion / quoted) * 100)
  } else if (taskPct != null && taskPct >= 100) {
    projectedAtCompletion = logged
    if (quoted > 0) projectedPctAtCompletion = usedPct
  }

  // Headline: prefer effort-to-complete — it reflects the hours implied by the
  // remaining scope at current efficiency, the truest predictor of the final
  // total. Pace-to-deadline (which assumes full burn every day to a possibly
  // distant deadline) is only the fallback when task progress isn't tracked.
  const projectedFinal = projectedAtCompletion != null ? projectedAtCompletion
    : projectedAtDeadline != null ? projectedAtDeadline : null
  const projectedFinalPct = projectedFinal != null && quoted > 0 ? Math.round((projectedFinal / quoted) * 100) : null

  let verdict: BudgetVerdict = 'unknown'
  let overBy: number | null = null
  if (quoted > 0 && projectedFinal != null) {
    const ratio = projectedFinal / quoted
    verdict = ratio > 1.05 ? 'over' : ratio > 0.9 ? 'tight' : 'under'
    if (verdict === 'over') overBy = round1(projectedFinal - quoted)
  }

  return {
    hasData, loggedProductive: logged, quoted, usedPct, remaining,
    dailyRate, windowDays: denomDays,
    daysToExhaust, exhaustDate,
    endDate: endDate ?? null, daysToDeadline, projectedAtDeadline, projectedPctAtDeadline,
    taskPct: taskPct ?? null, projectedAtCompletion, projectedPctAtCompletion,
    projectedFinal, projectedFinalPct, overBy, verdict
  }
}

export const VERDICT_LABEL: Record<BudgetVerdict, string> = {
  over: 'Projected over budget',
  tight: 'Tracking close to budget',
  under: 'On track within budget',
  unknown: 'Not enough data to forecast'
}

export const VERDICT_COLOR: Record<BudgetVerdict, string> = {
  over: '#ef4444',
  tight: '#f59e0b',
  under: '#22c55e',
  unknown: '#94a3b8'
}

/** Friendly relative phrasing for a forecast date, e.g. "in 12 days" / "5 days ago". */
export function relativeDate(dateStr: string | null, now: Date = new Date()): string {
  if (!dateStr) return '—'
  const d = parseDate(dateStr)
  if (!d) return '—'
  const today = new Date(iso(now) + 'T00:00:00')
  const diff = daysBetween(d, today)
  const nice = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (diff === 0) return `${nice} (today)`
  if (diff > 0) return `${nice} (in ${diff} day${diff === 1 ? '' : 's'})`
  return `${nice} (${-diff} day${diff === -1 ? '' : 's'} ago)`
}
