import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Project, ProjectStatus, ToastAction } from './types'
import ProjectDetail from './components/ProjectDetail'
import FormModal, { FieldDef } from './components/FormModal'
import Toast from './components/Toast'
import MembersModal from './components/MembersModal'
import SettingsModal from './components/SettingsModal'
import RemindersPanel from './components/RemindersPanel'
import ProjectTree from './components/ProjectTree'
import AssignmentsModal from './components/AssignmentsModal'
import OrgChartModal from './components/OrgChartModal'
import MyTasksModal from './components/MyTasksModal'
import MyWeekModal from './components/MyWeekModal'
import SkillsModal from './components/SkillsModal'
import PerformanceModal from './components/PerformanceModal'
import BestFitModal from './components/BestFitModal'
import DisciplineModal from './components/DisciplineModal'
import AllocationModal from './components/AllocationModal'
import StaffingModal from './components/StaffingModal'
import CommandPalette, { PaletteTarget } from './components/CommandPalette'
import ExecDashboard from './components/ExecDashboard'
import Icon from './components/Icon'
import HomeDashboard from './components/HomeDashboard'
import { AppProvider, useApp } from './context/AppContext'
import { DISCIPLINES } from './disciplines'
import Login from './Login'

const PROJECT_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Project Name', required: true },
  { key: 'client', label: 'Client' },
  { key: 'location', label: 'Location' },
  { key: 'discipline', label: 'Discipline', type: 'select', options: DISCIPLINES },
  { key: 'quoted_hours', label: 'Quoted Hours (budget)', type: 'number' },
  { key: 'start_date', label: 'Start Date', type: 'date' },
  { key: 'end_date', label: 'Target End Date', type: 'date' }
]

interface ToastState { message: string; type: 'success' | 'error'; key: number; action?: ToastAction }

