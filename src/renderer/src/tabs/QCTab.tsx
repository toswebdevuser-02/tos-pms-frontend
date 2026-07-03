import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import FormModal, { FieldDef } from '../components/FormModal'
import Donut from '../components/charts/Donut'
import Icon from '../components/Icon'
import { Attachment } from '../types'
import { useApp } from '../context/AppContext'

interface Props {
  projectId: number
  projectName: string
  onToast: (msg: string, type?: 'success' | 'error') => void
}

type QcRow = Record<string, unknown>
const COLORS = { green: '#22c55e', red: '#ef4444', amber: '#f59e0b' }

// Each QC entry is ONE dated image with its own description + result.
const FIELDS: FieldDef[] = [
  { key: 'inspection_date', label: 'QC Date (folder)', type: 'date', required: true, adminOnly: true },
  { key: 'checklist_item', label: 'Title / Area', adminOnly: true },
  { key: 'description', label: 'Mistake / Observation', type: 'textarea', adminOnly: true },
  { key: 'inspector', label: 'Inspector', adminOnly: true },
  { key: 'result', label: 'Result (status)', type: 'select', options: ['Pending', 'Pass', 'Fail'] }
]

function resultBadge(v: string): ReactNode {
  const key = (v || 'pending').toLowerCase()
  return <span className={`badge badge-${key}`}>{v || 'Pending'}</span>
}

function QCCard({
  qc, isAdmin, onEdit, onDelete, onToast
}: {
  qc: QcRow
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  onToast: Props['onToast']
}) {
  const [att, setAtt] = useState<Attachment | null>(null)
  const [url, setUrl] = useState('')

  const loadImage = useCallback(async () => {
    const res = await window.api.attachments.get('qc', qc.id as number)
    const list = res.ok ? (res.data as Attachment[]) : []
    const first = list[0] ?? null
    setAtt(first)
    if (first) {
      const r = await window.api.attachments.read(first.stored_path)
      if (r.ok && r.data) setUrl(r.data.dataUrl)
    } else setUrl('')
  }, [qc.id])

  useEffect(() => { loadImage() }, [loadImage])

  const addImage = async (): Promise<void> => {
    const res = await window.api.attachments.add('qc', qc.id as number, false) // single image
    if (res.ok && (res.data as Attachment[]).length) { onToast('Image added'); loadImage() }
  }
  const removeImage = async (): Promise<void> => {
    if (!att) return
    await window.api.attachments.delete(att.id)
    onToast('Image removed')
    loadImage()
  }

  return (
    <div className="qc-card">
      <div className="qc-card-img">
        {url ? (
          <img src={url} alt="" onClick={() => att && window.api.attachments.open(att.stored_path)} />
        ) : isAdmin ? (
          <button className="qc-add-img" onClick={addImage}>+ Add image</button>
        ) : (
          <div className="qc-no-img">No image</div>
        )}
        {att && isAdmin && <button className="thumb-del" title="Remove image" onClick={removeImage}><Icon name="close" size={14} /></button>}
      </div>
      <div className="qc-card-body">
        <div className="qc-card-top">
          {resultBadge(String(qc.result ?? ''))}
          <div className="td-actions">
            <button className="btn-icon" title={isAdmin ? 'Edit' : 'Update status'} onClick={onEdit}>✎</button>
            {isAdmin && <button className="btn-icon danger" title="Delete" onClick={onDelete}>🗑</button>}
          </div>
        </div>
        {!!qc.checklist_item && <div className="qc-card-title">{String(qc.checklist_item)}</div>}
        <div className="qc-card-desc">{String(qc.description || '') || <span style={{ color: 'var(--text-dim)' }}>No description</span>}</div>
        {!!qc.inspector && <div className="qc-card-meta">Inspector: {String(qc.inspector)}</div>}
      </div>
    </div>
  )
}

