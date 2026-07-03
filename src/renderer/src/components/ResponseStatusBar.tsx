interface Props {
  total: number
  responded: number
  noun: string // e.g. "RFI", "query"
}

export default function ResponseStatusBar({ total, responded, noun }: Props) {
  if (total === 0) return null

  const pct = Math.round((responded / total) * 100)
  const level = responded === total ? 'green' : responded === 0 ? 'red' : 'yellow'
  const label =
    level === 'green'
      ? `All responses received — ${total} ${noun}${total !== 1 ? 's' : ''} closed`
      : level === 'red'
      ? `Awaiting responses — 0 of ${total} ${noun}${total !== 1 ? 's' : ''} answered`
      : `Partial responses — ${responded} of ${total} ${noun}${total !== 1 ? 's' : ''} answered`

  return (
    <div className={`resp-bar resp-${level}`}>
      <div className="resp-bar-head">
        <span className="resp-dot" />
        <span className="resp-label">{label}</span>
        <span className="resp-pct">{pct}%</span>
      </div>
      <div className="resp-track"><div className="resp-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
