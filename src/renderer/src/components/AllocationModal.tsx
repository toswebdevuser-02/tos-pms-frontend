import { useState, useEffect, useCallback, useMemo } from 'react'
import { Project, Member } from '../types'
import { useApp } from '../context/AppContext'
import EmptyState from './EmptyState'
import Icon from './Icon'

interface Props {
  projects: Project[]
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error') => void
}

interface Alloc extends Record<string, unknown> {
  id: number
  project_id: number
  member_id: number | string
  task_id?: number | string
  date: string
  hours?: number | string
  note?: string
}

type Row = Record<string, unknown>

// Monday of the week containing `d`.
function weekStartOf(d: Date): Date {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // 0 = Monday
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}
const iso = (d: Date): string => d.toISOString().slice(0, 10)
const fmtDay = (d: Date): string => d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })

export default function AllocationModal({ projects, onClose, onToast }: Props) {
  const { members, isAdmin } = useApp()
  const [weekStart, setWeekStart] = useState<Date>(() => weekStartOf(new Date()))
  const [allocs, setAllocs] = useState<Alloc[]>([])
  const [tasksByProject, setTasksByProject] = useState<Record<number, Row[]>>({})
  const [editor, setEditor] = useState<{ memberId: number; date: string } | null>(null)
  // editor form
  const [fProject, setFProject] = useState<number | ''>('')
  const [fTask, setFTask] = useState<string>('')
  const [fHours, setFHours] = useState<string>('')
  const [fNote, setFNote] = useState<string>('')

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d }), [weekStart])
  const dayKeys = days.map(iso)
  const roster = members.filter((m) => m.status !== 'left')

  const load = useCallback(async () => {
    const all: Alloc[] = []
    await Promise.all(projects.map(async (p) => {
      const res = await window.api.items.getByProject(p.id, 'allocation')
      if (res.ok) for (const a of res.data as Alloc[]) all.push({ ...a, project_id: p.id })
    }))
    setAllocs(all)
  }, [projects])
  useEffect(() => { load() }, [load])

  const loadTasks = useCallback(async (pid: number) => {
    if (tasksByProject[pid]) return
    const res = await window.api.items.getByProject(pid, 'task')
    if (res.ok) setTasksByProject((m) => ({ ...m, [pid]: res.data as Row[] }))
  }, [tasksByProject])

  const projName = (id: number): string => projects.find((p) => p.id === id)?.name ?? '—'
  const taskName = (pid: number, tid?: number | string): string => {
    if (!tid) return ''
    const t = (tasksByProject[pid] ?? []).find((x) => String(x.id) === String(tid))
    return t ? String(t.name ?? '') : ''
  }

  const openCell = (memberId: number, date: string): void => {
    if (!isAdmin) { onToast('Only managers/leads can plan allocations', 'error'); return }
    setEditor({ memberId, date }); setFProject(''); setFTask(''); setFHours(''); setFNote('')
  }

  const save = async (): Promise<void> => {
    if (!editor || !fProject) { onToast('Pick a project', 'error'); return }
    const res = await window.api.items.create('allocation', {
      project_id: fProject, member_id: editor.memberId, task_id: fTask || '',
      date: editor.date, hours: fHours ? Number(fHours) : '', note: fNote
    })
    if (res.ok) { onToast('Allocation added'); setEditor(null); load() }
    else onToast(res.error ?? 'Failed', 'error')
  }

  const remove = async (a: Alloc): Promise<void> => {
    const res = await window.api.items.delete('allocation', a.id)
    if (res.ok) { onToast('Allocation removed'); load() }
    else onToast(res.error ?? 'Failed', 'error')
  }

  const cellAllocs = (memberId: number, date: string): Alloc[] =>
    allocs.filter((a) => String(a.member_id) === String(memberId) && a.date === date)
  const CAPACITY = 8 // hours/day
  const cellHours = (list: Alloc[]): number => list.reduce((s, a) => s + (parseFloat(String(a.hours ?? '')) || 0), 0)

  const exportCsv = async (): Promise<void> => {
    const inWeek = allocs.filter((a) => dayKeys.includes(a.date))
    const rows = inWeek.map((a) => ({
      date: a.date, member: memberName(a.member_id), project: projName(a.project_id),
      task: taskName(a.project_id, a.task_id), hours: a.hours ?? '', note: a.note ?? ''
    }))
    if (!rows.length) { onToast('No allocations this week to export', 'error'); return }
    const res = await window.api.csv.export('allocations', `allocations_${dayKeys[0]}`, rows)
    if (res.ok && res.data?.filePath) onToast('Allocations exported')
  }
  const memberName = (id: number | string): string => members.find((m) => String(m.id) === String(id))?.name ?? '—'

  const shiftWeek = (delta: number): void => { const d = new Date(weekStart); d.setDate(d.getDate() + delta * 7); setWeekStart(d) }
  const label = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 960, maxWidth: '95vw' }}>
        <div className="modal-header">
          <h3><Icon name="calendar" size={18} /> Daily Work Allocation</h3>
          <button className="btn-icon" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="alloc-toolbar">
            <button className="btn btn-secondary btn-sm" onClick={() => shiftWeek(-1)}>← Prev</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setWeekStart(weekStartOf(new Date()))}>This week</button>
            <button className="btn btn-secondary btn-sm" onClick={() => shiftWeek(1)}>Next →</button>
            <strong style={{ marginLeft: 8 }}>{label}</strong>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={exportCsv}><Icon name="download" size={14} /> CSV</button>
          </div>

          {roster.length === 0 ? (
            <EmptyState icon="users" title="No active members to plan" hint="Add team members (Workspace → Members) and they’ll appear here so you can plan each person’s day." />
          ) : (
            <div className="alloc-wrap">
              <table className="alloc-grid">
                <thead>
                  <tr>
                    <th className="alloc-name">Member</th>
                    {days.map((d, i) => {
                      const today = iso(d) === iso(new Date())
                      return <th key={i} className={today ? 'alloc-today' : undefined}>{fmtDay(d)}</th>
                    })}
                  </tr>
                </thead>
                <tbody>
                  {roster.map((m: Member) => (
                    <tr key={m.id}>
                      <td className="alloc-name">{m.name}{m.discipline ? <span className="alloc-disc"> · {m.discipline}</span> : null}</td>
                      {dayKeys.map((dk) => {
                        const list = cellAllocs(m.id, dk)
                        const hrs = cellHours(list)
                        const over = hrs > CAPACITY
                        return (
                        <td key={dk} className={`alloc-cell${over ? ' alloc-over' : ''}`} onClick={() => openCell(m.id, dk)} title={hrs ? `${hrs}h planned${over ? ` · over capacity (${CAPACITY}h)` : ''}` : undefined}>
                          {hrs > 0 && <span className={`alloc-load${over ? ' over' : hrs >= CAPACITY ? ' full' : ''}`}>{hrs}h</span>}
                          {list.map((a) => (
                            <span key={a.id} className="alloc-chip" title={a.note ? String(a.note) : undefined} onClick={(e) => { e.stopPropagation(); remove(a) }}>
                              {projName(a.project_id)}
                              {a.task_id ? ` · ${taskName(a.project_id, a.task_id)}` : ''}
                              {a.hours ? ` (${a.hours}h)` : ''}
                              <span className="alloc-x"><Icon name="close" size={10} /></span>
                            </span>
                          ))}
                          {isAdmin && <span className="alloc-add">+</span>}
                        </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="attach-hint">Click a cell to plan a member’s work for that day. Click a chip to remove it.</p>
        </div>

        {editor && (
          <div className="alloc-editor">
            <div className="alloc-editor-head">
              Plan: <strong>{members.find((m) => m.id === editor.memberId)?.name}</strong> · {editor.date}
            </div>
            <div className="alloc-editor-form">
              <select value={fProject} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ''; setFProject(v); setFTask(''); if (v) loadTasks(v) }}>
                <option value="">— Project *</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={fTask} onChange={(e) => setFTask(e.target.value)} disabled={!fProject}>
                <option value="">— Task (optional)</option>
                {(fProject ? tasksByProject[fProject] ?? [] : []).map((t) => <option key={String(t.id)} value={String(t.id)}>{String(t.name ?? '')}</option>)}
              </select>
              <input type="number" placeholder="Hrs" style={{ width: 70 }} value={fHours} onChange={(e) => setFHours(e.target.value)} />
              <input placeholder="Note" value={fNote} onChange={(e) => setFNote(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={save}>Add</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditor(null)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
