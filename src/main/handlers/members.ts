import { ipcMain } from 'electron'
import {
  membersGetAll, memberCreate, memberUpdate, memberUpdateSkills, memberSetActive, memberDelete,
  projectMembersGet, projectMembersAll, projectMemberAssign, projectMemberUnassign,
  getSettings, updateSettings
} from '../dataLayer'

export function registerMemberHandlers(): void {
  // members
  ipcMain.handle('members:getAll', async () => {
    try { return { ok: true, data: await membersGetAll() } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('members:create', async (_e, { name, email, role, discipline }) => {
    try { return { ok: true, data: { id: await memberCreate(name, email, role, discipline) } } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('members:update', async (_e, { id, name, email, role, discipline }) => {
    try { await memberUpdate(id, name, email, role, discipline); return { ok: true, data: { id } } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('members:updateSkills', async (_e, { id, skills }) => {
    try { await memberUpdateSkills(id, skills); return { ok: true, data: { id } } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('members:setActive', async (_e, { id, active }) => {
    try { await memberSetActive(id, active); return { ok: true, data: { id } } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('members:delete', async (_e, { id }) => {
    try { await memberDelete(id); return { ok: true, data: { id } } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  // project ↔ member assignment
  ipcMain.handle('projectMembers:get', async (_e, { projectId }) => {
    try { return { ok: true, data: await projectMembersGet(projectId) } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('projectMembers:all', async () => {
    try { return { ok: true, data: await projectMembersAll() } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('projectMembers:assign', async (_e, { projectId, memberId }) => {
    try { await projectMemberAssign(projectId, memberId); return { ok: true, data: {} } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('projectMembers:unassign', async (_e, { projectId, memberId }) => {
    try { await projectMemberUnassign(projectId, memberId); return { ok: true, data: {} } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  // settings
  ipcMain.handle('settings:get', async () => {
    try { return { ok: true, data: await getSettings() } }
    catch (e) { return { ok: false, error: String(e) } }
  })
  ipcMain.handle('settings:update', async (_e, patch) => {
    try { return { ok: true, data: await updateSettings(patch) } }
    catch (e) { return { ok: false, error: String(e) } }
  })
}
