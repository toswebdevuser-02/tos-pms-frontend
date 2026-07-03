import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Member } from '../types'
import Icon from './Icon'

interface Props {
  projectId: number
  projectName: string
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error') => void
}

export default function ProjectMembersModal({ projectId, projectName, onClose, onToast }: Props) {
  const { members, isAdmin } = useApp()
  const [assigned, setAssigned] = useState<number[]>([])

  const load = useCallback(async () => {
    const res = await window.api.projectMembers.get(projectId)
    if (res.ok) setAssigned((res.data as Member[]).map((m) => m.id))
  }, [projectId])

  useEffect(() => { load() }, [load])

  // Active members + any departed member still assigned (so they can be removed).
  const selectable = members.filter((m) => m.status !== 'left' || assigned.includes(m.id))

  const toggle = async (m: Member) => {
    if (!isAdmin) { onToast('Only admins can change project members', 'error'); return }
    if (assigned.includes(m.id)) {
      await window.api.projectMembers.unassign(projectId, m.id)
      onToast(`${m.name} removed from project`)
    } else {
      await window.api.projectMembers.assign(projectId, m.id)
      onToast(`${m.name} added to project`)
    }
    load()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Members on “{projectName}”</h3>
          <button className="btn-icon" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          {members.length === 0 ? (
            <div className="attach-empty">No members in the directory yet. Add team members first.</div>
          ) : (
            <div className="assign-list">
              {selectable.map((m) => (
                <label key={m.id} className={`assign-row${m.status === 'left' ? ' row-left' : ''}`}>
                  <input
                    type="checkbox"
                    checked={assigned.includes(m.id)}
                    onChange={() => toggle(m)}
                    disabled={!isAdmin}
                  />
                  <span className="assign-name">{m.name}{m.status === 'left' && ' (departed)'}</span>
                  <span className={`badge ${m.role === 'Admin' ? 'badge-design' : 'badge-not-started'}`}>{m.role}</span>
                  {m.email && <span className="assign-email">{m.email}</span>}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
