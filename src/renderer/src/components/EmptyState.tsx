import Icon, { IconName } from './Icon'

interface Props {
  icon?: IconName
  title: string
  hint?: string
  action?: React.ReactNode
}

// Friendly, consistent empty state for screens with no data yet.
export default function EmptyState({ icon = 'grid', title, hint, action }: Props): React.JSX.Element {
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon name={icon} size={40} strokeWidth={1.6} /></div>
      <div className="empty-state-title">{title}</div>
      {hint && <div className="empty-state-hint">{hint}</div>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}
