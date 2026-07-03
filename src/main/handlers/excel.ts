import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'
import { attachmentsGet } from '../dataLayer'
import { config } from '../config'
import * as remote from '../remoteClient'
import { CSV_COLUMNS, columnLabel } from './csv'

const ATTACH_TYPES = new Set(['rfi', 'query', 'qc', 'standard'])
// exceljs only embeds these raster types reliably
const EMBEDDABLE: Record<string, 'jpeg' | 'png' | 'gif'> = {
  jpg: 'jpeg', jpeg: 'jpeg', png: 'png', gif: 'gif'
}

export function registerExcelHandler(): void {
  ipcMain.handle(
    'excel:export',
    async (_e, { type, projectName, rows }: { type: string; projectName: string; rows: Record<string, unknown>[] }) => {
      try {
        const win = BrowserWindow.getFocusedWindow()
        const cols = CSV_COLUMNS[type] || Object.keys(rows[0] || {})

        const wb = new ExcelJS.Workbook()
        wb.creator = 'Project Tracker'
        wb.created = new Date()
        const ws = wb.addWorksheet(type.toUpperCase(), {
          views: [{ state: 'frozen', ySplit: 1 }]
        })

        // columns + bold styled header
        ws.columns = cols.map((c) => ({ header: columnLabel(c), key: c, width: 22 }))
        const header = ws.getRow(1)
        header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2A44' } }
        header.alignment = { vertical: 'middle' }
        header.height = 22
        header.eachCell((cell) => {
          cell.border = { bottom: { style: 'thin', color: { argb: 'FF334155' } } }
        })

        // data rows
        rows.forEach((r) => {
          const obj: Record<string, unknown> = {}
          cols.forEach((c) => (obj[c] = r[c] ?? ''))
          const added = ws.addRow(obj)
          added.alignment = { vertical: 'top', wrapText: true }
        })
        if (rows.length) {
          ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }
        }

        // embedded images section
        if (ATTACH_TYPES.has(type)) {
          let cur = ws.rowCount + 3
          const title = ws.getCell(cur, 1)
          title.value = 'Attached Images'
          title.font = { bold: true, size: 13 }
          cur += 1

          const hdr = ws.getRow(cur)
          hdr.getCell(1).value = 'Record'
          hdr.getCell(2).value = 'Description'
          hdr.getCell(3).value = 'Image'
          hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } }
          hdr.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2A44' } }))
          cur += 1

          let anyImage = false
          for (const r of rows) {
            const atts = await attachmentsGet(type, r.id as number)
            for (const a of atts) {
              // Read image bytes from the server (remote) or local userData (local).
              let buf: Buffer | null = null
              if (config.storageMode === 'remote') {
                try { buf = (await remote.attachmentRaw(String(a.stored_path))).buffer } catch { buf = null }
              } else {
                const abs = path.join(app.getPath('userData'), String(a.stored_path))
                if (fs.existsSync(abs)) buf = fs.readFileSync(abs)
              }
              if (!buf) continue
              const ext = path.extname(String(a.stored_path) || String(a.filename)).slice(1).toLowerCase()
              const extension = EMBEDDABLE[ext]

              ws.getCell(cur, 1).value = String(r[cols[0]] ?? r.id)
              ws.getCell(cur, 2).value = String(a.description ?? a.filename ?? '')
              ws.getCell(cur, 1).alignment = { vertical: 'middle' }
              ws.getCell(cur, 2).alignment = { vertical: 'middle', wrapText: true }

              if (extension) {
                const imageId = wb.addImage({ buffer: buf as unknown as ExcelJS.Buffer, extension })
                ws.getRow(cur).height = 95
                ws.addImage(imageId, { tl: { col: 2, row: cur - 1 }, ext: { width: 170, height: 125 } })
              } else {
                ws.getCell(cur, 3).value = `(image: ${a.filename})`
              }
              anyImage = true
              cur += 1
            }
          }
          ws.getColumn(3).width = 28
          if (!anyImage) ws.getCell(cur, 1).value = 'No images attached.'
        }

        const safe = projectName.replace(/[^a-z0-9_\- ]/gi, '_')
        const { canceled, filePath } = await dialog.showSaveDialog(win!, {
          defaultPath: `${safe}_${type}.xlsx`,
          filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
        })
        if (canceled || !filePath) return { ok: true, data: { filePath: null } }

        await wb.xlsx.writeFile(filePath)
        return { ok: true, data: { filePath } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
  )
}
