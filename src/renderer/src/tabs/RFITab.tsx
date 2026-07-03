import { useState, useEffect, useMemo } from 'react'
import CrudTab from '../components/CrudTab'
import { Column } from '../components/DataTable'
import { FieldDef } from '../components/FormModal'
import ResponseStatusBar from '../components/ResponseStatusBar'
import ResponseCell from '../components/ResponseCell'
import { Attachment } from '../types'
import { statsFor, ImageStats } from '../lib/imageStatus'

const FIELDS: FieldDef[] = [
  { key: 'rfi_number', label: 'RFI Number', required: true },
  { key: 'subject', label: 'Subject', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'status', label: 'Status', type: 'select', options: ['Open', 'Pending', 'Closed'] },
  { key: 'submitted_date', label: 'Submitted Date', type: 'date' }
]

interface Props {
  projectId: number
  projectName: string
  onToast: (msg: string, type?: 'success' | 'error') => void
}

export default function RFITab({ projectId, projectName, onToast }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [statsById, setStatsById] = useState<Record<number, ImageStats>>({})

  // load per-RFI image-response stats whenever the rows change
  useEffect(() => {
    const ids = rows.map((r) => r.id as number)
    if (!ids.length) { setStatsById({}); return }
    let alive = true
    window.api.attachments.getMany('rfi', ids).then((res) => {
      if (!alive || !res.ok) return
      const byEntity: Record<number, Attachment[]> = {}
      ;(res.data as Attachment[]).forEach((a) => {
        ;(byEntity[a.entity_id] ||= []).push(a)
      })
      const map: Record<number, ImageStats> = {}
      ids.forEach((id) => (map[id] = statsFor(byEntity[id] ?? [])))
      setStatsById(map)
    })
    return () => { alive = false }
  }, [rows])

  const columns: Column[] = [
    { key: 'rfi_number', label: 'RFI #', width: '90px' },
    { key: 'subject', label: 'Subject' },
    { key: 'response_status', label: 'Response (images)', width: '180px', render: (_v, row) => <ResponseCell stats={statsById[row.id as number]} /> },
    { key: 'status', label: 'Status', width: '100px' },
    { key: 'submitted_date', label: 'Submitted', width: '110px' }
  ]

  // aggregate across all RFIs (image-level)
  const agg = useMemo(() => {
    let total = 0, responded = 0
    Object.values(statsById).forEach((s) => { total += s.total; responded += s.responded })
    return { total, responded }
  }, [statsById])

  return (
    <CrudTab
      type="rfi" singular="RFI" projectId={projectId} projectName={projectName}
      columns={columns} fields={FIELDS} attachments onToast={onToast}
      onData={setRows}
      headerExtra={<ResponseStatusBar total={agg.total} responded={agg.responded} noun="image response" />}
    />
  )
}
