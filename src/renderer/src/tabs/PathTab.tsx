import CrudTab from '../components/CrudTab'
import { Column } from '../components/DataTable'
import { FieldDef } from '../components/FormModal'
import Icon from '../components/Icon'

interface Props {
  type: string
  singular: string
  projectId: number
  projectName: string
  onToast: (msg: string, type?: 'success' | 'error') => void
  withDate?: boolean
  hint?: string
}

export default function PathTab({ type, singular, projectId, projectName, onToast, withDate, hint }: Props) {
  const openPath = async (p: string): Promise<void> => {
    const res = await window.api.paths.open(p)
    if (!res.ok) onToast(res.error ?? 'Could not open path', 'error')
  }
  const reveal = async (p: string): Promise<void> => {
    const res = await window.api.paths.reveal(p)
    if (!res.ok) onToast(res.error ?? 'Could not reveal path', 'error')
  }

  const pathColumn: Column = {
    key: 'path',
    label: 'Path',
    render: (v) =>
      v ? (
        <div className="path-cell">
          <span className="path-text" title={String(v)}>{String(v)}</span>
          <button className="btn-icon" title="Open" onClick={(e) => { e.stopPropagation(); openPath(String(v)) }}>↗</button>
          <button className="btn-icon" title="Show in Explorer" onClick={(e) => { e.stopPropagation(); reveal(String(v)) }}><Icon name="folder" size={15} /></button>
        </div>
      ) : (
        <span style={{ color: 'var(--text-dim)' }}>No path set</span>
      )
  }

  const columns: Column[] = [
    { key: 'title', label: 'Title' },
    ...(withDate ? [{ key: 'date', label: 'Date', width: '120px' } as Column] : []),
    pathColumn,
    { key: 'notes', label: 'Notes', width: '220px' }
  ]

  const fields: FieldDef[] = [
    { key: 'title', label: 'Title', required: true },
    ...(withDate ? [{ key: 'date', label: 'Date', type: 'date' } as FieldDef] : []),
    { key: 'path', label: 'File / Folder Path', type: 'path' },
    { key: 'notes', label: 'Notes', type: 'textarea' }
  ]

  return (
    <CrudTab
      type={type} singular={singular} projectId={projectId} projectName={projectName}
      columns={columns} fields={fields} onToast={onToast}
      emptyHint={hint}
    />
  )
}