function Shell() {
  const { members, currentMember, setCurrentMember, isCompanyAdmin, isManager, authMode, authUser, logout } = useApp()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [addingProject, setAddingProject] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [search, setSearch] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showReminders, setShowReminders] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showOrg, setShowOrg] = useState(false)
  const [showMyTasks, setShowMyTasks] = useState(false)
  const [showMyWeek, setShowMyWeek] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [showPerf, setShowPerf] = useState(false)
  const [showBestFit, setShowBestFit] = useState(false)
  const [showDisc, setShowDisc] = useState(false)
  const [showAllocation, setShowAllocation] = useState(false)
  const [showStaffing, setShowStaffing] = useState(false)
  const [showExec, setShowExec] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [gotoTab, setGotoTab] = useState<{ tab: string; n: number }>({ tab: 'Dashboard', n: 0 })
  const [myAssignments, setMyAssignments] = useState<Set<number>>(new Set())
  const [reminderCount, setReminderCount] = useState(0)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const [statusMap, setStatusMap] = useState<Record<number, string>>({})

  const loadProjects = useCallback(async () => {
    const res = await window.api.projects.getAll()
    if (res.ok) setProjects(res.data as Project[])
  }, [])

  const loadStatuses = useCallback(async () => {
    const res = await window.api.projects.statuses()
    if (res.ok) {
      const m: Record<number, string> = {}
      ;(res.data as ProjectStatus[]).forEach((s) => { if (s.overall) m[s.project_id] = s.overall })
      setStatusMap(m)
    }
  }, [])

  const loadReminderCount = useCallback(async () => {
    const res = await window.api.reminders.get()
    if (res.ok) setReminderCount((res.data as unknown[]).filter((r) => (r as { severity: string }).severity !== 'upcoming').length)
  }, [])

  // Which projects the current member is assigned to (for visibility).
  const loadAssignments = useCallback(async () => {
    const res = await window.api.projectMembers.all()
    if (!res.ok) return
    const cid = currentMember?.id
    if (!cid) { setMyAssignments(new Set()); return }
    const ids = (res.data as { project_id: number; member_id: number }[])
      .filter((r) => r.member_id === cid).map((r) => r.project_id)
    setMyAssignments(new Set(ids))
  }, [currentMember])

  useEffect(() => { loadProjects(); loadStatuses(); loadReminderCount() }, [loadProjects, loadStatuses, loadReminderCount])
  useEffect(() => { loadAssignments() }, [loadAssignments])

  // Real-time updates (remote mode): refresh the affected view when another
  // user changes data. detailRefresh bumps re-mount the open project's tab.
  const [detailRefresh, setDetailRefresh] = useState(0)
  const selectedIdRef = useRef<number | null>(null)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  useEffect(() => {
    const unsub = window.api.realtime.subscribe((evt) => {
      if (['project', 'member', 'projectMember', 'status'].includes(evt.entity)) {
        loadProjects(); loadStatuses(); loadAssignments(); loadReminderCount()
      }
      if (evt.projectId != null && evt.projectId === selectedIdRef.current) {
        setDetailRefresh((n) => n + 1)
      }
    })
    return unsub
  }, [loadProjects, loadStatuses, loadAssignments, loadReminderCount])

  const showToast = (message: string, type: 'success' | 'error' = 'success', action?: ToastAction) => {
    setToast({ message, type, key: Date.now(), action })
  }

  // ── Keyboard shortcuts: n = new project, / = focus search, esc = close ──────
  const searchRef = useRef<HTMLInputElement>(null)
  const closeAllOverlays = useCallback(() => {
    setAddingProject(false); setShowMembers(false); setShowSettings(false); setShowReminders(false)
    setShowAssign(false); setShowOrg(false); setShowMyTasks(false); setShowSkills(false)
    setShowPerf(false); setShowBestFit(false); setShowDisc(false); setShowAllocation(false)
    setShowStaffing(false); setShowMenu(false); setShowMyWeek(false)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v); return }
      if (e.key === 'Escape') { if (typing) (t as HTMLElement).blur(); setPaletteOpen(false); closeAllOverlays(); return }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
      else if (e.key.toLowerCase() === 'n' && isManager) { e.preventDefault(); setAddingProject(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isManager, closeAllOverlays])

  // Export every table (projects, members, all item types + derived models) as CSV.
  const exportAllData = async () => {
    showToast('Choose a folder to export all data…')
    const res = await window.api.powerbi.export()
    if (res.ok && res.data?.dir) showToast(`Exported all data (${res.data.files} files) to ${res.data.dir}`)
    else if (res.ok) showToast('Export cancelled')
    else showToast(res.error ?? 'Export failed', 'error')
  }

  const goToProjectTab = (projectId: number, tab: string): void => {
    setSelectedId(projectId)
    setGotoTab((g) => ({ tab, n: g.n + 1 }))
  }
  const handlePalette = (t: PaletteTarget): void => {
    if (t.kind === 'member') { setShowMembers(true); return }
    if (t.kind === 'item') goToProjectTab(t.projectId, t.tab)
    else setSelectedId(t.projectId)
  }

  const handleCreateProject = async (data: Record<string, string>) => {
    const res = await window.api.projects.create(data as { name: string; client: string; location: string; discipline: string; quoted_hours: string })
    if (res.ok && res.data) {
      setAddingProject(false)
      await loadProjects()
      setSelectedId(res.data.id)
      showToast('Project created', 'success', { label: 'Suggest team', onClick: () => setShowBestFit(true) })
    }
  }

  // Visibility: Company Admin → all; Manager → their discipline (+ assigned); else assigned only.
  const myDiscipline = currentMember?.discipline || ''
  const scopedProjects = useMemo(() => {
    if (isCompanyAdmin) return projects
    if (isManager && myDiscipline) return projects.filter((p) => p.discipline === myDiscipline || myAssignments.has(p.id))
    return projects.filter((p) => myAssignments.has(p.id))
  }, [projects, isCompanyAdmin, isManager, myDiscipline, myAssignments])

  // Archived projects are hidden from active views unless "Show archived" is on.
  const archivedCount = useMemo(() => scopedProjects.filter((p) => p.archived).length, [scopedProjects])
  const visibleProjects = useMemo(
    () => (showArchived ? scopedProjects : scopedProjects.filter((p) => !p.archived)),
    [scopedProjects, showArchived]
  )

  // Managers create projects within their own discipline (preset + locked); Company Admin anywhere.
  const newProjectInitial = !isCompanyAdmin && myDiscipline ? { discipline: myDiscipline } : undefined

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return visibleProjects
    return visibleProjects.filter((p) =>
      p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q) || p.location.toLowerCase().includes(q))
  }, [visibleProjects, search])

  const selected = visibleProjects.find((p) => p.id === selectedId) ?? null

  return (
    <div className="app-shell">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-brand"><span className="brand-mark">▦</span> TOS Tracker</div>
        <button className="btn btn-secondary topbar-workspace-btn" onClick={() => setShowMenu((v) => !v)}><Icon name="menu" size={16} /> Workspace</button>
        <div className="topbar-actions">
          {authMode === 'remote' ? (
            <div className="acting-as signed-in">
              <span>Signed in as</span>
              <strong>{currentMember?.name ?? authUser?.name}</strong>
              <span className="role-chip">{authUser?.role}</span>
              <button className="btn btn-secondary btn-sm" onClick={logout} title="Sign out"><Icon name="logout" size={15} /> Logout</button>
            </div>
          ) : (
            <div className="acting-as">
              <span>Acting as</span>
              <select
                value={currentMember?.id ?? ''}
                onChange={(e) => setCurrentMember(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Select (admin mode)</option>
                {members.filter((m) => m.status !== 'left').map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
              </select>
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setPaletteOpen(true)} title="Search (Ctrl+K)"><Icon name="search" size={15} /> Search <kbd className="kbd-hint">Ctrl K</kbd></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowMyWeek(true)}><Icon name="calendar" size={15} /> My Week</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowMyTasks(true)}><Icon name="checkSquare" size={15} /> My Tasks</button>
          <button className="btn btn-secondary btn-sm reminder-btn" onClick={() => setShowReminders(true)}>
            <Icon name="inbox" size={15} /> Inbox{reminderCount > 0 && <span className="reminder-pill">{reminderCount}</span>}
          </button>
          <div className="topbar-menu">
            {showMenu && (
              <>
                <div className="drawer-backdrop" onClick={() => setShowMenu(false)} />
                <aside className="workspace-drawer" role="dialog" aria-label="Workspace">
                  <div className="drawer-head">
                    <h3>Workspace</h3>
                    <button className="btn-icon" onClick={() => setShowMenu(false)}><Icon name="close" size={18} /></button>
                  </div>
                  <div className="drawer-body">
                    <div className="menu-section">People &amp; Organization</div>
                    <button className="menu-item" onClick={() => { setShowOrg(true); setShowMenu(false) }}><Icon name="building" /> Organization tree</button>
                    <button className="menu-item" onClick={() => { setShowMembers(true); setShowMenu(false) }}><Icon name="users" /> Members</button>
                    <button className="menu-item" onClick={() => { setShowSkills(true); setShowMenu(false) }}><Icon name="brain" /> Skills</button>
                    <button className="menu-item" onClick={() => { setShowPerf(true); setShowMenu(false) }}><Icon name="barChart" /> Performance</button>

                    {isManager && <div className="menu-section">Planning</div>}
                    {isManager && <button className="menu-item" onClick={() => { setShowExec(true); setShowMenu(false) }}><Icon name="barChart" /> Executive overview</button>}
                    {isManager && <button className="menu-item" onClick={() => { setShowBestFit(true); setShowMenu(false) }}><Icon name="target" /> Best-fit staffing</button>}
                    {isManager && <button className="menu-item" onClick={() => { setShowDisc(true); setShowMenu(false) }}><Icon name="grid" /> Discipline roll-up</button>}
                    {isManager && <button className="menu-item" onClick={() => { setShowAllocation(true); setShowMenu(false) }}><Icon name="calendar" /> Daily allocation</button>}
                    {isManager && <button className="menu-item" onClick={() => { setShowStaffing(true); setShowMenu(false) }}><Icon name="userPlus" /> Staffing (drag-drop)</button>}
                    {isCompanyAdmin && <button className="menu-item" onClick={() => { setShowAssign(true); setShowMenu(false) }}><Icon name="pin" /> Assign projects</button>}

                    <div className="menu-section">Data</div>
                    <button className="menu-item" onClick={() => { exportAllData(); setShowMenu(false) }}><Icon name="download" /> Export all data (CSV)</button>

                    <div className="menu-section">Settings</div>
                    <button className="menu-item" onClick={() => { setShowSettings(true); setShowMenu(false) }}><Icon name="settings" /> Settings</button>
                    <button className="menu-item" onClick={() => { setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>
                      <Icon name={theme === 'dark' ? 'sun' : 'moon'} /> {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                    </button>
                  </div>
                </aside>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="app-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            {isManager && (
              <button className="btn btn-primary btn-full" onClick={() => setAddingProject(true)}><Icon name="plus" size={16} /> New Project</button>
            )}
            {visibleProjects.length > 0 && (
              <div className="search-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input ref={searchRef} placeholder="Search projects…  ( / )" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            )}
          </div>
          <div className="project-list">
            {visibleProjects.length === 0 ? (
              <div className="empty-sidebar">
                {isManager
                  ? <>No projects yet.<br />Create one to get started.</>
                  : <>No projects assigned to you yet.<br />A Manager or Company Admin assigns your projects.</>}
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-sidebar">No matches for “{search}”.</div>
            ) : (
              <ProjectTree
                projects={filtered}
                statusMap={statusMap}
                selectedId={selectedId}
                onSelect={setSelectedId}
                searching={!!search.trim()}
              />
            )}
          </div>
          {(visibleProjects.length > 0 || archivedCount > 0) && (
            <div className="sidebar-footer">
              <span>{visibleProjects.length} project{visibleProjects.length !== 1 ? 's' : ''}</span>
              {archivedCount > 0 && (
                <button className="archive-toggle" onClick={() => setShowArchived((v) => !v)}>
                  {showArchived ? '✓ ' : ''}Show archived ({archivedCount})
                </button>
              )}
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="main-area">
          {selected ? (
            <ProjectDetail
              key={selected.id}
              project={selected}
              refreshKey={detailRefresh}
              onUpdate={() => { loadProjects(); loadStatuses() }}
              onDelete={() => { setSelectedId(null); loadProjects(); loadStatuses() }}
              onBack={() => setSelectedId(null)}
              gotoTab={gotoTab}
              onToast={(m, t) => { showToast(m, t); loadReminderCount(); loadStatuses() }}
            />
          ) : visibleProjects.length === 0 ? (
            <div className="empty-main">
              <div className="welcome-card">
                <div className="welcome-icon">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                  </svg>
                </div>
                <h1>TOS Tracker</h1>
                <p>Track RFIs, queries, dispatches, tasks, WIP, QC and timesheets for every project — with members, reminders and CSV export.</p>
                {isManager ? (
                  <button className="btn btn-primary" onClick={() => setAddingProject(true)}><Icon name="plus" size={16} /> Create your first project</button>
                ) : (
                  <p className="welcome-hint">No projects assigned to you yet. A Manager or Company Admin assigns your projects.</p>
                )}
              </div>
            </div>
          ) : (
            <HomeDashboard
              projects={visibleProjects}
              statusMap={statusMap}
              members={members}
              isManager={isManager}
              onSelect={setSelectedId}
              onNewProject={() => setAddingProject(true)}
            />
          )}
        </main>
      </div>

      {addingProject && (
        <FormModal title="New Project" fields={PROJECT_FIELDS} initial={newProjectInitial} onSubmit={handleCreateProject} onClose={() => setAddingProject(false)} />
      )}
      {showAssign && (
        <AssignmentsModal
          projects={projects}
          onClose={() => setShowAssign(false)}
          onToast={showToast}
          onChanged={loadAssignments}
        />
      )}
      {showSkills && <SkillsModal onClose={() => setShowSkills(false)} onToast={showToast} />}
      {showPerf && <PerformanceModal projects={visibleProjects} onClose={() => setShowPerf(false)} />}
      {showBestFit && <BestFitModal projects={visibleProjects} onClose={() => setShowBestFit(false)} />}
      {showDisc && <DisciplineModal projects={visibleProjects} onClose={() => setShowDisc(false)} onSelect={setSelectedId} />}
      {showAllocation && <AllocationModal projects={visibleProjects} onClose={() => setShowAllocation(false)} onToast={showToast} />}
      {showStaffing && <StaffingModal projects={visibleProjects} onClose={() => { setShowStaffing(false); loadAssignments() }} onToast={showToast} />}
      {showExec && <ExecDashboard projects={visibleProjects} onClose={() => setShowExec(false)} onSelect={setSelectedId} onToast={showToast} />}
      {paletteOpen && <CommandPalette projects={visibleProjects} members={members} onClose={() => setPaletteOpen(false)} onNavigate={handlePalette} />}
      {showOrg && <OrgChartModal onClose={() => setShowOrg(false)} />}
      {showMyTasks && <MyTasksModal projects={visibleProjects} onClose={() => setShowMyTasks(false)} onToast={showToast} />}
      {showMyWeek && <MyWeekModal projects={visibleProjects} onClose={() => setShowMyWeek(false)} onNavigate={goToProjectTab} />}
      {showMembers && <MembersModal onClose={() => setShowMembers(false)} onToast={showToast} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onToast={showToast} />}
      {showReminders && <RemindersPanel projects={visibleProjects} onClose={() => { setShowReminders(false); loadReminderCount() }} onToast={showToast} onNavigate={goToProjectTab} />}
      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} action={toast.action} onClose={() => setToast(null)} />}
    </div>
  )
}

function Gate() {
  const { authChecked, needsLogin } = useApp()
  if (!authChecked) {
    return <div className="login-screen"><div className="login-card"><div className="login-brand"><span className="brand-mark">▦</span> TOS Tracker</div><p className="login-sub">Loading…</p></div></div>
  }
  if (needsLogin) return <Login />
  return <Shell />
}

export default function App() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  )
}
