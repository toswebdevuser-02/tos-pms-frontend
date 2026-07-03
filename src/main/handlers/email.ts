import { ipcMain } from 'electron'
import nodemailer from 'nodemailer'
import { getSettings } from '../dataLayer'

async function makeTransport(): Promise<nodemailer.Transporter | null> {
  const { smtp } = await getSettings()
  if (!smtp.host || !smtp.user) return null
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass }
  })
}

export function registerEmailHandlers(): void {
  ipcMain.handle('email:test', async () => {
    try {
      const t = await makeTransport()
      if (!t) return { ok: false, error: 'SMTP not configured (set host and username in Settings).' }
      await t.verify()
      return { ok: true, data: { verified: true } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('email:send', async (_e, { to, subject, html }) => {
    try {
      const t = await makeTransport()
      if (!t) return { ok: false, error: 'SMTP not configured.' }
      const { smtp } = await getSettings()
      const info = await t.sendMail({ from: smtp.from || smtp.user, to, subject, html })
      return { ok: true, data: { messageId: info.messageId } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}
