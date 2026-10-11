import { useEffect, useState, type ReactNode } from 'react'
import * as api from './services'
import { Icon, UIProvider, go, initials, setTheme, useAsync, useDbVersionSafe, useRoute, useTheme } from './ui'
import { ProfilePage, SettingsPage } from './pages/shared'
import { StudentAcademics, StudentAttendance, StudentDashboard, StudentFees, StudentNotifications, StudentTransport, StudentVerification } from './pages/student'
import { FacultyAttendance, FacultyDashboard, FacultyMarks, FacultyNotifications, FacultyReports, FacultyStudents, FacultySubjects, VerificationPage } from './pages/faculty'
import { AdminAcademics, AdminDashboard, AdminDepartments, AdminFaculty, AdminFees, AdminNotifications, AdminReports, AdminStudents, AdminSubjects, AdminTransport } from './pages/admin'

type P = { me: api.Profile; arg?: string }
interface Page { id: string; label: string; icon: string; el: (p: P) => ReactNode }
const PAGES: Record<api.Role, Page[]> = {
  student: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', el: p => <StudentDashboard me={p.me} /> }, { id: 'profile', label: 'Profile', icon: 'user', el: p => <ProfilePage me={p.me} /> },
    { id: 'academics', label: 'Academics', icon: 'book', el: () => <StudentAcademics /> }, { id: 'attendance', label: 'Attendance', icon: 'cal', el: () => <StudentAttendance /> },
    { id: 'fees', label: 'Fees', icon: 'wallet', el: () => <StudentFees /> }, { id: 'transport', label: 'Transport', icon: 'bus', el: () => <StudentTransport /> },
    { id: 'verification', label: 'Verification', icon: 'shield', el: () => <StudentVerification /> }, { id: 'notifications', label: 'Notifications', icon: 'bell', el: p => <StudentNotifications me={p.me} /> },
    { id: 'settings', label: 'Settings', icon: 'gear', el: p => <SettingsPage me={p.me} /> }],
  faculty: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', el: p => <FacultyDashboard me={p.me} /> }, { id: 'subjects', label: 'Subjects', icon: 'lib', el: p => <FacultySubjects me={p.me} arg={p.arg} /> },
    { id: 'students', label: 'Students', icon: 'users', el: p => <FacultyStudents me={p.me} /> }, { id: 'attendance', label: 'Attendance', icon: 'cal', el: p => <FacultyAttendance me={p.me} /> },
    { id: 'marks', label: 'Marks', icon: 'pen', el: p => <FacultyMarks me={p.me} /> }, { id: 'verification', label: 'Verification', icon: 'shield', el: () => <VerificationPage role="faculty" /> },
    { id: 'reports', label: 'Reports', icon: 'chart', el: p => <FacultyReports me={p.me} /> }, { id: 'notifications', label: 'Notifications', icon: 'bell', el: p => <FacultyNotifications me={p.me} /> },
    { id: 'profile', label: 'Profile', icon: 'user', el: p => <ProfilePage me={p.me} /> }, { id: 'settings', label: 'Settings', icon: 'gear', el: p => <SettingsPage me={p.me} /> }],
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', el: p => <AdminDashboard me={p.me} /> }, { id: 'students', label: 'Students', icon: 'users', el: () => <AdminStudents /> },
    { id: 'faculty', label: 'Faculty', icon: 'user', el: () => <AdminFaculty /> }, { id: 'departments', label: 'Departments', icon: 'building', el: () => <AdminDepartments /> },
    { id: 'subjects', label: 'Subjects', icon: 'lib', el: () => <AdminSubjects /> }, { id: 'academics', label: 'Academics', icon: 'book', el: () => <AdminAcademics /> },
    { id: 'fees', label: 'Fees', icon: 'wallet', el: () => <AdminFees /> }, { id: 'transport', label: 'Transport', icon: 'bus', el: () => <AdminTransport /> },
    { id: 'verification', label: 'Verification', icon: 'shield', el: () => <VerificationPage role="admin" /> }, { id: 'reports', label: 'Reports', icon: 'chart', el: () => <AdminReports /> },
    { id: 'notifications', label: 'Notifications', icon: 'bell', el: p => <AdminNotifications me={p.me} /> }, { id: 'profile', label: 'Profile', icon: 'user', el: p => <ProfilePage me={p.me} /> },
    { id: 'settings', label: 'Settings', icon: 'gear', el: p => <SettingsPage me={p.me} /> }],
}
const DEMO = [['Student', 'STU202401', 'student123'], ['Faculty', 'FAC001', 'faculty123'], ['Admin', 'ADMIN001', 'admin123']] as const

