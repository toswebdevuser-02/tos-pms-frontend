import { useEffect, useRef, useState } from 'react'

/**
 * Animates every numeric token inside a metric value on mount / when it changes.
 * Works for plain numbers and composite strings like "5/12", "85%", "120.5h",
 * "3 / —". Non-numeric segments (slashes, %, units, em-dashes) are preserved.
 */
export default function CountUp({ value, ms = 700 }: { value: string | number; ms?: number }): React.JSX.Element {
  const text = String(value)
  const [out, setOut] = useState(text)
  const raf = useRef(0)

  useEffect(() => {
    const parts = text.split(/(-?\d+(?:\.\d+)?)/)
    const isNum = (s: string): boolean => /^-?\d+(?:\.\d+)?$/.test(s)
    const targets = parts.filter(isNum).map(parseFloat)
    if (!targets.length) { setOut(text); return }
    const decimals = parts.filter(isNum).map((s) => (s.includes('.') ? s.split('.')[1].length : 0))

    const start = performance.now()
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      let i = 0
      setOut(parts.map((seg) => (isNum(seg) ? (targets[i] * eased).toFixed(decimals[i++]) : seg)).join(''))
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else setOut(text)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [text, ms])

  return <span className="tabular-nums">{out}</span>
}
