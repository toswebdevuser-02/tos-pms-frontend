import { useState, useEffect, useCallback } from 'react'
import { ProjectStatus } from '../types'

const STATUS_OPTIONS = ['On-going', 'On-hold', 'Completed']
const FACTOR: Record<string, number> = { 'Done': 1, 'In Progress': 0.5, 'Not Started': 0 }

// Map legacy stage values onto the new options so old projects pre-select correctly.
const LEGACY_STAGE: Record<string, string> = {
  'On Hold': 'On-hold', Planning: 'On-going', Design: 'On-going', Construction: 'On-going', Completed: 'Completed'
}
function normalizeStage(s: string): string {
  return STATUS_OPTIONS.includes(s) ? s : (LEGACY_STAGE[s] ?? 'On-going')
}

interface Props {
  projectId: number
  onToast: (msg: string, type?: 'success' | 'error') => void
}

export default function StatusTab({ projectId, onToast }: Props) {
  const [status, setStatus] = useState<ProjectStatus | null>(null)
  const [overall, setOverall] = useState('On-going')
  const [notes, setNotes] = useState('')
  const [dirty, setDirty] = useState(false)
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([])

  const load = useCallback(async () => {
    const res = await window.api.items.getByProject(projectId, 'status')
    if (res.ok && (res.data as ProjectStatus[]).length > 0) {
      const s = (res.data as ProjectStatus[])[0]
      setStatus(s); setOverall(normalizeStage(s.overall)); setNotes(s.notes)
    } else {
      setStatus(null); setOverall('On-going'); setNotes('')
    }
    setDirty(false)
    const tres = await window.api.items.getByProject(projectId, 'task')
    if (tres.ok) setTasks(tres.data as Record<string, unknown>[])
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    await window.api.items.create('status', { project_id: projectId, overall, notes })
    onToast('Status saved')
    setDirty(false)
    load()
  }

  // weighted % from tasks
  const totalWeight = tasks.reduce((s, t) => s + (parseFloat(String(t.weight)) || 1), 0)
  const earned = tasks.reduce((s, t) => s + (parseFloat(String(t.weight)) || 1) * (FACTOR[String(t.status)] ?? 0), 0)
  const pct = totalWeight ? Math.round((earned / totalWeight) * 100) : 0
  const counts = {
    done: tasks.filter((t) => t.status === 'Done').length,
    progress: tasks.filter((t) => t.status === 'In Progress').length,
    todo: tasks.filter((t) => t.status === 'Not Started').length
  }

  return (
    <div className="tab-content">
      <div className="status-form">
        <h3>Progress</h3>
        {tasks.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
            No tasks yet — add tasks in the <strong>Tasks</strong> tab to track % completion automatically.
          </p>
        ) : (
          <div className="progress-block">
            <div className="progress-top">
              <span className="progress-pct">{pct}%</span>
              <span className="progress-sub">
                {counts.done} done · {counts.progress} in progress · {counts.todo} not started
              </span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          </div>
        )}

        <h3 style={{ marginTop: 28 }}>Project Status</h3>
        {status?.last_updated && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Last updated: {status.last_updated}</p>
        )}
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Overall Stage</label>
          <select value={overall} onChange={(e) => { setOverall(e.target.value); setDirty(true) }}>
            {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true) }} rows={4} />
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={!dirty} style={{ opacity: dirty ? 1 : 0.5 }}>
            Save Status
          </button>
        </div>
      </div>
    </div>
  )
}
