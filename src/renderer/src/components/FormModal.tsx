import { useState, useEffect } from 'react'
import AttachmentManager from './AttachmentManager'
import Icon from './Icon'

export interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'date' | 'select' | 'textarea' | 'number' | 'path'
  options?: string[]
  required?: boolean
  adminOnly?: boolean
  optionValues?: { label: string; value: string }[]
}

interface Props {
  title: string
  fields: FieldDef[]
  initial?: Record<string, unknown>
  onSubmit: (data: Record<string, string>) => void
  onClose: () => void
  isAdmin?: boolean
  attachmentsEntity?: { type: string; id: number | null }
  onToast?: (msg: string, type?: 'success' | 'error') => void
}

export default function FormModal({
  title, fields, initial, onSubmit, onClose, isAdmin = true, attachmentsEntity, onToast
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    fields.forEach((f) => {
      const def = f.optionValues ? f.optionValues[0].value : f.options ? f.options[0] : ''
      init[f.key] = initial ? String(initial[f.key] ?? def) : def
    })
    return init
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(values)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {fields.map((f) => {
              const disabled = f.adminOnly && !isAdmin
              return (
                <div className="field" key={f.key}>
                  <label>
                    {f.label}{f.required && ' *'}
                    {f.adminOnly && <span className="admin-tag">admin</span>}
                  </label>
                  {f.type === 'path' ? (
                    <div className="path-field">
                      <input
                        type="text"
                        value={values[f.key]}
                        onChange={(e) => set(f.key, e.target.value)}
                        placeholder="Type a path or browse…"
                        disabled={disabled}
                      />
                      <button
                        type="button" className="btn btn-secondary btn-sm" disabled={disabled}
                        onClick={async () => { const r = await window.api.paths.pick('file'); if (r.ok && r.data?.path) set(f.key, r.data.path) }}
                      ><Icon name="file" size={14} /> File</button>
                      <button
                        type="button" className="btn btn-secondary btn-sm" disabled={disabled}
                        onClick={async () => { const r = await window.api.paths.pick('folder'); if (r.ok && r.data?.path) set(f.key, r.data.path) }}
                      ><Icon name="folder" size={14} /> Folder</button>
                    </div>
                  ) : f.type === 'select' ? (
                    <select value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} disabled={disabled}>
                      {f.optionValues
                        ? f.optionValues.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
                        : f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} disabled={disabled} />
                  ) : (
                    <input
                      type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                      step={f.type === 'number' ? '0.5' : undefined}
                      min={f.type === 'number' ? '0' : undefined}
                      value={values[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                      required={f.required}
                      disabled={disabled}
                    />
                  )}
                </div>
              )
            })}

            {attachmentsEntity && (
              <AttachmentManager
                entityType={attachmentsEntity.type}
                entityId={attachmentsEntity.id}
                onToast={onToast}
              />
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}