export default function QCTab({ projectId, projectName, onToast }: Props) {
  const { isAdmin } = useApp()
  const [items, setItems] = useState<QcRow[]>([])
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; row?: QcRow } | null>(null)

  const load = useCallback(async () => {
    const res = await window.api.items.getByProject(projectId, 'qc')
    if (res.ok) setItems(res.data as QcRow[])
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (data: Record<string, string>): Promise<void> => {
    if (modal?.mode === 'edit' && modal.row) {
      await window.api.items.update('qc', { id: modal.row.id, project_id: projectId, ...data })
      onToast('QC updated')
      setModal(null)
      load()
    } else {
      const res = await window.api.items.create('qc', { project_id: projectId, ...data })
      onToast('QC entry added')
      setModal(null)
      // immediately attach a single image for this dated entry
      if (res.ok && res.data?.id) await window.api.attachments.add('qc', res.data.id, false)
      load()
    }
  }

  const handleDelete = async (row: QcRow): Promise<void> => {
    if (!confirm('Delete this QC entry and its image?')) return
    await window.api.items.delete('qc', row.id as number)
    onToast('QC entry deleted')
    load()
  }

  const handleExport = async (): Promise<void> => {
    if (!items.length) { onToast('No data to export', 'error'); return }
    const res = await window.api.excel.export('qc', projectName, items)
    if (res.ok && res.data?.filePath) onToast(`Exported to ${res.data.filePath}`)
    else if (res.ok) onToast('Export cancelled')
    else onToast(res.error ?? 'Export failed', 'error')
  }

  // pie of Pass vs Fail (vs Pending)
  const pass = items.filter((r) => r.result === 'Pass').length
  const fail = items.filter((r) => r.result === 'Fail').length
  const pending = items.filter((r) => r.result !== 'Pass' && r.result !== 'Fail').length
  const decided = pass + fail
  const passRate = decided ? Math.round((pass / decided) * 100) : 0

  // group entries into date folders (newest first)
  const groups = useMemo(() => {
    const m = new Map<string, QcRow[]>()
    for (const it of items) {
      const d = String(it.inspection_date || 'Undated')
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(it)
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [items])

  return (
    <div className="tab-content">
      <div className="tab-toolbar">
        <div className="tab-toolbar-left">
          {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setModal({ mode: 'add' })}>+ Add QC Image</button>}
        </div>
        <div className="tab-toolbar-right">
          <button className="btn btn-secondary btn-sm" onClick={handleExport}><Icon name="download" size={15} /> Export Excel</button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="qc-pie">
          <Donut
            size={150}
            segments={[
              { label: 'Pass', value: pass, color: COLORS.green },
              { label: 'Fail', value: fail, color: COLORS.red },
              { label: 'Pending', value: pending, color: COLORS.amber }
            ]}
            centerLabel={decided ? `${passRate}%` : '—'}
            centerSub="pass rate"
          />
          <div className="qc-pie-legend">
            <div className="qc-legend-row"><span className="legdot" style={{ background: COLORS.green }} /> Pass <strong>{pass}</strong></div>
            <div className="qc-legend-row"><span className="legdot" style={{ background: COLORS.red }} /> Fail <strong>{fail}</strong></div>
            <div className="qc-legend-row"><span className="legdot" style={{ background: COLORS.amber }} /> Pending <strong>{pending}</strong></div>
          </div>
        </div>
      )}

      <div className="qc-gallery">
        {items.length === 0 ? (
          <div className="empty-table">
            <p>No QC images yet. {isAdmin ? 'Add a dated QC image with its description and result.' : 'Members can update the pass/fail status once admins add QC images.'}</p>
          </div>
        ) : (
          groups.map(([date, rows]) => (
            <div key={date} className="qc-folder">
              <div className="qc-folder-head"><Icon name="folder" size={15} /> {date} <span className="qc-folder-count">{rows.length} image{rows.length !== 1 ? 's' : ''}</span></div>
              <div className="qc-grid">
                {rows.map((qc) => (
                  <QCCard
                    key={qc.id as number}
                    qc={qc}
                    isAdmin={isAdmin}
                    onEdit={() => setModal({ mode: 'edit', row: qc })}
                    onDelete={() => handleDelete(qc)}
                    onToast={onToast}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <FormModal
          title={modal.mode === 'add' ? 'Add QC Image' : 'Edit QC Entry'}
          fields={FIELDS}
          initial={modal.row}
          isAdmin={isAdmin}
          onSubmit={handleSubmit}
          onClose={() => setModal(null)}
          onToast={onToast}
        />
      )}
    </div>
  )
}
