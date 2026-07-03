import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import {
  projectsGetAll, membersGetAll, projectMembersAll, itemsGetByProject
} from '../dataLayer'

type Row = Record<string, unknown>
const num = (v: unknown): number => { const n = parseFloat(String(v ?? '')); return isNaN(n) ? 0 : n }

function toCSV(rows: Row[]): string {
  if (!rows.length) return ''
  const cols = Array.from(rows.reduce((set, r) => { Object.keys(r).forEach((k) => set.add(k)); return set }, new Set<string>()))
  const esc = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = cols.join(',')
  const lines = rows.map((r) => cols.map((c) => esc(r[c])).join(','))
  return [header, ...lines].join('\r\n')
}

function stage(s: string): 'On-going' | 'On-hold' | 'Completed' {
  if (s === 'Completed') return 'Completed'
  if (s === 'On-hold' || s === 'On Hold') return 'On-hold'
  return 'On-going'
}

// Gather one item type across every project (works in local AND remote mode).
async function gatherAll(projects: Row[], type: string): Promise<Row[]> {
  const out: Row[] = []
  await Promise.all(projects.map(async (p) => {
    const rows = await itemsGetByProject(Number(p.id), type)
    for (const r of rows) out.push({ ...r, project_id: r.project_id ?? p.id })
  }))
  return out
}

