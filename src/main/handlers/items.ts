import { ipcMain } from 'electron'
import { itemsGetByProject, itemCreate, itemUpdate, itemDelete, Row } from '../dataLayer'

export function registerItemHandlers(): void {
  ipcMain.handle('items:getByProject', async (_e, { projectId, type }) => {
    try { return { ok: true, data: await itemsGetByProject(projectId, type) } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('items:create', async (_e, { type, ...fields }: { type: string } & Row) => {
    try { return { ok: true, data: { id: await itemCreate(type, fields) } } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('items:update', async (_e, { type, id, ...fields }: { type: string; id: number } & Row) => {
    try { await itemUpdate(type, id, fields); return { ok: true, data: { id } } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('items:delete', async (_e, { type, id }) => {
    try { await itemDelete(type, id); return { ok: true, data: { id } } }
    catch (e) { return { ok: false, error: String(e) } }
  })
}
