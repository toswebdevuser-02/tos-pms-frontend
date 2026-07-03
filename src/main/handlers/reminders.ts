import { ipcMain, Notification } from 'electron'
import { allOpenWip, allDispatches, allTasks, projectById, memberById } from '../dataLayer'

interface Reminder {
  key: string
  projectId: number
  projectName: string
  kind: 'wip' | 'dispatch' | 'task'
  title: string
  date: string
  severity: 'due' | 'overdue' | 'upcoming'
  assignee: string
  assigneeEmail: string
}

function todayStr(): string {
  return new Date().toISOString().substring(0, 10)
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.round((da - db) / 86400000)
}

function severityFor(date: string): Reminder['severity'] | null {
  if (!date) return null
  const diff = daysBetween(date, todayStr()) // negative => past
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'due'
  if (diff <= 3) return 'upcoming'
  return null
}

const DONE_WIP = new Set(['Achieved', 'Done'])
const DONE_DISPATCH = new Set(['Acknowledged'])
const DONE_TASK = new Set(['Done'])

async function buildReminders(): Promise<Reminder[]> {
  const out: Reminder[] = []
  const pName = new Map<number, string>()
  const getPName = async (id: number): Promise<string> => {
    if (pName.has(id)) return pName.get(id)!
    const p = await projectById(id)
    const n = (p?.name as string) || `Project ${id}`
    pName.set(id, n)
    return n
  }
  const resolveAssignee = async (memberId: unknown): Promise<{ name: string; email: string }> => {
    if (!memberId) return { name: '', email: '' }
    const m = await memberById(Number(memberId))
    return { name: (m?.name as string) || '', email: (m?.email as string) || '' }
  }

  for (const w of await allOpenWip()) {
    if (DONE_WIP.has(String(w.status)) || String(w.status) === 'Hold') continue
    const date = String(w.planned_date || w.due_date || '')
    const sev = severityFor(date)
    if (!sev) continue
    const a = await resolveAssignee(w.assigned_member_id ?? w.assigned_to)
    out.push({
      key: `wip-${w.id}`, projectId: w.project_id as number, projectName: await getPName(w.project_id as number),
      kind: 'wip', title: String(w.task_name || 'WIP item'), date, severity: sev,
      assignee: a.name || String(w.assigned_to || ''), assigneeEmail: a.email
    })
  }

  for (const d of await allDispatches()) {
    if (DONE_DISPATCH.has(String(d.status))) continue
    const date = String(d.dispatch_date || '')
    const sev = severityFor(date)
    if (!sev) continue
    out.push({
      key: `dispatch-${d.id}`, projectId: d.project_id as number, projectName: await getPName(d.project_id as number),
      kind: 'dispatch', title: String(d.dispatch_number || 'Dispatch') + (d.description ? ` — ${d.description}` : ''),
      date, severity: sev, assignee: String(d.recipient || ''), assigneeEmail: ''
    })
  }

  for (const t of await allTasks()) {
    if (DONE_TASK.has(String(t.status))) continue
    const date = String(t.deadline || '')
    const sev = severityFor(date)
    if (!sev) continue
    const a = await resolveAssignee(t.assigned_member_id)
    out.push({
      key: `task-${t.id}`, projectId: t.project_id as number, projectName: await getPName(t.project_id as number),
      kind: 'task', title: String(t.name || 'Task'), date, severity: sev,
      assignee: a.name, assigneeEmail: a.email
    })
  }

  const rank = { overdue: 0, due: 1, upcoming: 2 }
  out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.date.localeCompare(b.date))
  return out
}

export function registerReminderHandlers(): void {
  ipcMain.handle('reminders:get', async () => {
    try { return { ok: true, data: await buildReminders() } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  // show native desktop notifications for overdue/due items
  ipcMain.handle('reminders:notifyDesktop', async () => {
    try {
      const list = (await buildReminders()).filter((r) => r.severity !== 'upcoming')
      if (!Notification.isSupported()) return { ok: true, data: { shown: 0 } }
      const top = list.slice(0, 5)
      for (const r of top) {
        new Notification({
          title: `${r.severity === 'overdue' ? '⚠ Overdue' : 'Due today'}: ${r.projectName}`,
          body: `${r.kind.toUpperCase()} — ${r.title} (${r.date})${r.assignee ? ' · ' + r.assignee : ''}`
        }).show()
      }
      return { ok: true, data: { shown: top.length, total: list.length } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}
