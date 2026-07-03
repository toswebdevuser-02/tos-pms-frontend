import { app } from 'electron'
import os from 'os'
import path from 'path'
import fs from 'fs'

/**
 * Single source of truth for WHERE and HOW data is stored.
 *
 * 'local'  → JSON file in userData (original single-user mode).
 * 'remote' → HTTP calls to the Project Tracker server (multi-user).
 *
 * File-backed settings live in userData/app-config.json (changed from the app's
 * Settings screen). Env vars OVERRIDE the file at runtime but are NOT persisted —
 * so `TRACKER_MODE=remote electron .` lets you test remote mode without changing
 * the user's normal (local) launch. TRACKER_SERVER overrides the server URL.
 */
interface FileConfig {
  storageMode: 'local' | 'remote'
  remoteBaseUrl: string
  authToken: string
}

function configFilePath(): string {
  return path.join(app.getPath('userData'), 'app-config.json')
}

let _file: FileConfig | null = null
function file(): FileConfig {
  if (_file) return _file
  const cfg: FileConfig = { storageMode: 'local', remoteBaseUrl: '', authToken: '' }
  try {
    const p = configFilePath()
    if (fs.existsSync(p)) Object.assign(cfg, JSON.parse(fs.readFileSync(p, 'utf8')))
  } catch {
    /* malformed config — fall back to defaults */
  }
  _file = cfg
  return cfg
}

function persist(): void {
  try {
    fs.writeFileSync(configFilePath(), JSON.stringify(file(), null, 2), 'utf8')
  } catch {
    /* best-effort */
  }
}

// Env overrides are applied on read only (never written back to disk).
function envMode(): 'local' | 'remote' | null {
  return process.env.TRACKER_MODE === 'remote' || process.env.TRACKER_MODE === 'local' ? process.env.TRACKER_MODE : null
}

export const config = {
  get storageMode(): 'local' | 'remote' {
    return envMode() ?? file().storageMode
  },
  get remoteBaseUrl(): string {
    return process.env.TRACKER_SERVER || file().remoteBaseUrl
  },
  get authToken(): string {
    return file().authToken
  },
  set authToken(v: string) {
    file().authToken = v || ''
    persist()
  },

  // Local mode: path to the JSON datastore.
  dataFilePath: (): string => path.join(app.getPath('userData'), 'data.json'),

  // Persist connection settings (used by the Settings screen).
  update(patch: Partial<FileConfig>): FileConfig {
    Object.assign(file(), patch)
    persist()
    return file()
  }
}

/**
 * The user performing the current action. Today this is the OS account name (or,
 * in remote mode, the server stamps identity from the JWT). Used to label
 * created_by / updated_by on records in local mode.
 */
export function currentUser(): string {
  try {
    return os.userInfo().username || 'unknown'
  } catch {
    return 'unknown'
  }
}
