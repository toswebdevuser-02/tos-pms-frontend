import { ipcMain } from 'electron'
import { projectsGetAll, projectCreate, projectUpdate, projectDelete, projectSetArchived, statusesGetAll } from '../dataLayer'

export function registerProjectHandlers(): void {
  ipcMain.handle('projects:getAll', async () => {
    try { return { ok: true, data: await projectsGetAll() } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('projects:statuses', async () => {
    try { return { ok: true, data: await statusesGetAll() } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('projects:create', async (_e, { name, client, location, discipline, quoted_hours, start_date, end_date }) => {
    try { return { ok: true, data: { id: await projectCreate(name, client, location, discipline, quoted_hours, start_date, end_date) } } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('projects:update', async (_e, { id, name, client, location, discipline, quoted_hours, start_date, end_date }) => {
    try { await projectUpdate(id, name, client, location, discipline, quoted_hours, start_date, end_date); return { ok: true, data: { id } } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('projects:delete', async (_e, { id }) => {
    try { await projectDelete(id); return { ok: true, data: { id } } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipcMain.handle('projects:setArchived', async (_e, { id, archived }) => {
    try { await projectSetArchived(id, archived); return { ok: true, data: { id } } }
    catch (e) { return { ok: false, error: String(e) } }
  })
}
