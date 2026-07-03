import { useState, useEffect, useMemo, useCallback } from 'react'
import { Project, Member } from '../types'
import Icon, { IconName, DisciplineIcon } from './Icon'
import { assessRisk, RiskResult, RISK_COLOR } from '../risk'
import { productiveOf } from '../forecast'
import Donut from './charts/Donut'
import Bars from './charts/Bars'
import GanttTimeline from './GanttTimeline'

interface Props {
  projects: Project[]
  statusMap: Record<number, string>
  members: Member[]
  isManager: boolean
  onSelect: (id: number) => void
  onNewProject: () => void
}

type Row = Record<string, unknown>
const C = { blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#a78bfa', slate: '#94a3b8', cyan: '#06b6d4' }

function stage(s: string): 'On-going' | 'On-hold' | 'Completed' {
  if (s === 'Completed') return 'Completed'
  if (s === 'On-hold' || s === 'On Hold') return 'On-hold'
  return 'On-going'
}

// Eased count-up animation for KPI numbers.
function useCountUp(target: number, ms = 650): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (t: number): void => {
      const p = Math.min(1, (t - start) / ms)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return n
}

function Kpi({ icon, label, value, sub, accent, onClick, active }: {
  icon: IconName; label: string; value: number; sub?: string; accent: string; onClick?: () => void; active?: boolean
}): React.JSX.Element {
  const display = useCountUp(value)
  return (
    <div className={`kpi-card${onClick ? ' kpi-click' : ''}${active ? ' kpi-active' : ''}`} onClick={onClick}>
      <div className="kpi-icon" style={{ background: `${accent}22`, color: accent }}><Icon name={icon} size={22} /></div>
      <div className="kpi-body">
        <div className="kpi-value">{display}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

type Filter = 'all' | 'On-going' | 'On-hold' | 'Completed'

export default function HomeDashboard({ projects, statusMap, members, isManager, onSelect, onNewProject }: Props) {
  const [tasksByProject, setTasksByProject] = useState<Record<number, Row[]>>({})
  const [tsByProject, setTsByProject] = useState<Record<number, Row[]>>({})
  const [membersByProject, setMembersByProject] = useState<Record<number, number>>({})
  const [openByProject, setOpenByProject] = useState<Record<number, number>>({})
  const [timesheets, setTimesheets] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    const tasks: Record<number, Row[]> = {}, mem: Record<number, number> = {}, ts: Row[] = []
    const tsMap: Record<number, Row[]> = {}, open: Record<number, number> = {}
    await Promise.all(projects.map(async (p) => {
      const [t, m, h, r, q] = await Promise.all([
        window.api.items.getByProject(p.id, 'task'),
        window.api.projectMembers.get(p.id),
        window.api.items.getByProject(p.id, 'timesheet'),
        window.api.items.getByProject(p.id, 'rfi'),
        window.api.items.getByProject(p.id, 'query')
      ])
      if (t.ok) tasks[p.id] = t.data as Row[]
      if (m.ok) mem[p.id] = (m.data as unknown[]).length
      if (h.ok) { tsMap[p.id] = h.data as Row[]; ts.push(...(h.data as Row[])) }
      const openRfi = r.ok ? (r.data as Row[]).filter((x) => x.status === 'Open' || x.status === 'Pending').length : 0
      const openQ = q.ok ? (q.data as Row[]).filter((x) => x.status === 'Open' || x.status === 'Pending').length : 0
      open[p.id] = openRfi + openQ
    }))
    setTasksByProject(tasks); setMembersByProject(mem); setTimesheets(ts); setTsByProject(tsMap); setOpenByProject(open)
  }, [projects])
  useEffect(() => { load() }, [load])

  const num = (v: unknown): number => { const n = parseFloat(String(v ?? '')); return isNaN(n) ? 0 : n }
  const riskOf = useCallback((p: Project): RiskResult => assessRisk({
    stage: statusMap[p.id] ?? 'On-going',
    endDate: p.end_date,
    quotedHours: num(p.quoted_hours),
    loggedHours: (tsByProject[p.id] ?? []).reduce((s, r) => s + productiveOf(r), 0),
    tasks: (tasksByProject[p.id] ?? []) as { status?: unknown; deadline?: unknown; updated_at?: unknown }[],
    timesheets: (tsByProject[p.id] ?? []) as { date?: unknown }[],
    openItems: openByProject[p.id] ?? 0
  }), [statusMap, tsByProject, tasksByProject, openByProject])

  const allTasks = useMemo(() => Object.values(tasksByProject).flat(), [tasksByProject])

  // Team workload heatmap: member × last 14 days, coloured by hours logged.
  const heat = useMemo(() => {
    const days: { key: string; label: string }[] = []
    const today = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ key, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
    }
    const byMember = new Map<string, Map<string, number>>()
    for (const t of timesheets) {
      const mid = String(t.member_id ?? '')
      const date = String(t.date ?? '').slice(0, 10)
      if (!mid || !date) continue
      const hrs = parseFloat(String(t.total_hrs ?? '')) || 0
      if (!byMember.has(mid)) byMember.set(mid, new Map())
      const m = byMember.get(mid)!
      m.set(date, (m.get(date) ?? 0) + hrs)
    }
    const rows = members
      .map((mb) => ({ member: mb, cells: days.map((d) => byMember.get(String(mb.id))?.get(d.key) ?? 0) }))
      .filter((r) => r.cells.some((c) => c > 0))
    return { days, rows }
  }, [timesheets, members])

  const heatColor = (h: number): string => {
    if (h <= 0) return 'var(--card)'
    if (h <= 2) return 'rgba(34,197,94,0.25)'
    if (h <= 4) return 'rgba(34,197,94,0.45)'
    if (h <= 6) return 'rgba(34,197,94,0.65)'
    return 'rgba(34,197,94,0.9)'
  }

  const k = useMemo(() => {
    let ongoing = 0, onhold = 0, completed = 0
    for (const p of projects) {
      const st = stage(statusMap[p.id] ?? 'On-going')
      if (st === 'Completed') completed++; else if (st === 'On-hold') onhold++; else ongoing++
    }
    const done = allTasks.filter((t) => t.status === 'Done').length
    const prog = allTasks.filter((t) => t.status === 'In Progress').length
    const todo = allTasks.filter((t) => t.status === 'Not Started').length
    return { ongoing, onhold, completed, taskTotal: allTasks.length, done, prog, todo, pct: allTasks.length ? Math.round((done / allTasks.length) * 100) : 0 }
  }, [projects, statusMap, allTasks])

  // Workload: tasks assigned per member (top 6).
  const workload = useMemo(() => {
    const m = new Map<string, number>()
    allTasks.forEach((t) => { if (t.assigned_member_id) { const id = String(t.assigned_member_id); m.set(id, (m.get(id) ?? 0) + 1) } })
    return members
      .map((mb) => ({ label: mb.name.split(' ')[0], value: m.get(String(mb.id)) ?? 0, color: C.blue }))
      .filter((b) => b.value > 0).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [allTasks, members])

  const toggle = (f: Filter): void => setFilter((cur) => (cur === f ? 'all' : f))

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects
      .map((p) => {
        const tks = tasksByProject[p.id] ?? []
        const done = tks.filter((t) => t.status === 'Done').length
        return { p, total: tks.length, done, pct: tks.length ? Math.round((done / tks.length) * 100) : 0, members: membersByProject[p.id] ?? 0, st: stage(statusMap[p.id] ?? 'On-going'), risk: riskOf(p) }
      })
      .filter((r) => filter === 'all' || r.st === filter)
      .filter((r) => !q || r.p.name.toLowerCase().includes(q) || (r.p.client ?? '').toLowerCase().includes(q) || (r.p.discipline ?? '').toLowerCase().includes(q))
  }, [projects, search, filter, tasksByProject, membersByProject, statusMap, riskOf])

  // Projects needing attention (Watch / At-risk), worst first.
  const attention = useMemo(() => projects
    .map((p) => ({ p, risk: riskOf(p) }))
    .filter((r) => r.risk.level !== 'Healthy')
    .sort((a, b) => b.risk.score - a.risk.score), [projects, riskOf])

  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('pt_onboarded') === '1')
  const dismissOnboard = (): void => { localStorage.setItem('pt_onboarded', '1'); setOnboarded(true) }

  return (
    <div className="home-dash">
      {!onboarded && (
        <div className="onboard-hint">
          <span className="onboard-icon">👋</span>
          <span className="onboard-text">
            Welcome! Press <kbd>Ctrl</kbd>+<kbd>K</kbd> to search anything, <kbd>n</kbd> for a new project, and open <strong>☰ Workspace</strong> (top-left) for members, allocation, staffing &amp; data export. Click any KPI card to filter.
          </span>
          <button className="btn-icon onboard-x" onClick={dismissOnboard} title="Dismiss"><Icon name="close" size={16} /></button>
        </div>
      )}
      <div className="home-head">
        <div>
          <h1>Dashboard</h1>
          <p className="home-sub">Overview of all your projects, tasks and team.</p>
        </div>
        {isManager && <button className="btn btn-primary" onClick={onNewProject}><Icon name="plus" size={16} /> New Project</button>}
      </div>

      <div className="kpi-grid">
        <Kpi icon="folder" label="Total Projects" value={projects.length} sub="click to clear filter" accent={C.blue} onClick={() => setFilter('all')} active={filter === 'all'} />
        <Kpi icon="play" label="On-going" value={k.ongoing} sub="filter" accent={C.green} onClick={() => toggle('On-going')} active={filter === 'On-going'} />
        <Kpi icon="pause" label="On-hold" value={k.onhold} sub="filter" accent={C.amber} onClick={() => toggle('On-hold')} active={filter === 'On-hold'} />
        <Kpi icon="checkCircle" label="Completed" value={k.completed} sub="filter" accent={C.purple} onClick={() => toggle('Completed')} active={filter === 'Completed'} />
        <Kpi icon="target" label="Tasks Done" value={k.done} sub={`of ${k.taskTotal} · ${k.pct}%`} accent={C.cyan} />
        <Kpi icon="users" label="Team" value={members.length} sub="members" accent={C.slate} />
      </div>

      <div className="home-charts">
        <div className="chart-card">
          <h4>Project Status</h4>
          <div className="chart-center">
            <Donut
              segments={[
                { label: 'On-going', value: k.ongoing, color: C.green },
                { label: 'On-hold', value: k.onhold, color: C.amber },
                { label: 'Completed', value: k.completed, color: C.purple }
              ]}
              centerLabel={`${projects.length}`}
              centerSub="projects"
            />
          </div>
          <div className="legend">
            <span><i style={{ background: C.green }} />On-going {k.ongoing}</span>
            <span><i style={{ background: C.amber }} />On-hold {k.onhold}</span>
            <span><i style={{ background: C.purple }} />Completed {k.completed}</span>
          </div>
        </div>

        <div className="chart-card">
          <h4>Task Completion</h4>
          <div className="chart-center">
            <Donut
              segments={[
                { label: 'Done', value: k.done, color: C.green },
                { label: 'In Progress', value: k.prog, color: C.amber },
                { label: 'Not Started', value: k.todo, color: C.slate }
              ]}
              centerLabel={`${k.pct}%`}
              centerSub={`${k.done}/${k.taskTotal} done`}
            />
          </div>
          <div className="legend">
            <span><i style={{ background: C.green }} />Done {k.done}</span>
            <span><i style={{ background: C.amber }} />In progress {k.prog}</span>
            <span><i style={{ background: C.slate }} />Not started {k.todo}</span>
          </div>
        </div>

        <div className="chart-card">
          <h4>Workload · tasks per member</h4>
          <Bars data={workload} />
        </div>
      </div>

      {attention.length > 0 && (
        <div className="home-panel attention-panel">
          <div className="home-panel-head">
            <h3><Icon name="bellRing" size={16} /> Attention needed <span className="attention-count">{attention.length}</span></h3>
          </div>
          <div className="attention-list">
            {attention.slice(0, 6).map(({ p, risk }) => (
              <div key={p.id} className="attention-row" onClick={() => onSelect(p.id)}>
                <span className="risk-dot" style={{ background: RISK_COLOR[risk.level] }} />
                <span className="attention-name"><DisciplineIcon discipline={p.discipline} size={14} /> {p.name}</span>
                <span className="attention-reasons">{risk.reasons.join(' · ')}</span>
                <span className="risk-badge" style={{ color: RISK_COLOR[risk.level], background: `${RISK_COLOR[risk.level]}1f` }}>{risk.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="home-panel">
        <div className="home-panel-head">
          <h3>Active Projects</h3>
          <div className="home-panel-tools">
            <div className="chip-bar">
              {(['all', 'On-going', 'On-hold', 'Completed'] as Filter[]).map((f) => (
                <button key={f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f}</button>
              ))}
            </div>
            <div className="search-box" style={{ marginTop: 0, maxWidth: 220 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="empty-table"><p>{projects.length === 0 ? 'No projects yet.' : 'No projects match this filter.'}</p></div>
        ) : (
          <div className="table-wrap" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr><th>Project</th><th style={{ width: 110 }}>Health</th><th style={{ width: 120 }}>Discipline</th><th style={{ width: 100 }}>Status</th><th style={{ width: 210 }}>Task progress</th><th style={{ width: 70 }}>Team</th></tr>
              </thead>
              <tbody>
                {rows.map(({ p, total, done, pct, members: mc, st, risk }) => (
                  <tr key={p.id} className="home-row" onClick={() => onSelect(p.id)}>
                    <td>
                      <span className="home-proj">
                        <span className="home-proj-icon"><DisciplineIcon discipline={p.discipline} size={16} /></span>
                        <span><strong>{p.name}</strong>{p.client && <span className="home-client"> · {p.client}</span>}</span>
                      </span>
                    </td>
                    <td><span className="risk-badge" style={{ color: RISK_COLOR[risk.level], background: `${RISK_COLOR[risk.level]}1f` }} title={risk.reasons.join(' · ') || 'No issues detected'}><span className="risk-dot" style={{ background: RISK_COLOR[risk.level] }} />{risk.level}</span></td>
                    <td>{p.discipline ? <span className="badge badge-design">{p.discipline}</span> : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                    <td><span className={`badge badge-${st.toLowerCase()}`}>{st}</span></td>
                    <td>
                      <div className="home-prog">
                        <div className="home-prog-bar"><div className="home-prog-fill" style={{ width: `${pct}%` }} /></div>
                        <span className="home-prog-txt">{done}/{total} · {pct}%</span>
                      </div>
                    </td>
                    <td>{mc ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="users" size={13} /> {mc}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <GanttTimeline projects={projects} statusMap={statusMap} onSelect={onSelect} />

      {heat.rows.length > 0 && (
        <div className="home-panel" style={{ marginTop: 16 }}>
          <div className="home-panel-head">
            <h3>Team Workload · last 14 days</h3>
            <span className="heat-legend">less <i style={{ background: heatColor(1) }} /><i style={{ background: heatColor(3) }} /><i style={{ background: heatColor(5) }} /><i style={{ background: heatColor(8) }} /> more (hrs)</span>
          </div>
          <div className="heatmap-wrap">
            <table className="heatmap">
              <thead>
                <tr><th className="heat-name"> </th>{heat.days.map((d) => <th key={d.key} className="heat-day">{d.label}</th>)}</tr>
              </thead>
              <tbody>
                {heat.rows.map(({ member, cells }) => (
                  <tr key={member.id}>
                    <td className="heat-name">{member.name}</td>
                    {cells.map((c, i) => (
                      <td key={i} className="heat-cell" title={`${member.name} · ${heat.days[i].label}: ${c}h`}>
                        <span style={{ background: heatColor(c) }}>{c > 0 ? c : ''}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
