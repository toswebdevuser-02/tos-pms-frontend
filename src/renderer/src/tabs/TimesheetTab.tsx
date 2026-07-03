import { useState, useEffect, useMemo } from 'react'
import CrudTab from '../components/CrudTab'
import { Column } from '../components/DataTable'
import { FieldDef } from '../components/FormModal'
import { Member } from '../types'
import { useApp } from '../context/AppContext'

interface Props {
  projectId: number
  projectName: string
  onToast: (msg: string, type?: 'success' | 'error') => void
  quotedHours?: number
}

type Row = Record<string, unknown>
// Productive hours = execution + overtime. Total = sum of ALL hour categories.
const PRODUCTIVE_KEYS = ['execution_hrs', 'overtime_hrs']
const ALL_HOUR_KEYS = ['execution_hrs', 'discussion_hrs', 'qc_hrs', 'it_issue_hrs', 'correction_hrs', 'overtime_hrs']

function num(v: unknown): number {
  const n = parseFloat(String(v ?? ''))
  return isNaN(n) ? 0 : n
}
function productiveOf(r: Row): number {
  return PRODUCTIVE_KEYS.reduce((s, k) => s + num(r[k]), 0)
}
function totalOf(r: Row): number {
  return ALL_HOUR_KEYS.reduce((s, k) => s + num(r[k]), 0)
}

