import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { attachmentsGet, attachmentAdd, attachmentDelete, attachmentUpdateDescription, attachmentUpdate, attachmentsGetMany } from '../dataLayer'
import { config } from '../config'
import * as remote from '../remoteClient'

function attachmentsDir(): string {
  const dir = path.join(app.getPath('userData'), 'attachments')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml'
}

export function registerAttachmentHandlers(): void {
  ipcMain.handle('attachments:get', async (_e, { entityType, entityId }) => {
    try { return { ok: true, data: await attachmentsGet(entityType, entityId) } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  // open file picker, copy selected images into app storage, register records
  ipcMain.handle('attachments:add', async (_e, { entityType, entityId, multi = true }) => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      const props: ('openFile' | 'multiSelections')[] = multi ? ['openFile', 'multiSelections'] : ['openFile']
      const res = await dialog.showOpenDialog(win!, {
        title: multi ? 'Select images' : 'Select an image',
        properties: props,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }]
      })
      if (res.canceled || !res.filePaths.length) return { ok: true, data: [] }

      const added: unknown[] = []

      // Remote mode: upload bytes to the shared server store.
      if (config.storageMode === 'remote') {
        for (const src of res.filePaths) {
          const base = path.basename(src)
          const buffer = fs.readFileSync(src)
          const rec = await remote.attachmentUpload(entityType, entityId, base, buffer)
          added.push(rec)
        }
        return { ok: true, data: added }
      }

      // Local mode: copy into userData and register the record.
      const targetDir = path.join(attachmentsDir(), entityType, String(entityId))
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
      for (const src of res.filePaths) {
        const base = path.basename(src)
        const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${base}`
        const dest = path.join(targetDir, unique)
        fs.copyFileSync(src, dest)
        const rel = path.relative(app.getPath('userData'), dest)
        const rec = await attachmentAdd(entityType, entityId, base, rel)
        added.push(rec)
      }
      return { ok: true, data: added }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  // return a base64 data URL for inline display
  ipcMain.handle('attachments:read', async (_e, { storedPath }) => {
    try {
      if (config.storageMode === 'remote') {
        const { buffer, contentType } = await remote.attachmentRaw(storedPath)
        return { ok: true, data: { dataUrl: `data:${contentType};base64,${buffer.toString('base64')}` } }
      }
      const abs = path.join(app.getPath('userData'), storedPath)
      if (!fs.existsSync(abs)) return { ok: false, error: 'File not found' }
      const ext = path.extname(abs).toLowerCase()
      const mime = MIME[ext] || 'application/octet-stream'
      const b64 = fs.readFileSync(abs).toString('base64')
      return { ok: true, data: { dataUrl: `data:${mime};base64,${b64}` } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('attachments:open', async (_e, { storedPath }) => {
    try {
      if (config.storageMode === 'remote') {
        // Download to a temp file, then open with the OS default app.
        const { buffer } = await remote.attachmentRaw(storedPath)
        const tmp = path.join(app.getPath('temp'), path.basename(storedPath))
        fs.writeFileSync(tmp, buffer)
        await shell.openPath(tmp)
        return { ok: true, data: {} }
      }
      const abs = path.join(app.getPath('userData'), storedPath)
      await shell.openPath(abs)
      return { ok: true, data: {} }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('attachments:updateDescription', async (_e, { id, description }) => {
    try { await attachmentUpdateDescription(id, description); return { ok: true, data: { id } } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('attachments:update', async (_e, { id, patch }) => {
    try { await attachmentUpdate(id, patch); return { ok: true, data: { id } } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('attachments:getMany', async (_e, { entityType, ids }) => {
    try { return { ok: true, data: await attachmentsGetMany(entityType, ids) } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('attachments:delete', async (_e, { id }) => {
    try {
      const rec = await attachmentDelete(id)
      if (rec?.stored_path) {
        const abs = path.join(app.getPath('userData'), String(rec.stored_path))
        if (fs.existsSync(abs)) fs.unlinkSync(abs)
      }
      return { ok: true, data: { id } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}
