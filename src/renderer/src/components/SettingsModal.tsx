import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Icon from './Icon'

interface Props {
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error') => void
}

export default function SettingsModal({ onClose, onToast }: Props) {
  const { settings, refreshSettings } = useApp()
  const smtp = settings?.smtp
  const [host, setHost] = useState(smtp?.host ?? '')
  const [port, setPort] = useState(String(smtp?.port ?? 587))
  const [secure, setSecure] = useState(smtp?.secure ?? false)
  const [user, setUser] = useState(smtp?.user ?? '')
  const [pass, setPass] = useState(smtp?.pass ?? '')
  const [from, setFrom] = useState(smtp?.from ?? '')
  const [testing, setTesting] = useState(false)

  const save = async () => {
    await window.api.settings.update({
      smtp: { host, port: parseInt(port) || 587, secure, user, pass, from }
    })
    await refreshSettings()
    onToast('Email settings saved')
  }

  const test = async () => {
    setTesting(true)
    await save()
    const res = await window.api.email.test()
    setTesting(false)
    if (res.ok) onToast('SMTP connection verified ✓')
    else onToast(res.error ?? 'SMTP test failed', 'error')
  }

  const backupNow = async () => {
    const res = await window.api.backup.create()
    if (res.ok && res.data?.filePath) onToast('Backup saved ✓')
    else if (res.ok) onToast('Backup cancelled')
    else onToast(res.error ?? 'Backup failed', 'error')
  }
  const restore = async () => {
    if (!confirm('Restore will REPLACE all current data with the contents of the backup file. A safety copy of the current data is kept. Continue?')) return
    const res = await window.api.backup.restore()
    if (res.ok && res.data?.restored) onToast('Restored — reloading…')
    else if (res.ok) onToast('Restore cancelled')
    else onToast(res.error ?? 'Restore failed', 'error')
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3><Icon name="settings" size={18} /> Settings</h3>
          <button className="btn-icon" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="attach-hint">
            Used to email reminders to members. For Gmail, use an App Password and host
            <code> smtp.gmail.com</code> port <code>465</code> (secure) or <code>587</code>.
          </p>
          <div className="field"><label>SMTP Host</label>
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.gmail.com" /></div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}><label>Port</label>
              <input value={port} onChange={(e) => setPort(e.target.value)} /></div>
            <div className="field" style={{ flex: 1, justifyContent: 'flex-end' }}>
              <label>Secure (SSL)</label>
              <select value={secure ? 'yes' : 'no'} onChange={(e) => setSecure(e.target.value === 'yes')}>
                <option value="no">No (STARTTLS / 587)</option>
                <option value="yes">Yes (SSL / 465)</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Username</label>
            <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="you@company.com" /></div>
          <div className="field"><label>Password / App Password</label>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></div>
          <div className="field"><label>From Address</label>
            <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="TOS Tracker <you@company.com>" /></div>

          <div className="settings-section">
            <h4>Data &amp; Backup</h4>
            <p className="attach-hint">Save a full snapshot of all data to a file, or restore from one. Restore replaces current data (a safety copy is kept automatically).</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={backupNow}><Icon name="download" size={15} /> Backup now</button>
              <button className="btn btn-secondary" onClick={restore}>⬆ Restore from backup…</button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary" onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Save & Test'}</button>
          <button className="btn btn-primary" onClick={async () => { await save(); onClose() }}>Save</button>
        </div>
      </div>
    </div>
  )
}