export default function TimesheetTab({ projectId, projectName, onToast, quotedHours = 0 }: Props) {
  const { currentMember, isAdmin } = useApp()
  const [members, setMembers] = useState<Member[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [filterMember, setFilterMember] = useState<string>('')

  useEffect(() => {
    window.api.projectMembers.get(projectId).then((res) => {
      if (res.ok) setMembers(res.data as Member[])
    })
  }, [projectId])

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    members.forEach((mb) => m.set(String(mb.id), mb.name))
    return m
  }, [members])

  const memberOptions = useMemo(() => {
    const opts = members.map((m) => ({ label: m.name, value: String(m.id) }))
    if (currentMember) {
      const idx = opts.findIndex((o) => o.value === String(currentMember.id))
      if (idx > 0) { const [me] = opts.splice(idx, 1); opts.unshift(me) }
    }
    return opts.length ? opts : [{ label: '— No members assigned', value: '' }]
  }, [members, currentMember])

  // per-member totals across all entries
  const summary = useMemo(() => {
    const byMember = new Map<string, { productive: number; total: number; ot: number; corr: number; entries: number }>()
    for (const r of rows) {
      const key = String(r.member_id ?? '')
      const cur = byMember.get(key) ?? { productive: 0, total: 0, ot: 0, corr: 0, entries: 0 }
      cur.productive += productiveOf(r)
      cur.total += totalOf(r)
      cur.ot += num(r.overtime_hrs)
      cur.corr += num(r.correction_hrs)
      cur.entries += 1
      byMember.set(key, cur)
    }
    return byMember
  }, [rows])

  const grand = useMemo(() => {
    let productive = 0, total = 0, ot = 0, corr = 0
    summary.forEach((v) => { productive += v.productive; total += v.total; ot += v.ot; corr += v.corr })
    return { productive, total, ot, corr }
  }, [summary])

  const columns: Column[] = [
    { key: 'date', label: 'Date', width: '105px' },
    { key: 'member_id', label: 'Member', width: '130px', render: (v) => (v ? nameById.get(String(v)) || '—' : '—') },
    { key: 'task', label: 'Task' },
    { key: 'execution_hrs', label: 'Exec', width: '55px' },
    { key: 'discussion_hrs', label: 'Disc', width: '55px' },
    { key: 'qc_hrs', label: 'QC', width: '50px' },
    { key: 'it_issue_hrs', label: 'IT', width: '50px' },
    { key: 'overtime_hrs', label: 'OT', width: '50px' },
    { key: 'productive_hrs', label: 'Productive', width: '85px', render: (_v, row) => <strong>{productiveOf(row)}</strong> },
    { key: 'correction_hrs', label: 'Corr', width: '55px' },
    { key: 'total_hrs', label: 'Total', width: '70px', render: (_v, row) => <strong style={{ color: 'var(--accent)' }}>{totalOf(row)}</strong> }
  ]

  const fields: FieldDef[] = [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'member_id', label: 'Member', type: 'select', optionValues: memberOptions, adminOnly: true },
    { key: 'task', label: 'Task worked on', required: true },
    { key: 'execution_hrs', label: 'Execution hrs', type: 'number' },
    { key: 'discussion_hrs', label: 'Discussion hrs', type: 'number' },
    { key: 'qc_hrs', label: 'QC hrs', type: 'number' },
    { key: 'it_issue_hrs', label: 'IT issue hrs', type: 'number' },
    { key: 'overtime_hrs', label: 'Overtime hrs', type: 'number' },
    { key: 'correction_hrs', label: 'Correction hrs (rework — in Total, not Productive)', type: 'number' }
  ]

  const loggedTotal = grand.total
  // Time left on the project is driven by Productive hours (execution + overtime) against the quote.
  const remaining = quotedHours - grand.productive
  const usedPct = quotedHours ? Math.round((grand.productive / quotedHours) * 100) : 0

  const quotaBanner = (
    <div className="ts-summary">
      <div className="quota-banner">
        <div className="quota-stat"><span className="quota-val">{quotedHours || '—'}</span><span className="quota-lbl">Quoted hrs</span></div>
        <div className="quota-stat"><span className="quota-val">{grand.productive}</span><span className="quota-lbl">Productive hrs</span></div>
        <div className="quota-stat"><span className="quota-val">{loggedTotal}</span><span className="quota-lbl">Total logged</span></div>
        <div className="quota-stat"><span className="quota-val" style={{ color: remaining < 0 ? 'var(--danger)' : 'var(--success)' }}>{quotedHours ? remaining : '—'}</span><span className="quota-lbl">Remaining (Quoted − Productive)</span></div>
        {quotedHours > 0 && (
          <div className="quota-bar-wrap">
            <div className="quota-bar"><div className="quota-fill" style={{ width: `${Math.min(usedPct, 100)}%`, background: usedPct > 100 ? 'var(--danger)' : usedPct > 85 ? 'var(--warning)' : 'var(--accent)' }} /></div>
            <span className="quota-pct">{usedPct}% of quoted (productive)</span>
          </div>
        )}
      </div>
    </div>
  )

  const memberSummary = (
    <div className="ts-summary">
      <table className="mini-table">
        <thead>
          <tr><th>Team Member</th><th>Entries</th><th>Productive</th><th>Total</th><th>Overtime</th><th>Correction</th></tr>
        </thead>
        <tbody>
          {members.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--text-dim)' }}>No members assigned to this project.</td></tr>}
          {members.map((m) => {
            const s = summary.get(String(m.id))
            return (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{s?.entries ?? 0}</td>
                <td><strong>{s?.productive ?? 0}</strong></td>
                <td><strong style={{ color: 'var(--accent)' }}>{s?.total ?? 0}</strong></td>
                <td>{s?.ot ?? 0}</td>
                <td>{s?.corr ?? 0}</td>
              </tr>
            )
          })}
          <tr className="ts-grand">
            <td>All members</td>
            <td>{rows.length}</td>
            <td><strong>{grand.productive}</strong></td>
            <td><strong style={{ color: 'var(--accent)' }}>{grand.total}</strong></td>
            <td>{grand.ot}</td>
            <td>{grand.corr}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )

  const filterControl = (
    <select className="ts-filter" value={filterMember} onChange={(e) => setFilterMember(e.target.value)}>
      <option value="">All members</option>
      {members.map((m) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
    </select>
  )

  return (
    <CrudTab
      type="timesheet" singular="Timesheet Entry" projectId={projectId} projectName={projectName}
      columns={columns} fields={fields} onToast={onToast}
      onData={setRows}
      computeExtra={(v) => ({
        productive_hrs: PRODUCTIVE_KEYS.reduce((sum, k) => sum + num(v[k]), 0),
        total_hrs: ALL_HOUR_KEYS.reduce((sum, k) => sum + num(v[k]), 0)
      })}
      toolbarExtra={filterControl}
      headerExtra={<>{quotaBanner}{memberSummary}</>}
      rowFilter={(r) => !filterMember || String(r.member_id) === filterMember}
      canEditRow={(r) => isAdmin || (!!currentMember && String(r.member_id) === String(currentMember.id))}
      canDeleteRow={(r) => isAdmin || (!!currentMember && String(r.member_id) === String(currentMember.id))}
      emptyHint="No timesheet entries yet. Log what each member worked on and the hours."
    />
  )
}
