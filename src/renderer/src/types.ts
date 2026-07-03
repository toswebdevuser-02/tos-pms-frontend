export interface Project {
  id: number
  name: string
  client: string
  location: string
  discipline: string
  quoted_hours: number
  start_date?: string
  end_date?: string
  archived?: boolean
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

import type { MemberRole } from './roles'
export type { MemberRole } from './roles'

export interface Skill {
  skill: string
  category?: string
  level: number // 1-5 proficiency
  years?: number
}

export interface Member {
  id: number
  name: string
  email: string
  role: MemberRole
  discipline?: string
  skills?: Skill[]
  status?: 'active' | 'left'
  left_date?: string
  created_at: string
}

export interface ProjectStatus {
  id: number
  project_id: number
  overall: string
  notes: string
  last_updated: string
}

export interface Attachment {
  id: number
  entity_type: string
  entity_id: number
  filename: string
  stored_path: string
  description: string
  response: string
  importance: 'High' | 'Medium' | 'Low'
  created_at: string
}

export interface Reminder {
  key: string
  projectId: number
  projectName: string
  kind: 'wip' | 'dispatch' | 'task'
  title: string
  date: string
  severity: 'due' | 'overdue' | 'upcoming'
  assignee: string
  assigneeEmail: string
}

export interface SmtpSettings {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

export interface Settings {
  current_member_id: number | null
  smtp: SmtpSettings
}

export interface ToastAction { label: string; onClick: () => void }
export type ToastFn = (msg: string, type?: 'success' | 'error', action?: ToastAction) => void

export interface AuthUser {
  uid: number
  mid: number | null
  role: MemberRole
  name: string
  email: string
}

export type AuthState = { mode: 'local' | 'remote'; user: AuthUser | null }

export interface ChangeEvent {
  entity: 'project' | 'status' | 'item' | 'member' | 'projectMember' | 'attachment'
  action: 'create' | 'update' | 'delete'
  type?: string
  projectId?: number
}

export type ItemType = 'rfi' | 'query' | 'dispatch' | 'status' | 'wip' | 'qc' | 'timesheet' | 'task'

export interface IpcResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

type R<T> = Promise<IpcResponse<T>>

declare global {
  interface Window {
    api: {
      projects: {
        getAll: () => R<Project[]>
        statuses: () => R<ProjectStatus[]>
        create: (d: { name: string; client: string; location: string; discipline: string; quoted_hours: string; start_date?: string; end_date?: string }) => R<{ id: number }>
        update: (d: { id: number; name: string; client: string; location: string; discipline: string; quoted_hours: string; start_date?: string; end_date?: string }) => R<{ id: number }>
        delete: (id: number) => R<{ id: number }>
        setArchived: (id: number, archived: boolean) => R<{ id: number }>
      }
      items: {
        getByProject: (projectId: number, type: string) => R<unknown[]>
        create: (type: string, data: Record<string, unknown>) => R<{ id: number }>
        update: (type: string, data: Record<string, unknown>) => R<{ id: number }>
        delete: (type: string, id: number) => R<{ id: number }>
      }
      members: {
        getAll: () => R<Member[]>
        create: (d: { name: string; email: string; role: string; discipline?: string }) => R<{ id: number }>
        update: (d: { id: number; name: string; email: string; role: string; discipline?: string }) => R<{ id: number }>
        updateSkills: (id: number, skills: Skill[]) => R<{ id: number }>
        setActive: (id: number, active: boolean) => R<{ id: number }>
        delete: (id: number) => R<{ id: number }>
      }
      projectMembers: {
        get: (projectId: number) => R<Member[]>
        all: () => R<{ id: number; project_id: number; member_id: number }[]>
        assign: (projectId: number, memberId: number) => R<unknown>
        unassign: (projectId: number, memberId: number) => R<unknown>
      }
      settings: {
        get: () => R<Settings>
        update: (patch: Partial<Settings>) => R<Settings>
      }
      attachments: {
        get: (entityType: string, entityId: number) => R<Attachment[]>
        add: (entityType: string, entityId: number, multi?: boolean) => R<Attachment[]>
        read: (storedPath: string) => R<{ dataUrl: string }>
        open: (storedPath: string) => R<unknown>
        updateDescription: (id: number, description: string) => R<{ id: number }>
        update: (id: number, patch: Record<string, unknown>) => R<{ id: number }>
        getMany: (entityType: string, ids: number[]) => R<Attachment[]>
        delete: (id: number) => R<{ id: number }>
      }
      email: {
        test: () => R<{ verified: boolean }>
        send: (d: { to: string; subject: string; html: string }) => R<{ messageId: string }>
      }
      reminders: {
        get: () => R<Reminder[]>
        notifyDesktop: () => R<{ shown: number; total?: number }>
      }
      powerbi: {
        export: () => R<{ dir: string | null; files?: number }>
      }
      backup: {
        create: () => R<{ filePath: string | null }>
        restore: () => R<{ restored: boolean }>
      }
      report: {
        pdf: (html: string, fileName: string) => R<{ filePath: string | null }>
      }
      csv: {
        export: (type: string, projectName: string, rows: Record<string, unknown>[]) => R<{ filePath: string | null }>
        import: (type: string) => R<{ rows: Record<string, string>[] }>
      }
      excel: {
        export: (type: string, projectName: string, rows: Record<string, unknown>[]) => R<{ filePath: string | null }>
      }
      paths: {
        pick: (mode: 'file' | 'folder') => R<{ path: string | null }>
        open: (path: string) => R<unknown>
        reveal: (path: string) => R<unknown>
      }
      auth: {
        state: () => R<AuthState>
        login: (email: string, password: string) => R<{ user: AuthUser; mustReset: boolean }>
        logout: () => R<unknown>
        changePassword: (currentPassword: string, newPassword: string) => R<unknown>
      }
      ai: {
        skillFit: (requiredText: string, candidates: { id: number; text: string }[]) =>
          R<{ results: { id: number; score: number }[]; method: 'ruflo' | 'lexical' }>
      }
      realtime: {
        subscribe: (cb: (event: ChangeEvent) => void) => () => void
      }
    }
  }
}
