import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import fs from 'fs'

export function registerPathHandlers(): void {
  // Let the user browse for a file or folder; returns the chosen absolute path.
  ipcMain.handle('paths:pick', async (_e, { mode }: { mode: 'file' | 'folder' }) => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      const res = await dialog.showOpenDialog(win!, {
        title: mode === 'folder' ? 'Select a folder' : 'Select a file',
        properties: [mode === 'folder' ? 'openDirectory' : 'openFile']
      })
      if (res.canceled || !res.filePaths.length) return { ok: true, data: { path: null } }
      return { ok: true, data: { path: res.filePaths[0] } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  // Open a stored path (file or folder) in the OS default handler / Explorer.
  ipcMain.handle('paths:open', async (_e, { path: p }: { path: string }) => {
    try {
      if (!p) return { ok: false, error: 'No path set' }
      if (!fs.existsSync(p)) return { ok: false, error: 'Path not found (it may have moved or the drive is offline)' }
      const err = await shell.openPath(p)
      if (err) return { ok: false, error: err }
      return { ok: true, data: {} }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  // Reveal a path in Explorer (select the file/folder).
  ipcMain.handle('paths:reveal', async (_e, { path: p }: { path: string }) => {
    try {
      if (!p || !fs.existsSync(p)) return { ok: false, error: 'Path not found' }
      shell.showItemInFolder(p)
      return { ok: true, data: {} }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}
