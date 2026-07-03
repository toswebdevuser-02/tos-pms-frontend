import { useState, useEffect, useCallback } from 'react'
import { Attachment } from '../types'
import Icon from './Icon'

interface Props {
  entityType: string
  entityId: number | null
  onToast?: (msg: string, type?: 'success' | 'error') => void
}

function Thumb({ att, onOpen, onDelete, onChange }: { att: Attachment; onOpen: () => void; onDelete: () => void; onChange?: () => void }) {
  const [url, setUrl] = useState<string>('')
  const [desc, setDesc] = useState<string>(att.description ?? '')
  const [response, setResponse] = useState<string>(att.response ?? '')
  const [importance, setImportance] = useState<string>(att.importance ?? 'Medium')

  useEffect(() => {
    let alive = true
    window.api.attachments.read(att.stored_path).then((res) => {
      if (alive && res.ok && res.data) setUrl(res.data.dataUrl)
    })
    return () => { alive = false }
  }, [att.stored_path])

  const save = async (patch: Record<string, unknown>): Promise<void> => {
    await window.api.attachments.update(att.id, patch)
    onChange?.()
  }

  const responded = !!response.trim()

  return (
    <div className={`thumb${responded ? ' responded' : ''}`}>
      {url ? <img src={url} alt={att.filename} onClick={onOpen} /> : <div className="thumb-loading" />}
      <button className="thumb-del" title="Remove" onClick={onDelete}><Icon name="close" size={13} /></button>
      <div className="thumb-row">
        <span className="thumb-name" title={att.filename}>{att.filename}</span>
        <span className={`resp-tag ${responded ? 'yes' : 'no'}`}>{responded ? '✓ answered' : 'awaiting'}</span>
      </div>
      <div className="thumb-imp">
        <label>Importance</label>
        <select value={importance} onChange={(e) => { setImportance(e.target.value); save({ importance: e.target.value }) }}>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
      <textarea
        className="thumb-desc"
        placeholder="Query / description…"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => desc !== (att.description ?? '') && save({ description: desc })}
        rows={2}
      />
      <textarea
        className="thumb-resp"
        placeholder="Response…"
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        onBlur={() => response !== (att.response ?? '') && save({ response })}
        rows={2}
      />
    </div>
  )
}

export default function AttachmentManager({ entityType, entityId, onToast }: Props) {
  const [items, setItems] = useState<Attachment[]>([])

  const load = useCallback(async () => {
    if (!entityId) { setItems([]); return }
    const res = await window.api.attachments.get(entityType, entityId)
    if (res.ok) setItems(res.data as Attachment[])
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  if (!entityId) {
    return <div className="attach-hint">Save this record first, then re-open it to attach images.</div>
  }

  const handleAdd = async () => {
    const res = await window.api.attachments.add(entityType, entityId)
    if (res.ok) { if ((res.data as Attachment[]).length) onToast?.('Image(s) added'); load() }
    else onToast?.(res.error ?? 'Failed to add', 'error')
  }

  const handleDelete = async (id: number) => {
    await window.api.attachments.delete(id)
    onToast?.('Image removed')
    load()
  }

  return (
    <div className="attach-wrap">
      <div className="attach-head">
        <span>Images ({items.length})</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleAdd}>+ Add images</button>
      </div>
      {items.length === 0 ? (
        <div className="attach-empty">No images yet.</div>
      ) : (
        <div className="thumb-grid">
          {items.map((a) => (
            <Thumb
              key={a.id}
              att={a}
              onOpen={() => window.api.attachments.open(a.stored_path)}
              onDelete={() => handleDelete(a.id)}
              onChange={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
