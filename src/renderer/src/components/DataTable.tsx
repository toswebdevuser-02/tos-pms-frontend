import React, { useState, useMemo } from 'react'

export interface Column {
  key: string
  label: string
  width?: string
  render?: (val: unknown, row: Record<string, unknown>) => React.ReactNode
}

interface Props {
  columns: Column[]
  rows: Record<string, unknown>[]
  onEdit: (row: Record<string, unknown>) => void
  onDelete: (row: Record<string, unknown>) => void
  emptyHint?: string
  canEdit?: (row: Record<string, unknown>) => boolean
  canDelete?: (row: Record<string, unknown>) => boolean
  editLabel?: string
}

function statusBadge(val: string): React.ReactNode {
  if (!val) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  const key = val.toLowerCase().replace(/\s+/g, '-')
  return <span className={`badge badge-${key}`}>{val}</span>
}

const STATUS_KEYS = new Set(['status', 'result', 'overall'])

const EditIcon = (): React.ReactNode => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
  </svg>
)

const DeleteIcon = (): React.ReactNode => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)

export default function DataTable({ columns, rows, onEdit, onDelete, emptyHint, canEdit, canDelete, editLabel }: Props) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = String(a[sortKey] ?? '').toLowerCase()
      const bv = String(b[sortKey] ?? '').toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [rows, sortKey, sortDir])

  const toggleSort = (key: string): void => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  if (!rows.length) {
    return (
      <div className="empty-table">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
        <p>{emptyHint || 'No records yet. Click “Add” to create one.'}</p>
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className="sortable"
                onClick={() => toggleSort(c.key)}
              >
                <span className="th-inner">
                  {c.label}
                  <span className={`sort-arrow${sortKey === c.key ? ' active' : ''}`}>
                    {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                  </span>
                </span>
              </th>
            ))}
            <th style={{ width: 90 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const by = String(row.updated_by ?? row.created_by ?? '')
            const at = String(row.updated_at ?? row.created_at ?? '').slice(0, 16).replace('T', ' ')
            const audit = by || at ? `Last edited${by ? ` by ${by}` : ''}${at ? ` · ${at}` : ''}` : undefined
            return (
            <tr key={row.id as number} title={audit}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render
                    ? c.render(row[c.key], row)
                    : STATUS_KEYS.has(c.key)
                    ? statusBadge(String(row[c.key] ?? ''))
                    : String(row[c.key] ?? '') || <span style={{ color: 'var(--text-dim)' }}>—</span>}
                </td>
              ))}
              <td>
                <div className="td-actions">
                  {(!canEdit || canEdit(row)) && (
                    <button className="btn-icon" title={editLabel || 'Edit'} onClick={() => onEdit(row)}>
                      <EditIcon />
                    </button>
                  )}
                  {(!canDelete || canDelete(row)) && (
                    <button className="btn-icon danger" title="Delete" onClick={() => onDelete(row)}>
                      <DeleteIcon />
                    </button>
                  )}
                  {canEdit && !canEdit(row) && (!canDelete || !canDelete(row)) && (
                    <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>—</span>
                  )}
                </div>
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
