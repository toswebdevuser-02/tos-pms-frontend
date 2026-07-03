import { ImageStats, level } from '../lib/imageStatus'

export default function ResponseCell({ stats }: { stats?: ImageStats }) {
  if (!stats || stats.pct === null) {
    return <span style={{ color: 'var(--text-dim)' }}>No images</span>
  }
  const lv = level(stats.pct)
  return (
    <div className="resp-cell">
      <div className="resp-cell-bar">
        <div className={`resp-cell-fill resp-${lv}`} style={{ width: `${stats.pct}%` }} />
      </div>
      <span className="resp-cell-label">{stats.responded}/{stats.total} · {stats.pct}%</span>
    </div>
  )
}
