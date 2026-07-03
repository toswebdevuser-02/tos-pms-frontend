import CrudTab from '../components/CrudTab'
import { Column } from '../components/DataTable'
import { FieldDef } from '../components/FormModal'

const COLUMNS: Column[] = [
  { key: 'dispatch_number', label: 'Dispatch #', width: '100px' },
  { key: 'description', label: 'Description' },
  { key: 'recipient', label: 'Recipient', width: '140px' },
  { key: 'dispatch_date', label: 'Dispatch Date', width: '120px' },
  { key: 'status', label: 'Status', width: '120px' }
]

const FIELDS: FieldDef[] = [
  { key: 'dispatch_number', label: 'Dispatch Number', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'recipient', label: 'Recipient' },
  { key: 'dispatch_date', label: 'Dispatch Date', type: 'date', adminOnly: true },
  { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Sent', 'Acknowledged'] }
]

interface Props {
  projectId: number
  projectName: string
  onToast: (msg: string, type?: 'success' | 'error') => void
}

export default function DispatchTab({ projectId, projectName, onToast }: Props) {
  return (
    <CrudTab
      type="dispatch" singular="Dispatch" projectId={projectId} projectName={projectName}
      columns={COLUMNS} fields={FIELDS} adminOnlyAdd onToast={onToast}
      emptyHint="No dispatches yet. Admins define dispatch dates."
    />
  )
}
