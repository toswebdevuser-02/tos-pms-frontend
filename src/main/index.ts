import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerProjectHandlers } from './handlers/projects'
import { registerItemHandlers } from './handlers/items'
import { registerCsvHandler } from './handlers/csv'
import { registerMemberHandlers } from './handlers/members'
import { registerAttachmentHandlers } from './handlers/attachments'
import { registerEmailHandlers } from './handlers/email'
import { registerReminderHandlers } from './handlers/reminders'
import { registerPowerBiHandlers } from './handlers/powerbi'
import { registerExcelHandler } from './handlers/excel'
import { registerPathHandlers } from './handlers/paths'
import { registerAuthHandlers } from './handlers/auth'
import { startRealtime } from './realtime'
import { registerAiHandlers } from './handlers/ai'
import { registerBackupHandlers } from './handlers/backup'
import { registerReportHandlers } from './handlers/report'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Project Tracker',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.teslaoutsourcing.projecttracker')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerProjectHandlers()
  registerItemHandlers()
  registerCsvHandler()
  registerMemberHandlers()
  registerAttachmentHandlers()
  registerEmailHandlers()
  registerReminderHandlers()
  registerPowerBiHandlers()
  registerExcelHandler()
  registerPathHandlers()
  registerAuthHandlers()
  registerAiHandlers()
  registerBackupHandlers()
  registerReportHandlers()

  createWindow()
  startRealtime() // no-op unless remote mode + a stored token

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
