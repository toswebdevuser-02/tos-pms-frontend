// Lightweight shimmer placeholders shown while a tab's data loads, so panels
// reserve their space instead of popping in. Themed via CSS (.skeleton).

export function Skeleton({ w, h = 14, r = 6, style }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties }) {
  return <span className="skeleton" style={{ width: w ?? '100%', height: h, borderRadius: r, ...style }} aria-hidden />
}

/** KPI grid + chart grid skeleton matching the per-project Dashboard layout. */
export function DashboardSkeleton() {
  return (
    <div className="dashboard" aria-busy="true" aria-label="Loading overview">
      <div className="kpi-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="kpi-card" key={i}>
            <Skeleton w={44} h={44} r={12} style={{ flexShrink: 0 }} />
            <div className="kpi-body" style={{ width: '100%' }}>
              <Skeleton w="50%" h={20} />
              <Skeleton w="70%" h={11} style={{ marginTop: 8 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="chart-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="chart-card" key={i}>
            <Skeleton w="40%" h={11} />
            <Skeleton h={140} r={10} style={{ marginTop: 16 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default Skeleton