function Login({ onDone }: { onDone: (p: api.Profile) => void }) {
  const [code, setCode] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(''); try { onDone(await api.signIn(code, pw)) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) } }
  return <div className="login"><form className="card" onSubmit={submit}>
    <div className="brand" style={{ padding: 0, border: 0, marginBottom: 6 }}>SMART UNIVERSITY<small>One connected platform for the modern university</small></div>
    <p className="demo-pill" style={{ display: 'inline-block', margin: '8px 0 14px' }}>Demonstration app · fictional mock data stored in this browser</p>
    <label className="field" style={{ marginBottom: 10 }}><span>User ID</span><input value={code} onChange={e => setCode(e.target.value)} autoComplete="username" /></label>
    <label className="field" style={{ marginBottom: 10 }}><span>Password</span><input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" /></label>
    {err && <p className="err" role="alert">{err}</p>}<button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <p className="muted small" style={{ margin: '14px 0 6px' }}>Demo accounts (click to fill):</p><div className="actions">{DEMO.map(d => <button type="button" key={d[0]} className="btn sm" onClick={() => { setCode(d[1]); setPw(d[2]); setErr('') }}>{d[0]}</button>)}</div>
    <p className="muted small" style={{ marginTop: 10 }}>Mock sign-in for a local demo, not production security.</p></form></div>
}

function Shell({ me, onLogout }: { me: api.Profile; onLogout: () => void }) {
  const [role, page = 'dashboard', arg] = useRoute(), [open, setOpen] = useState(false), theme = useTheme(), pages = PAGES[me.role], cur = pages.find(p => p.id === page)
  const unread = useAsync(async () => ((await api.getNotifications()) as { is_read: boolean }[]).filter(n => !n.is_read).length)
  useEffect(() => { if (role !== me.role || !cur) go(`${me.role}/dashboard`) }, [role, cur, me.role])
  useEffect(() => setOpen(false), [page, arg])
  if (role !== me.role || !cur) return null
  return <div className="app"><div className={'overlay-nav' + (open ? ' open' : '')} onClick={() => setOpen(false)} />
    <aside className={'sidebar' + (open ? ' open' : '')} aria-label="Main navigation"><div className="brand">SMART UNIVERSITY<small>{me.role === 'admin' ? 'Administration' : me.role === 'faculty' ? 'Faculty portal' : 'Student portal'}</small></div>
      <nav className="nav">{pages.map(p => <a key={p.id} href={`#/${me.role}/${p.id}`} aria-current={p.id === page ? 'page' : undefined} onClick={() => setOpen(false)}><Icon n={p.icon} />{p.label}{p.id === 'notifications' && (unread.data ?? 0) > 0 && <span className="dot" aria-label={`${unread.data} unread`}>{unread.data}</span>}</a>)}</nav>
      <div className="side-foot"><div className="who"><div className="avatar">{initials(me.name)}</div><div><b>{me.name}</b><div className="muted">{me.user_code}</div></div></div><button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={onLogout}><Icon n="out" size={16} />Logout</button></div></aside>
    <div className="content"><header className="topbar"><button className="icon-btn menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon n="menu" /></button><b>{cur.label}</b><span className="grow" /><span className="demo-pill" title="All records are fictional and stored only in this browser">Demo · local mock data</span>
      <button className="icon-btn" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon n={theme === 'dark' ? 'sun' : 'moon'} /></button></header>
      <main className="page" key={`${page}/${arg ?? ''}`}>{cur.el({ me, arg })}</main>
      <footer className="footer">Smart University demo · fictional mock data stored locally in this browser · does not sync across devices</footer></div></div>
}

export default function App() {
  const [me, setMe] = useState<api.Profile | null>(null), [ready, setReady] = useState(false), [err, setErr] = useState(''), ver = useDbVersionSafe()
  useEffect(() => { api.getCurrentProfile().then(p => { setMe(p); if (p && !location.hash) go(`${p.role}/dashboard`) }, e => setErr((e as Error).message)).finally(() => setReady(true)) }, [])
  useEffect(() => { if (me) api.getCurrentProfile().then(p => { if (!p) setMe(null) }, () => setMe(null)) }, [ver]) // deactivated while signed in -> signed out
  const login = (p: api.Profile) => { setMe(p); go(`${p.role}/dashboard`) }
  const logout = async () => { await api.signOut(); setMe(null); location.hash = '' }
  return <UIProvider>{!ready ? <div className="login muted">Loading…</div> : me ? <Shell me={me} onLogout={logout} /> : <>{err && <p className="err" role="alert" style={{ textAlign: 'center' }}>{err}</p>}<Login onDone={login} /></>}</UIProvider>
}
