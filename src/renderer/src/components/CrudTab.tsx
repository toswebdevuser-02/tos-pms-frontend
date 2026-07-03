import { useState, useEffect, useCallback, ReactNode } from 'react'
import DataTable, { Column } from './DataTable'
import FormModal, { FieldDef } from './FormModal'
import Icon from './Icon'
import { useApp } from '../context/AppContext'
import { ToastFn } from '../types'

interface Props {
  type: string
  singular: string
  projectId: number
  projectName: string
  columns: Column[]
  fields: FieldDef[]
  attachments?: boolean
  adminOnlyAdd?: boolean
  emptyHint?: string
  computeExtra?: (values: Record<string, string>) => Record<string, unknown>
  onToast: ToastFn
  onData?: (rows: Record<string, unknown>[]) => void
  toolbarExtra?: ReactNode
  headerExtra?: ReactNode
  rowFilter?: (row: Record<string, unknown>) => boolean
  canEditRow?: (row: Record<string, unknown>) => boolean
  canDeleteRow?: (row: Record<string, unknown>) => boolean
  editLabel?: string
  reloadSignal?: number
}

export default function CrudTab({
  type, singular, projectId, projectName, columns, fields, attachments,
  adminOnlyAdd, emptyHint, computeExtra, onToast, onData, toolbarExtra, headerExtra, rowFilter,
  canEditRow, canDeleteRow, editLabel, reloadSignal
}: Props) {
  const { isAdmin } = useApp()
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: Record<string, unknown> } | null>(null)

  const load = useCallback(async () => {
    const res = await window.api.items.getByProject(projectId, type)
    if (res.ok) { setRows(res.data as Record<string, unknown>[]); onData?.(res.data as Record<string, unknown>[]) }
  }, [projectId, type, onData])

  useEffect(() => { load() }, [load, reloadSignal])

  const handleSubmit = async (data: Record<string, string>) => {
    const extra = computeExtra ? computeExtra(data) : {}
    if (modal?.mode === 'edit' && modal.row) {
      await window.api.items.update(type, { id: modal.row.id, project_id: projectId, ...data, ...extra })
      onToast(`${singular} updated`)
    } else {
      await window.api.items.create(type, { project_id: projectId, ...data, ...extra })
      onToast(`${singular} added`)
    }
    setModal(null)
    load()
  }

  const handleDelete = async (row: Record<string, unknown>) => {
    if (!confirm(`Delete this ${singular.toLowerCase()}?`)) return
    await window.api.items.delete(type, row.id as number)
    // Capture the row (minus server-managed fields) so the delete can be undone.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, updated_at, created_by, updated_by, version, ...payload } = row
    onToast(`${singular} deleted`, 'success', {
      label: 'Undo',
      onClick: async () => {
        await window.api.items.create(type, { project_id: projectId, ...payload })
        onToast(`${singular} restored`)
        load()
      }
    })
    load()
  }

  const handleExport = async () => {
    if (!rows.length) { onToast('No data to export', 'error'); return }
    const res = await window.api.excel.export(type, projectName, rows)
    if (res.ok && res.data?.filePath) onToast(`Exported to ${res.data.filePath}`)
    else if (res.ok) onToast('Export cancelled')
    else onToast(res.error ?? 'Export failed', 'error')
  }

  const canAdd = !adminOnlyAdd || isAdmin
  const displayRows = rowFilter ? rows.filter(rowFilter) : rows

  return (
    <div className="tab-content">
      <div className="tab-toolbar">
        <div className="tab-toolbar-left">
          {canAdd && (
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ mode: 'add' })}>+ Add {singular}</button>
          )}
          {toolbarExtra}
        </div>
        <div className="tab-toolbar-right">
          <button className="btn btn-secondary btn-sm" onClick={handleExport}><Icon name="download" size={15} /> Export Excel</button>
        </div>
      </div>
      {headerExtra}
      <DataTable
        columns={columns}
        rows={displayRows}
        emptyHint={emptyHint}
        onEdit={(r) => setModal({ mode: 'edit', row: r })}
        onDelete={handleDelete}
        canEdit={canEditRow}
        canDelete={canDeleteRow}
        editLabel={editLabel}
      />
      {modal && (
        <FormModal
          title={modal.mode === 'add' ? `Add ${singular}` : `Edit ${singular}`}
          fields={fields}
          initial={modal.row}
          isAdmin={isAdmin}
          attachmentsEntity={attachments ? { type, id: (modal.row?.id as number) ?? null } : undefined}
          onSubmit={handleSubmit}
          onClose={() => { setModal(null); load() }}
          onToast={onToast}
        />
      )}
    </div>
  )
}
