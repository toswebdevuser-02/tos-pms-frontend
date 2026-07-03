import { avatarColor } from '../orgData'

interface Props {
  name: string
  size?: number
}

// Colored initials avatar, consistent across Members, Skills, Performance, etc.
export default function Avatar({ name, size = 30 }: Props) {
  const initials =
    name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: avatarColor(name || '?'), fontSize: Math.round(size * 0.4) }}
      title={name}
    >
      {initials}
    </span>
  )
}
