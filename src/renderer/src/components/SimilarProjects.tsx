import { useState, useEffect } from 'react'
import { Project } from '../types'
import { DisciplineIcon } from './Icon'

interface Props {
  projectId: number
  onOpen?: (projectId: number) => void
}

interface Ranked { p: Project; score: number }

const textOf = (p: Project): string =>
  [p.name, p.client, p.location, p.discipline].filter(Boolean).join(' · ')

// "Similar past projects" via ruflo embeddings (local). Falls back to lexical
// scoring inside ai.skillFit when ruflo isn't available.
export default function SimilarProjects({ projectId, onOpen }: Props) {
  const [ranked, setRanked] = useState<Ranked[] | null>(null)
  const [method, setMethod] = useState<'ruflo' | 'lexical' | ''>('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const res = await window.api.projects.getAll()
      if (!res.ok) { if (alive) setRanked([]); return }
      const all = res.data as Project[]
      const target = all.find((p) => p.id === projectId)
      const others = all.filter((p) => p.id !== projectId && !p.archived)
      if (!target || others.length === 0) { if (alive) setRanked([]); return }
      const out = await window.api.ai.skillFit(textOf(target), others.map((p) => ({ id: p.id, text: textOf(p) })))
      if (!alive) return
      if (out.ok && out.data) {
        const byId = new Map(others.map((p) => [p.id, p]))
        const rows = out.data.results
          .map((r) => ({ p: byId.get(r.id)!, score: r.score }))
          .filter((r) => r.p)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
        setRanked(rows); setMethod(out.data.method)
      } else setRanked([])
    })()
    return () => { alive = false }
  }, [projectId])

  if (ranked === null) return <div className="chart-card"><h4>Similar projects</h4><div className="chart-empty">Analysing…</div></div>
  if (ranked.length === 0) return null

  return (
    <div className="chart-card">
      <h4>Similar projects {method && <span className="sim-method">{method === 'ruflo' ? '· AI' : '· lexical'}</span>}</h4>
      <div className="sim-list">
        {ranked.map(({ p, score }) => (
          <div key={p.id} className={`sim-row${onOpen ? ' clickable' : ''}`} onClick={() => onOpen?.(p.id)}>
            <span className="sim-icon"><DisciplineIcon discipline={p.discipline} size={16} /></span>
            <span className="sim-name">{p.name}{p.client ? <span className="sim-client"> · {p.client}</span> : null}</span>
            <span className="sim-bar"><span className="sim-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%` }} /></span>
            <span className="sim-score">{Math.round(Math.max(0, Math.min(1, score)) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
