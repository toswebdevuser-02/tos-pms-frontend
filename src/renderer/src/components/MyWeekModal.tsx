import { useState, useEffect, useCallback, useMemo } from 'react'
import { Project } from '../types'
import { useApp } from '../context/AppContext'
import Icon from './Icon'

interface Props {
  projects: Project[]
  onClose: () => void
  onNavigate?: (projectId: number, tab: string) => void
}

type Row = Record<string, unknown>
const s = (v: unknown): string => String(v ?? '')
const num = (v: unknown): number => { const n = parseFloat(String(v ?? '')); return isNaN(n) ? 0 : n }

function weekRange(): { start: Date; end: Date; keys: string[] } {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const day = (now.getDay() + 6) % 7
  const start = new Date(now); start.setDate(now.getDate() - day)
  const end = new Date(start); end.setDate(start.getDate() + 6)
  const keys = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d.toISOString().slice(0, 10) })
  return { start, end, keys }
}

export default function MyWeekModal({ projects, onClose, onNavigate }: Props) {
  const { currentMember } = useApp()
  const [tasks, setTasks] = useState<Row[]>([])
  const [allocs, setAllocs] = useState<Row[]>([])
  const [timesheets, setTimesheets] = useState<Row[]>([])
  const { keys } = useMemo(weekRange, [])
  const projName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects])

  const load = useCallback(async () => {
    if (!currentMember) return
    const T: Row[] = [], A: Row[] = [], H: Row[] = []
    await Promise.all(projects.map(async (p) => {
      const [t, a, h] = await Promise.all([
        window.api.items.getByProject(p.id, 'task'),
        window.api.items.getByProject(p.id, 'allocation'),
        window.api.items.getByProject(p.id, 'timesheet')
      ])
      const mine = (rows: Row[], field: string): Row[] => rows.filter((r) => String(r[field]) === String(currentMember.id)).map((r) => ({ ...r, project_id: p.id }))
      if (t.ok) T.push(...mine(t.data as Row[], 'assigned_member_id'))
      if (a.ok) A.push(...mine(a.data as Row[], 'member_id'))
      if (h.ok) H.push(...mine(h.data as Row[], 'member_id'))
    }))
    setTasks(T); setAllocs(A); setTimesheets(H)
  }, [projects, currentMember])
  useEffect(() => { load() }, [load])

  const today = new Date().toISOString().slice(0, 10)
  const dueTasks = useMemo(() =>
    tasks.filter((t) => t.status !== 'Done' && (!t.deadline || (keys.includes(s(t.deadline).slice(0, 10)) || s(t.deadline).slice(0, 10) < today)))
      .sort((a, b) => s(a.deadline).localeCompare(s(b.deadline))), [tasks, keys, today])
  const weekAllocs = useMemo(() => allocs.filter((a) => keys.includes(s(a.date).slice(0, 10))), [allocs, keys])
  const weekHours = useMemo(() => timesheets.filter((h) => keys.includes(s(h.date).slice(0, 10))).reduce((sm, h) => sm + num(h.total_hrs), 0), [timesheets, keys])

  const dayName = (iso: string): string => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
  const open = (pid: number, tab: string): void => { if (onNavigate) { onNavigate(pid, tab); onClose() } }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 720 }}>
        <div className="modal-header">
          <h3><Icon name="calendar" size={18} /> My Week</h3>
          <button className="btn-icon" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          {!currentMember ? (
            <div className="attach-hint">Select who you are (“Acting as”) or sign in to see your week.</div>
          ) : (
            <>
              <div className="kpi-grid" style={{ marginBottom: 8 }}>
                <div className="kpi-card"><div className="kpi-icon" style={{ background: '#3b82f622', color: '#3b82f6' }}><Icon name="checkSquare" size={22} /></div><div className="kpi-body"><div className="kpi-value">{dueTasks.length}</div><div className="kpi-label">Tasks to do</div></div></div>
                <div className="kpi-card"><div className="kpi-icon" style={{ background: '#a78bfa22', color: '#a78bfa' }}><Icon name="calendar" size={22} /></div><div className="kpi-body"><div className="kpi-value">{weekAllocs.length}</div><div className="kpi-label">Allocations</div></div></div>
                <div className="kpi-card"><div className="kpi-icon" style={{ background: '#22c55e22', color: '#22c55e' }}><Icon name="clock" size={22} /></div><div className="kpi-body"><div className="kpi-value">{Math.round(weekHours * 10) / 10}</div><div className="kpi-label">Hours logged</div></div></div>
              </div>

              <h4 className="myweek-h">Tasks due / overdue</h4>
              {dueTasks.length === 0 ? <div className="attach-empty"><Icon name="checkCircle" size={14} style={{ verticalAlign: '-2px', color: 'var(--success)' }} /> Nothing due — you’re all caught up.</div> : (
                <div className="myweek-list">
                  {dueTasks.map((t) => {
                    const od = t.deadline && s(t.deadline).slice(0, 10) < today
                    return (
                      <div key={`t${t.id}`} className="myweek-row" onClick={() => open(Number(t.project_id), 'Tasks')}>
                        <span className="myweek-dot" />
                        <span className="myweek-title">{s(t.name)}</span>
                        <span className="myweek-meta">{projName.get(Number(t.project_id))}</span>
                        {t.deadline ? <span className={`badge ${od ? 'badge-on-hold' : 'badge-design'}`}>{od ? 'Overdue' : s(t.deadline).slice(0, 10)}</span> : <span className="myweek-meta">no date</span>}
                        {t.acceptance === 'Pending' && <span className="badge badge-pending">to accept</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              <h4 className="myweek-h">This week’s allocations</h4>
              {weekAllocs.length === 0 ? <div className="attach-empty">No planned work this week.</div> : (
                <div className="myweek-list">
                  {weekAllocs.sort((a, b) => s(a.date).localeCompare(s(b.date))).map((a) => (
                    <div key={`a${a.id}`} className="myweek-row" onClick={() => open(Number(a.project_id), 'Tasks')}>
                      <span className="badge badge-design">{dayName(s(a.date).slice(0, 10))}</span>
                      <span className="myweek-title">{projName.get(Number(a.project_id))}</span>
                      {a.note ? <span className="myweek-meta">{s(a.note)}</span> : null}
                      {a.hours ? <span className="myweek-meta">{s(a.hours)}h</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
