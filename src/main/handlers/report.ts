import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'

/**
 * Render an HTML document to PDF via an offscreen BrowserWindow and save it
 * where the user chooses. The renderer composes the styled HTML; we just print.
 */
export function registerReportHandlers(): void {
  ipcMain.handle('report:pdf', async (_e, { html, fileName }: { html: string; fileName: string }) => {
    let win: BrowserWindow | null = null
    let tmp = ''
    try {
      const parent = BrowserWindow.getFocusedWindow()
      const safe = (fileName || 'report').replace(/[^a-z0-9_\- ]/gi, '_')
      const { canceled, filePath } = await dialog.showSaveDialog(parent!, {
        title: 'Save status report',
        defaultPath: `${safe}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (canceled || !filePath) return { ok: true, data: { filePath: null } }

      tmp = path.join(os.tmpdir(), `pt-report-${Date.now()}.html`)
      fs.writeFileSync(tmp, html, 'utf8')

      win = new BrowserWindow({ show: false, webPreferences: { offscreen: false } })
      await win.loadFile(tmp)
      const pdf = await win.webContents.printToPDF({ printBackground: true, margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }, pageSize: 'A4' })
      fs.writeFileSync(filePath, pdf)
      return { ok: true, data: { filePath } }
    } catch (e) {
      return { ok: false, error: String(e) }
    } finally {
      if (win) win.destroy()
      if (tmp) { try { fs.unlinkSync(tmp) } catch { /* ignore */ } }
    }
  })
}
