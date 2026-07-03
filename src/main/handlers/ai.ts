import { ipcMain } from 'electron'
import { exec } from 'child_process'

/**
 * Local AI skill matching via the ruflo CLI (ONNX embeddings, fully offline).
 * For each candidate we compare the project's required-skills text against the
 * candidate's skill profile and read the cosine similarity. If ruflo isn't
 * available, we fall back to transparent lexical (token-overlap) scoring.
 */

// Cosine-ish lexical similarity as a fallback (no external calls).
function lexical(a: string, b: string): number {
  const tok = (s: string): Set<string> =>
    new Set(s.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1))
  const A = tok(a), B = tok(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / Math.sqrt(A.size * B.size)
}

function rufloCompare(t1: string, t2: string): Promise<number | null> {
  return new Promise((resolve) => {
    const esc = (s: string): string => '"' + s.replace(/["\r\n]/g, ' ').slice(0, 400) + '"'
    exec(
      `ruflo embeddings compare --text1 ${esc(t1)} --text2 ${esc(t2)}`,
      { timeout: 25000, windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (err) { resolve(null); return }
        const m = /Similarity:\s*(-?[0-9.]+)/.exec(stdout)
        resolve(m ? parseFloat(m[1]) : null)
      }
    )
  })
}

export function registerAiHandlers(): void {
  ipcMain.handle('ai:skillFit', async (_e, { requiredText, candidates }: { requiredText: string; candidates: { id: number; text: string }[] }) => {
    try {
      let method: 'ruflo' | 'lexical' = 'ruflo'
      const results = await Promise.all(
        candidates.map(async (c) => {
          if (!c.text.trim()) return { id: c.id, score: 0 }
          let sim = await rufloCompare(requiredText, c.text)
          if (sim == null) { method = 'lexical'; sim = lexical(requiredText, c.text) }
          return { id: c.id, score: Math.max(0, Math.min(1, sim)) }
        })
      )
      return { ok: true, data: { results, method } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}