export function registerPowerBiHandlers(): void {
  // Export every table (+ derived models) as CSV into a chosen folder. Power BI
  // Desktop can "Get Data → Folder" and relate them by id columns.
  ipcMain.handle('powerbi:export', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      const res = await dialog.showOpenDialog(win!, {
        title: 'Choose a folder for the Power BI dataset',
        properties: ['openDirectory', 'createDirectory']
      })
      if (res.canceled || !res.filePaths.length) return { ok: true, data: { dir: null } }

      const dir = path.join(res.filePaths[0], 'ProjectTracker_PowerBI')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const projects = await projectsGetAll()
      const members = await membersGetAll()
      const projectMembers = await projectMembersAll()
      const memberName = new Map<string, string>()
      const memberDisc = new Map<string, string>()
      members.forEach((m) => { memberName.set(String(m.id), String(m.name ?? '')); memberDisc.set(String(m.id), String(m.discipline ?? '')) })
      const projName = new Map<string, string>()
      const projDisc = new Map<string, string>()
      projects.forEach((p) => { projName.set(String(p.id), String(p.name ?? '')); projDisc.set(String(p.id), String(p.discipline ?? '')) })

      // Raw item tables (cross-project).
      const [rfis, queries, dispatches, statuses, wip, qc, timesheets, tasksRaw, standards, scopes, inputs, meetings, feedbackRaw, allocsRaw] =
        await Promise.all([
          gatherAll(projects, 'rfi'), gatherAll(projects, 'query'), gatherAll(projects, 'dispatch'),
          gatherAll(projects, 'status'), gatherAll(projects, 'wip'), gatherAll(projects, 'qc'),
          gatherAll(projects, 'timesheet'), gatherAll(projects, 'task'), gatherAll(projects, 'standard'),
          gatherAll(projects, 'scope'), gatherAll(projects, 'input'), gatherAll(projects, 'meeting'),
          gatherAll(projects, 'feedback'), gatherAll(projects, 'allocation')
        ])

      // Denormalize names so Power BI visuals need fewer joins.
      const tasks: Row[] = tasksRaw.map((t): Row => ({
        ...t, project_name: projName.get(String(t.project_id)) ?? '',
        assignee_name: memberName.get(String(t.assigned_member_id)) ?? '',
        assigned_by_name: memberName.get(String(t.assigned_by)) ?? ''
      }))
      const timesheetsX: Row[] = timesheets.map((t): Row => ({
        ...t, project_name: projName.get(String(t.project_id)) ?? '',
        member_name: memberName.get(String(t.member_id)) ?? ''
      }))
      const feedback: Row[] = feedbackRaw.map((f): Row => ({
        ...f, project_name: projName.get(String(f.project_id)) ?? '',
        member_name: memberName.get(String(f.member_id)) ?? ''
      }))
      const allocations: Row[] = allocsRaw.map((a): Row => ({
        ...a, project_name: projName.get(String(a.project_id)) ?? '',
        member_name: memberName.get(String(a.member_id)) ?? '',
        discipline: memberDisc.get(String(a.member_id)) ?? ''
      }))
      const projectMembersX: Row[] = projectMembers.map((pm): Row => ({
        ...pm, project_name: projName.get(String(pm.project_id)) ?? '',
        member_name: memberName.get(String(pm.member_id)) ?? ''
      }))

      // Status lookup per project.
      const overallByProject = new Map<string, string>()
      statuses.forEach((s) => { if (s.overall) overallByProject.set(String(s.project_id), String(s.overall)) })

      // Derived: project_summary (one row per project with computed KPIs).
      const tasksByP = new Map<string, Row[]>(); tasks.forEach((t) => { const k = String(t.project_id); (tasksByP.get(k) ?? tasksByP.set(k, []).get(k)!).push(t) })
      const hoursByP = new Map<string, number>(); timesheets.forEach((t) => { const k = String(t.project_id); hoursByP.set(k, (hoursByP.get(k) ?? 0) + num(t.total_hrs)) })
      const membersByP = new Map<string, Set<string>>(); projectMembers.forEach((pm) => { const k = String(pm.project_id); const s = membersByP.get(k) ?? new Set<string>(); s.add(String(pm.member_id)); membersByP.set(k, s) })

      const projectSummary = projects.map((p) => {
        const k = String(p.id)
        const tk = tasksByP.get(k) ?? []
        const done = tk.filter((t) => t.status === 'Done').length
        const st = stage(overallByProject.get(k) ?? 'On-going')
        const logged = Math.round((hoursByP.get(k) ?? 0) * 100) / 100
        const quoted = num(p.quoted_hours)
        return {
          project_id: p.id, name: p.name, client: p.client, discipline: p.discipline || 'Unassigned',
          status: st, archived: !!p.archived, start_date: p.start_date ?? '', end_date: p.end_date ?? '',
          quoted_hours: quoted, logged_hours: logged,
          hours_used_pct: quoted ? Math.round((logged / quoted) * 100) : '',
          task_total: tk.length, task_done: done,
          task_pct: tk.length ? Math.round((done / tk.length) * 100) : 0,
          member_count: (membersByP.get(k) ?? new Set()).size
        }
      })

      // Derived: discipline_rollup.
      const discMap = new Map<string, Row>()
      for (const ps of projectSummary) {
        const d = String(ps.discipline)
        const g = (discMap.get(d) ?? { discipline: d, projects: 0, ongoing: 0, onhold: 0, completed: 0, task_total: 0, task_done: 0, quoted_hours: 0, logged_hours: 0 }) as Record<string, number | string>
        g.projects = (g.projects as number) + 1
        if (ps.status === 'Completed') g.completed = (g.completed as number) + 1
        else if (ps.status === 'On-hold') g.onhold = (g.onhold as number) + 1
        else g.ongoing = (g.ongoing as number) + 1
        g.task_total = (g.task_total as number) + ps.task_total
        g.task_done = (g.task_done as number) + ps.task_done
        g.quoted_hours = (g.quoted_hours as number) + ps.quoted_hours
        g.logged_hours = (g.logged_hours as number) + ps.logged_hours
        discMap.set(d, g)
      }
      const disciplineRollup = Array.from(discMap.values()).map((g) => ({
        ...g,
        task_pct: (g.task_total as number) ? Math.round(((g.task_done as number) / (g.task_total as number)) * 100) : 0
      }))

      // Derived: dim_date — a contiguous date table for time-intelligence.
      const dateStrings: string[] = []
      ;[...timesheets, ...allocations, ...tasks].forEach((r) => {
        const d = String(r.date ?? r.deadline ?? '').slice(0, 10)
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dateStrings.push(d)
      })
      const dimDate: Row[] = []
      if (dateStrings.length) {
        const min = new Date(dateStrings.reduce((a, b) => (a < b ? a : b)))
        const max = new Date(dateStrings.reduce((a, b) => (a > b ? a : b)))
        for (let d = new Date(min); d <= max; d.setDate(d.getDate() + 1)) {
          const iso = d.toISOString().slice(0, 10)
          dimDate.push({
            date: iso, year: d.getFullYear(), month: d.getMonth() + 1,
            month_name: d.toLocaleDateString('en-US', { month: 'short' }),
            day: d.getDate(), weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
            week: Math.ceil(((+d - +new Date(d.getFullYear(), 0, 1)) / 86400000 + 1) / 7)
          })
        }
      }

      const tables: Record<string, Row[]> = {
        // dimensions
        projects, members, project_members: projectMembersX, dim_date: dimDate,
        // facts
        rfis, queries, dispatches, project_status: statuses, wip_tasks: wip, qc_items: qc,
        timesheets: timesheetsX, tasks, standards, scopes, inputs, meetings, feedback, allocations,
        // derived models
        project_summary: projectSummary, discipline_rollup: disciplineRollup
      }

      let written = 0
      for (const [name, rows] of Object.entries(tables)) {
        fs.writeFileSync(path.join(dir, `${name}.csv`), toCSV(rows) || '\r\n', 'utf8')
        written++
      }

      const readme = [
        'Project Tracker — Power BI dataset',
        '',
        'In Power BI Desktop:',
        '  1. Home → Get Data → Folder → select this folder (or Text/CSV per file).',
        '  2. Load the CSVs. Suggested star schema:',
        '       DIMENSIONS: projects, members, dim_date',
        '       FACTS: tasks, timesheets, rfis, queries, dispatches, wip_tasks, qc_items,',
        '              feedback, allocations, standards, scopes, inputs, meetings',
        '       DERIVED (ready-made): project_summary (per-project KPIs),',
        '              discipline_rollup (per-discipline KPIs)',
        '  3. In Model view relate by id columns:',
        '       projects.id  ->  *.project_id',
        '       members.id   ->  tasks.assigned_member_id, timesheets.member_id,',
        '                        feedback.member_id, allocations.member_id, project_members.member_id',
        '       dim_date.date ->  timesheets.date, allocations.date, tasks.deadline',
        '  4. Many facts are pre-denormalized (project_name, member_name, assignee_name)',
        '     so simple visuals need no joins.',
        '',
        '  Example visuals: % tasks Done by discipline (discipline_rollup),',
        '  logged_hours vs quoted_hours by project (project_summary),',
        '  total_hrs by member over time (timesheets + dim_date),',
        '  RFI status counts, daily allocations heatmap (allocations + dim_date).',
        '',
        `Generated: ${new Date().toISOString()}`,
        `Tables: ${Object.keys(tables).length}`
      ].join('\n')
      fs.writeFileSync(path.join(dir, '_README.txt'), readme, 'utf8')

      return { ok: true, data: { dir, files: written } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}
