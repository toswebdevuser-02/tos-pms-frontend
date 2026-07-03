import { useEffect } from 'react'
import { ToastAction } from '../types'

interface Props {
  message: string
  type?: 'success' | 'error'
  action?: ToastAction
  onClose: () => void
}

export default function Toast({ message, type = 'success', action, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, action ? 6000 : 3000)
    return () => clearTimeout(t)
  }, [onClose, action])

  return (
    <div className={`toast ${type}`}>
      <span>{message}</span>
      {action && (
        <button className="toast-action" onClick={() => { action.onClick(); onClose() }}>{action.label}</button>
      )}
    </div>
  )
}
