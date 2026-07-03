import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import { config } from '../config'
import { invalidateCache } from '../database'

// Local-store backup & restore. Operates on the JSON data file directly so the
// whole dataset is captured in one portable file. (Remote/server mode should use
// the CSV "Export all data" + Postgres pg_dump for backups.)
export function registerBackupHandlers(): void {
  ipcMain.handle('backup:create', async () => {
    try {
      if (config.storageMode === 'remote') {
        return { ok: false, error: 'Backup file is for local mode. In server mode use "Export all data (CSV)" + database pg_dump.' }
      }
      const src = config.dataFilePath()
      if (!fs.existsSync(src)) return { ok: false, error: 'No local data file found yet.' }
      const win = BrowserWindow.getFocusedWindow()
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const { canceled, filePath } = await dialog.showSaveDialog(win!, {
        title: 'Save full backup',
        defaultPath: `project-tracker-backup-${stamp}.json`,
        filters: [{ name: 'Backup (JSON)', extensions: ['json'] }]
      })
      if (canceled || !filePath) return { ok: true, data: { filePath: null } }
      fs.copyFileSync(src, filePath)
      return { ok: true, data: { filePath } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('backup:restore', async () => {
    try {
      if (config.storageMode === 'remote') {
        return { ok: false, error: 'Restore is available in local mode only.' }
      }
      const win = BrowserWindow.getFocusedWindow()
      const res = await dialog.showOpenDialog(win!, {
        title: 'Restore from backup',
        properties: ['openFile'],
        filters: [{ name: 'Backup (JSON)', extensions: ['json'] }]
      })
      if (res.canceled || !res.filePaths.length) return { ok: true, data: { restored: false } }

      const text = fs.readFileSync(res.filePaths[0], 'utf8')
      let parsed: unknown
      try { parsed = JSON.parse(text) } catch { return { ok: false, error: 'File is not valid JSON.' } }
      if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Record<string, unknown>).projects)) {
        return { ok: false, error: 'This does not look like a Project Tracker backup.' }
      }

      // Safety: snapshot the current file before overwriting.
      const dest = config.dataFilePath()
      if (fs.existsSync(dest)) fs.copyFileSync(dest, `${dest}.pre-restore`)
      fs.writeFileSync(dest, JSON.stringify(parsed, null, 2), 'utf8')
      invalidateCache()

      // Reload the renderer so every view re-fetches the restored data.
      setTimeout(() => win?.reload(), 300)
      return { ok: true, data: { restored: true } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}
