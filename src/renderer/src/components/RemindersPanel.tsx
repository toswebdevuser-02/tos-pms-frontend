import { useState, useEffect, useCallback } from 'react'
import { Reminder, Project } from '../types'
import { useApp } from '../context/AppContext'
import Icon, { IconName } from './Icon'

interface Props {
  projects: Project[]
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error') => void
  onNavigate?: (projectId: number, tab: string) => void
}

const SEV_LABEL: Record<string, string> = { overdue: 'Overdue', due: 'Due today', upcoming: 'Upcoming' }
const KIND_ICON: Record<string, IconName> = { wip: 'clipboard', dispatch: 'upload', task: 'checkSquare' }

interface TaskRow extends Record<string, unknown> { id: number; project_id: number; projectName: string }

export default function RemindersPanel({ projects, onClose, onToast, onNavigate }: Props) {
  const { currentMember } = useApp()
  const [list, setList] = useState<Reminder[]>([])
  const [myTasks, setMyTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await window.api.reminders.get()
    if (res.ok) setList(res.data as Reminder[])
    // My tasks across projects (for "needs your response" + my upcoming).
    const mine: TaskRow[] = []
    if (currentMember) {
      await Promise.all(projects.map(async (p) => {
        const r = await window.api.items.getByProject(p.id, 'task')
        if (r.ok) for (const t of r.data as Record<string, unknown>[]) {
          if (String(t.assigned_member_id) === String(currentMember.id)) mine.push({ ...(t as TaskRow), project_id: p.id, projectName: p.name })
        }
      }))
    }
    setMyTasks(mine)
    setLoading(false)
  }, [projects, currentMember])

  useEffect(() => { load() }, [load])

  const writeTask = async (t: TaskRow, patch: Record<string, unknown>): Promise<void> => {
    await window.api.items.update('task', {
      id: t.id, project_id: t.project_id, name: t.name ?? '', assigned_member_id: t.assigned_member_id ?? '',
      deadline: t.deadline ?? '', status: t.status ?? 'Not Started', acceptance: t.acceptance ?? '', assigned_by: t.assigned_by ?? '', ...patch
    })
    load()
  }

  const notify = async () => {
    const res = await window.api.reminders.notifyDesktop()
    if (res.ok) onToast(`Showed ${res.data?.shown ?? 0} desktop notification(s)`)
    else onToast(res.error ?? 'Failed', 'error')
  }

  const emailOne = async (r: Reminder) => {
    if (!r.assigneeEmail) { onToast('No email on file for this member', 'error'); return }
    const res = await window.api.email.send({
      to: r.assigneeEmail,
      subject: `[${r.projectName}] ${SEV_LABEL[r.severity]}: ${r.title}`,
      html: `<p>Hi ${r.assignee || ''},</p><p>This is a reminder that <b>${r.title}</b> (${r.kind.toUpperCase()}) on project <b>${r.projectName}</b> is <b>${SEV_LABEL[r.severity].toLowerCase()}</b> (date: ${r.date}).</p><p>Please update its status in TOS Tracker.</p>`
    })
    if (res.ok) onToast(`Emailed ${r.assignee}`)
    else onToast(res.error ?? 'Email failed', 'error')
  }

  const pending = myTasks.filter((t) => t.acceptance === 'Pending')
  const overdue = list.filter((r) => r.severity === 'overdue').length
  const go = (t: TaskRow): void => { if (onNavigate) { onNavigate(t.project_id, 'Tasks'); onClose() } }

  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="drawer-header">
          <div>
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><Icon name="inbox" size={18} /> Inbox</h3>
            <span className="drawer-sub">{pending.length} to respond · {overdue} overdue · {list.length} reminders</span>
          </div>
          <button className="btn-icon" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="drawer-toolbar">
          <button className="btn btn-secondary btn-sm" onClick={notify}><Icon name="bellRing" size={15} /> Desktop notify</button>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
        </div>
        <div className="drawer-body">
          {loading ? (
            <div className="attach-empty">Loading…</div>
          ) : (
            <>
              {pending.length > 0 && (
                <>
                  <div className="inbox-section">Needs your response</div>
                  {pending.map((t) => (
                    <div key={`t${t.id}`} className="reminder-card sev-overdue">
                      <div className="reminder-icon"><Icon name="inbox" size={18} /></div>
                      <div className="reminder-main">
                        <div className="reminder-title" onClick={() => go(t)} style={{ cursor: onNavigate ? 'pointer' : 'default' }}>{String(t.name ?? 'Task')}</div>
                        <div className="reminder-meta">
                          <span className="badge sev-badge-overdue">Delegated to you</span>
                          <span>{t.projectName}</span>
                          {t.deadline ? <span>· due {String(t.deadline)}</span> : null}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary btn-xs" onClick={() => writeTask(t, { acceptance: 'Accepted' }).then(() => onToast('Task accepted'))}>Accept</button>
                        <button className="btn btn-secondary btn-xs" onClick={() => writeTask(t, { acceptance: 'Declined' }).then(() => onToast('Task declined'))}>Decline</button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              <div className="inbox-section">Deadlines &amp; reminders</div>
              {list.length === 0 ? (
                <div className="attach-empty"><Icon name="checkCircle" size={14} style={{ verticalAlign: '-2px', color: 'var(--success)' }} /> Nothing due. You’re all caught up.</div>
              ) : (
                list.map((r) => (
                  <div key={r.key} className={`reminder-card sev-${r.severity}`}>
                    <div className="reminder-icon"><Icon name={KIND_ICON[r.kind] ?? 'bell'} size={18} /></div>
                    <div className="reminder-main">
                      <div className="reminder-title">{r.title}</div>
                      <div className="reminder-meta">
                        <span className={`badge sev-badge-${r.severity}`}>{SEV_LABEL[r.severity]}</span>
                        <span>{r.projectName}</span>
                        <span>· {r.kind.toUpperCase()}</span>
                        <span>· {r.date}</span>
                        {r.assignee && <span>· {r.assignee}</span>}
                      </div>
                    </div>
                    {r.assigneeEmail && (
                      <button className="btn btn-secondary btn-sm" onClick={() => emailOne(r)}>✉ Email</button>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
