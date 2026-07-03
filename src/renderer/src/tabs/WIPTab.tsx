import { useState, useEffect, useMemo } from 'react'
import CrudTab from '../components/CrudTab'
import { Column } from '../components/DataTable'
import { FieldDef } from '../components/FormModal'
import { Member } from '../types'
import { useApp } from '../context/AppContext'
import { roleRank } from '../roles'

interface Props {
  projectId: number
  projectName: string
  onToast: (msg: string, type?: 'success' | 'error') => void
}

const WIP_INSTRUCTIONS_NOTE =
  'Follow the project WIP checklist: confirm latest drawings, apply standards, run a self-check before marking achieved.'

export default function WIPTab({ projectId, projectName, onToast }: Props) {
  const { isCompanyAdmin, isManager, members: allOrgMembers } = useApp()
  // projectMembers: members assigned to this project, used for name lookup in the table
  const [projectMembers, setProjectMembers] = useState<Member[]>([])

  useEffect(() => {
    window.api.projectMembers.get(projectId).then((res) => {
      if (res.ok) setProjectMembers(res.data as Member[])
    })
  }, [projectId])

  // nameById: merge org + project members so assigned names always resolve
  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    allOrgMembers.forEach((mb) => m.set(String(mb.id), mb.name))
    projectMembers.forEach((mb) => m.set(String(mb.id), mb.name))
    return m
  }, [projectMembers, allOrgMembers])

  // assignable: all org members with a lower rank than the current user
  const assignable = useMemo(() => {
    const currentUserRank = isCompanyAdmin ? 4 : isManager ? 3 : 2
    return allOrgMembers.filter((mb) => roleRank(mb.role) < currentUserRank)
  }, [allOrgMembers, isCompanyAdmin, isManager])

  const columns: Column[] = [
    { key: 'task_name', label: 'WIP Task' },
    {
      key: 'assigned_member_id', label: 'Assigned', width: '150px',
      render: (v) => (v ? nameById.get(String(v)) || '—' : '—')
    },
    { key: 'planned_date', label: 'Planned Date', width: '120px' },
    { key: 'status', label: 'Status', width: '120px' }
  ]

  const fields: FieldDef[] = [
    { key: 'task_name', label: 'WIP Task', required: true },
    { key: 'instructions', label: 'Instructions to follow', type: 'textarea' },
    {
      key: 'assigned_member_id', label: 'Assigned To', type: 'select',
      optionValues: [{ label: '— Unassigned', value: '' }, ...assignable.map((m) => ({ label: m.name, value: String(m.id) }))]
    },
    { key: 'planned_date', label: 'Planned Date', type: 'date', adminOnly: true },
    { key: 'status', label: 'Status', type: 'select', options: ['Not Started', 'In Progress', 'Achieved', 'Postponed', 'Hold'] }
  ]

  const instructionBanner = (
    <div className="wip-instructions">
      <div className="wip-instructions-title">📋 WIP Instructions</div>
      <p>{WIP_INSTRUCTIONS_NOTE}</p>
    </div>
  )

  return (
    <CrudTab
      type="wip" singular="WIP Task" projectId={projectId} projectName={projectName}
      columns={columns} fields={fields} onToast={onToast}
      computeExtra={(v) => (v.instructions ? {} : { instructions: WIP_INSTRUCTIONS_NOTE })}
      headerExtra={instructionBanner}
      emptyHint="No WIP items yet. Add tasks with planned dates and assign members."
    />
  )
}
