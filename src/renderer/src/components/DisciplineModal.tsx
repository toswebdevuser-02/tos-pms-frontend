import { useState, useEffect, useMemo, useCallback } from 'react'
import { Project, ProjectStatus, Member } from '../types'
import Icon, { DisciplineIcon } from './Icon'
import CountUp from './CountUp'
import { productiveOf } from '../forecast'

interface Props {
  projects: Project[]
  onClose: () => void
  onSelect?: (id: number) => void
}

type Row = Record<string, unknown>
const num = (v: unknown): number => { const n = parseFloat(String(v ?? '')); return isNaN(n) ? 0 : n }

// Map any (incl. legacy) stage value to the three current stages.
function stage(s: string): 'On-going' | 'On-hold' | 'Completed' {
  if (s === 'Completed') return 'Completed'
  if (s === 'On-hold' || s === 'On Hold') return 'On-hold'
  return 'On-going'
}

interface Group {
  discipline: string
  projects: number
  ongoing: number; onhold: number; completed: number
  taskTotal: number; taskDone: number
  quoted: number; logged: number
  members: Set<string>
}

export default function DisciplineModal({ projects, onClose, onSelect }: Props) {
  const [statusMap, setStatusMap] = useState<Record<number, string>>({})
  const [tasksByProject, setTasksByProject] = useState<Record<number, Row[]>>({})
  const [tsByProject, setTsByProject] = useState<Record<number, Row[]>>({})
  const [membersByProject, setMembersByProject] = useState<Record<number, Member[]>>({})
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    const sres = await window.api.projects.statuses()
    if (sres.ok) {
      const m: Record<number, string> = {}
      ;(sres.data as ProjectStatus[]).forEach((s) => { if (s.overall) m[s.project_id] = s.overall })
      setStatusMap(m)
    }
    const tasks: Record<number, Row[]> = {}, ts: Record<number, Row[]> = {}, mem: Record<number, Member[]> = {}
    await Promise.all(projects.map(async (p) => {
      const [t, h, mm] = await Promise.all([
        window.api.items.getByProject(p.id, 'task'),
        window.api.items.getByProject(p.id, 'timesheet'),
        window.api.projectMembers.get(p.id)
      ])
      if (t.ok) tasks[p.id] = t.data as Row[]
      if (h.ok) ts[p.id] = h.data as Row[]
      if (mm.ok) mem[p.id] = mm.data as Member[]
    }))
    setTasksByProject(tasks); setTsByProject(ts); setMembersByProject(mem)
  }, [projects])
  useEffect(() => { load() }, [load])

  const disciplineOf = (p: Project): string => p.discipline || 'Unassigned'

  const groups = useMemo(() => {
    const map = new Map<string, Group>()
    for (const p of projects) {
      const key = disciplineOf(p)
      const g = map.get(key) ?? { discipline: key, projects: 0, ongoing: 0, onhold: 0, completed: 0, taskTotal: 0, taskDone: 0, quoted: 0, logged: 0, members: new Set<string>() }
      g.projects++
      const st = stage(statusMap[p.id] ?? 'On-going')
      if (st === 'Completed') g.completed++; else if (st === 'On-hold') g.onhold++; else g.ongoing++
      const tks = tasksByProject[p.id] ?? []
      g.taskTotal += tks.length
      g.taskDone += tks.filter((t) => t.status === 'Done').length
      g.quoted += num(p.quoted_hours)
      g.logged += (tsByProject[p.id] ?? []).reduce((s, r) => s + productiveOf(r), 0)
      ;(membersByProject[p.id] ?? []).forEach((m) => g.members.add(String(m.id)))
      map.set(key, g)
    }
    return Array.from(map.values()).sort((a, b) => b.projects - a.projects)
  }, [projects, statusMap, tasksByProject, tsByProject, membersByProject])

  // Per-project rows for the drilled-in discipline.
  const detail = useMemo(() => {
    if (!selected) return null
    const list = projects.filter((p) => disciplineOf(p) === selected)
    const members = new Map<string, Member>()
    const rows = list.map((p) => {
      const tks = tasksByProject[p.id] ?? []
      const done = tks.filter((t) => t.status === 'Done').length
      const logged = (tsByProject[p.id] ?? []).reduce((s, r) => s + productiveOf(r), 0)
      ;(membersByProject[p.id] ?? []).forEach((m) => members.set(String(m.id), m))
      return {
        p,
        st: stage(statusMap[p.id] ?? 'On-going'),
        total: tks.length, done,
        pct: tks.length ? Math.round((done / tks.length) * 100) : 0,
        quoted: num(p.quoted_hours), logged,
        members: (membersByProject[p.id] ?? []).length
      }
    }).sort((a, b) => a.st.localeCompare(b.st) || a.p.name.localeCompare(b.p.name))
    return { rows, members: Array.from(members.values()) }
  }, [selected, projects, statusMap, tasksByProject, tsByProject, membersByProject])

  const openProject = (id: number): void => { if (onSelect) { onSelect(id); onClose() } }

  const exportCsv = async (): Promise<void> => {
    const rows = groups.map((g) => ({
      discipline: g.discipline, projects: g.projects, ongoing: g.ongoing, onhold: g.onhold, completed: g.completed,
      task_done: g.taskDone, task_total: g.taskTotal, logged_hours: g.logged, quoted_hours: g.quoted, members: g.members.size
    }))
    if (!rows.length) { return }
    await window.api.csv.export('discipline_rollup', 'discipline_rollup', rows)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 860 }}>
        <div className="modal-header">
          {selected ? (
            <h3><button className="btn-link-back" onClick={() => setSelected(null)}>← Disciplines</button> <DisciplineIcon discipline={selected} size={18} /> {selected}</h3>
          ) : (
            <h3><Icon name="grid" size={18} /> Discipline Roll-up</h3>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!selected && <button className="btn btn-secondary btn-sm" onClick={exportCsv}><Icon name="download" size={14} /> CSV</button>}
            <button className="btn-icon" onClick={onClose}><Icon name="close" size={18} /></button>
          </div>
        </div>
        <div className="modal-body">
          {!selected && (
            <>
              <p className="login-sub" style={{ marginBottom: 12 }}>Projects, tasks and workload aggregated by discipline. Click a card to drill in.</p>
              {groups.length === 0 && <div className="attach-empty">No projects to roll up.</div>}
              <div className="disc-grid">
                {groups.map((g) => {
                  const donePct = g.taskTotal ? Math.round((g.taskDone / g.taskTotal) * 100) : 0
                  const usedPct = g.quoted ? Math.round((g.logged / g.quoted) * 100) : 0
                  return (
                    <div className="disc-card disc-click" key={g.discipline} onClick={() => setSelected(g.discipline)} title={`Open ${g.discipline}`}>
                      <div className="disc-head">
                        <span className="disc-icon"><DisciplineIcon discipline={g.discipline} size={18} /></span>
                        <strong>{g.discipline}</strong>
                        <span className="disc-count">{g.projects} project{g.projects !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="disc-stages">
                        <span className="badge badge-on-going"><CountUp value={g.ongoing} /> on-going</span>
                        <span className="badge badge-on-hold"><CountUp value={g.onhold} /> on-hold</span>
                        <span className="badge badge-completed"><CountUp value={g.completed} /> completed</span>
                      </div>
                      <div className="disc-metric">
                        <div className="disc-metric-label"><span>Tasks</span><span><CountUp value={`${g.taskDone}/${g.taskTotal} · ${donePct}%`} /></span></div>
                        <div className="bf-bar"><div className="bf-fill" style={{ width: `${donePct}%` }} /></div>
                      </div>
                      <div className="disc-metric">
                        <div className="disc-metric-label"><span>Hours (logged / quoted)</span><span><CountUp value={`${g.logged} / ${g.quoted || '—'}${g.quoted ? ` · ${usedPct}%` : ''}`} /></span></div>
                        {g.quoted > 0 && <div className="bf-bar"><div className="bf-fill" style={{ width: `${Math.min(usedPct, 100)}%`, background: usedPct > 100 ? 'var(--danger)' : 'var(--accent)' }} /></div>}
                      </div>
                      <div className="disc-foot"><Icon name="users" size={13} />&nbsp;<CountUp value={g.members.size} />&nbsp;member{g.members.size !== 1 ? 's' : ''} <span className="disc-drill">Drill in →</span></div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {selected && detail && (
            <>
              <p className="login-sub" style={{ marginBottom: 12 }}>{detail.rows.length} project{detail.rows.length !== 1 ? 's' : ''} · {detail.members.length} member{detail.members.length !== 1 ? 's' : ''} in this discipline.{onSelect ? ' Click a project to open it.' : ''}</p>
              <div className="table-wrap" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr><th>Project</th><th style={{ width: 110 }}>Status</th><th style={{ width: 200 }}>Tasks</th><th style={{ width: 150 }}>Hours</th><th style={{ width: 70 }}>Team</th></tr>
                  </thead>
                  <tbody>
                    {detail.rows.map((r) => {
                      const usedPct = r.quoted ? Math.round((r.logged / r.quoted) * 100) : 0
                      return (
                        <tr key={r.p.id} className={onSelect ? 'home-row' : undefined} onClick={() => openProject(r.p.id)}>
                          <td><strong>{r.p.name}</strong>{r.p.client && <span className="home-client"> · {r.p.client}</span>}</td>
                          <td><span className={`badge badge-${r.st.toLowerCase()}`}>{r.st}</span></td>
                          <td>
                            <div className="home-prog">
                              <div className="home-prog-bar"><div className="home-prog-fill" style={{ width: `${r.pct}%` }} /></div>
                              <span className="home-prog-txt">{r.done}/{r.total} · {r.pct}%</span>
                            </div>
                          </td>
                          <td>{r.logged} / {r.quoted || '—'}{r.quoted ? ` · ${usedPct}%` : ''}</td>
                          <td>{r.members ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="users" size={13} /> {r.members}</span> : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {detail.members.length > 0 && (
                <div className="disc-members">
                  <h4 style={{ margin: '16px 0 8px' }}>Team in {selected}</h4>
                  <div className="chip-bar" style={{ flexWrap: 'wrap' }}>
                    {detail.members.map((m) => (
                      <span key={m.id} className="chip" style={{ cursor: 'default' }}>{m.name}{m.role ? ` · ${m.role}` : ''}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          {selected && <button className="btn btn-secondary" onClick={() => setSelected(null)}>← Back to all disciplines</button>}
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
