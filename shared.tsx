import { useState } from 'react'
import * as api from '../services'
import { Async, Badge, Bar, Card, Empty, FormDialog, KV, Modal, PageHeader, Table, avg, getTheme, gradeOf, inr, setTheme, useAsync, useTheme, useUI, type Row } from '../ui'

export const EXAMS = ['Internal 1', 'Internal 2', 'Assignment', 'Lab', 'Model Exam']
export const subjAvg = (marks: Row[], sid: number) => avg(marks.filter(m => m.subject_id === sid).map(m => (m.marks_obtained / m.max_marks) * 100))

/** Alerts computed from the current records (nothing is hardcoded). */
export function useAlerts(me: api.Profile) {
  return useAsync(async () => {
    const out: { t: string; tone: string }[] = []
    if (me.role === 'student') {
      const [st] = await api.getStudents(); const [fees, att, subs] = await Promise.all([api.getFees(), api.getAttendance(st.id), api.getSubjects()]); const f = fees[0] as Row
      if (f && f.outstanding > 0) out.push({ t: `${inr(f.outstanding)} fee balance is pending.`, tone: 'warn' })
      ;(att as Row[]).filter(a => a.percentage < 75).forEach(a => out.push({ t: `Attendance in ${(subs as Row[]).find(s => s.id === a.subject_id)?.subject_name} is ${a.percentage}% (below 75%).`, tone: 'bad' }))
      if (st.verification && st.verification.status !== 'Verified') out.push({ t: `Your verification status is ${st.verification.status}.`, tone: 'warn' })
    } else if (me.role === 'faculty') {
      const f = await api.getMyFaculty(me.user_code), mine = ((await api.getSubjects()) as Row[]).filter(s => s.faculty_id === f.id), ids = new Set(mine.map(s => s.id))
      const low = ((await api.getAttendance()) as Row[]).filter(a => ids.has(a.subject_id) && a.percentage < 75); if (low.length) out.push({ t: `${new Set(low.map(a => a.student_id)).size} students have attendance below 75% in your subjects.`, tone: 'bad' })
      const roster = new Set<number>(); for (const s of mine) (await api.getSubjectRoster(s.id)).forEach(e => roster.add(e.student_id))
      const rv = ((await api.getVerification()) as Row[]).filter(v => roster.has(v.student_id) && v.status !== 'Verified'); if (rv.length) out.push({ t: `${rv.length} of your students need verification review.`, tone: 'warn' })
    } else {
      const ver = ((await api.getVerification()) as Row[]).filter(v => v.status !== 'Verified'); if (ver.length) out.push({ t: `${ver.length} student profiles require verification.`, tone: 'warn' })
      const per = new Map<number, number[]>(); ;((await api.getAttendance()) as Row[]).forEach(a => per.set(a.student_id, [...(per.get(a.student_id) ?? []), a.percentage])); const lowN = [...per.values()].filter(v => avg(v) < 75).length; if (lowN) out.push({ t: `${lowN} students are below the 75% attendance threshold.`, tone: 'bad' })
      const fees = ((await api.getFees()) as Row[]).filter(f => f.outstanding > 0); if (fees.length) out.push({ t: `${fees.length} students have pending fee payments (${inr(fees.reduce((a, f) => a + f.outstanding, 0))}).`, tone: 'warn' })
      ;((await api.getBuses()) as Row[]).filter(b => b.occupied / b.capacity >= 0.9).forEach(b => out.push({ t: `${b.bus_number} is at ${Math.round((b.occupied / b.capacity) * 100)}% capacity.`, tone: 'warn' }))
    }
    return out
  })
}

export function NotificationsPage({ me }: { me: api.Profile }) {
  const q = useAsync(async () => (await api.getNotifications()) as Row[]), al = useAlerts(me), { run } = useUI(), [f, setF] = useState<'all' | 'unread'>('all')
  const unread = (q.data ?? []).filter(n => !n.is_read)
  return <><PageHeader title="Notifications" sub={`${unread.length} unread`} actions={unread.length > 0 && <button className="btn" onClick={() => run(async () => { for (const n of unread) await api.markNotificationRead(n.id) }, 'All marked as read')}>Mark all as read</button>} />
    <Async q={al}>{a => a.length > 0 && <Card title="Needs attention (live, from current records)">{a.map((x, i) => <div key={i} className={'alert ' + (x.tone === 'bad' ? 'bad' : '')}>{x.t}</div>)}</Card>}</Async>
    <div className="tabs">{(['all', 'unread'] as const).map(t => <button key={t} className={'btn' + (f === t ? ' primary' : '')} onClick={() => setF(t)}>{t === 'all' ? 'All' : 'Unread'}</button>)}</div>
    <Async q={q} empty={<Empty title="No notifications" hint="You are all caught up." />}>{list => { const L = list.filter(n => f === 'all' || !n.is_read); return L.length === 0 ? <Empty title="No unread notifications" /> : <>{L.map(n => <div key={n.id} className={'note' + (n.is_read ? '' : ' unread')}><div className="grow"><div style={{ fontWeight: n.is_read ? 400 : 600 }}>{n.message}</div><div className="muted small">{n.when}</div></div>{!n.is_read && <button className="btn sm" onClick={() => run(() => api.markNotificationRead(n.id), 'Marked as read')}>Mark as read</button>}</div>)}</> }}</Async></>
}

export function StudentDetail({ id, role, onClose }: { id: number; role: api.Role; onClose: () => void }) {
  const q = useAsync(async () => {
    const st = ((await api.getStudents()) as Row[]).find(s => s.id === id)!; const [att, subs, marks] = await Promise.all([api.getAttendance(id), api.getSubjects(), api.getMarks(id)])
    const admin = role === 'admin' ? { fee: ((await api.getFees(id)) as Row[])[0], tr: ((await api.getTransportAllocations()) as Row[]).find(a => a.student_id === id) } : {}
    return { st, att: att as Row[], subs: subs as Row[], marks: marks as Row[], ...admin } as Row
  }, [id])
  return <Modal title="Student record" onClose={onClose}><Async q={q}>{d => { const { st, att, subs, marks, fee, tr } = d; return <>
    <KV items={[['Name', st.name], ['Student ID', st.student_code], ['Register no.', st.register_number], ['Email', st.email], ['Phone', st.phone], ['Department', st.departments?.name], ['Batch', st.batch], ['Year / semester', `${st.year} / ${st.semester}`], ['Section', st.section], ['CGPA', st.cgpa], ['Account', <Badge key="a" t={st.account_status} />], ['Verification', <Badge key="v" t={st.verification?.status ?? 'Pending'} />]]} />
    <h2 style={{ marginTop: 18 }}>Attendance</h2>{att.length === 0 ? <p className="muted">No attendance records.</p> : att.map((a: Row) => <Bar key={a.subject_id} label={subs.find((s: Row) => s.id === a.subject_id)?.subject_name} value={a.percentage} warn={a.percentage < 75} />)}
    <h2 style={{ marginTop: 8 }}>Marks</h2>{marks.length === 0 ? <p className="muted">No marks recorded.</p> : <Table head={['Subject', ...EXAMS]} rows={subs.filter((s: Row) => marks.some((m: Row) => m.subject_id === s.id)).map((s: Row) => [s.subject_name, ...EXAMS.map(e => { const m = marks.find((x: Row) => x.subject_id === s.id && x.exam_type === e); return m ? `${m.marks_obtained} (${m.grade})` : '—' })])} />}
    {role === 'admin' && <><h2>Fees &amp; transport</h2><KV items={[['Total', fee ? inr(fee.total_fee) : '—'], ['Paid', fee ? inr(fee.amount_paid) : '—'], ['Outstanding', fee ? inr(fee.outstanding) : '—'], ['Fee status', fee ? <Badge key="f" t={fee.status} /> : '—'], ['Bus', tr ? `${tr.buses?.bus_number} · ${tr.routes?.route_name}` : 'None'], ['Pickup / seat', tr ? `${tr.pickup_point} · seat ${tr.seat_number}` : '—']]} /></>}</> }}</Async></Modal>
}

export function ProfilePage({ me }: { me: api.Profile }) {
  const { toast } = useUI(), [edit, setEdit] = useState(false)
  const q = useAsync(async () => me.role === 'student' ? { st: (await api.getStudents())[0] as Row } : me.role === 'faculty' ? { f: (await api.getMyFaculty(me.user_code)) as Row, deps: (await api.getDepartments()) as Row[], subs: ((await api.getSubjects()) as Row[]) } : {} as Row)
  return <><PageHeader title="Profile" sub="Your details in the shared university record." actions={me.role === 'student' && <button className="btn" onClick={() => setEdit(true)}>Edit contact details</button>} />
    <Async q={q}>{d => <Card>{me.role === 'student' && <><div className="who" style={{ marginBottom: 16 }}><div className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>{d.st.name.split(' ').map((x: string) => x[0]).join('').slice(0, 2)}</div><div><b style={{ fontSize: 16 }}>{d.st.name}</b><div className="muted">{d.st.student_code}</div></div></div>
      <KV items={[['Register no.', d.st.register_number], ['Email', d.st.email], ['Phone', d.st.phone], ['Department', d.st.departments?.name], ['Batch', d.st.batch], ['Year / semester', `${d.st.year} / ${d.st.semester}`], ['Section', d.st.section], ['Date of birth', d.st.date_of_birth ?? '—'], ['CGPA', d.st.cgpa]]} />
      {edit && <FormDialog title="Edit contact details" initial={d.st} fields={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'phone', label: 'Phone', type: 'tel' }]} note="Student ID, register number, department and academic fields can only be changed by staff." onClose={() => setEdit(false)} onSubmit={async v => { await api.updateStudent(d.st.id, { name: v.name, email: v.email, phone: v.phone }); toast('Profile saved') }} />}</>}
      {me.role === 'faculty' && <><div className="who" style={{ marginBottom: 16 }}><div className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>{d.f.name.replace('Dr. ', '').split(' ').map((x: string) => x[0]).join('').slice(0, 2)}</div><div><b style={{ fontSize: 16 }}>{d.f.name}</b><div className="muted">{d.f.designation}</div></div></div>
        <KV items={[['Faculty ID', d.f.faculty_code], ['Email', d.f.email], ['Department', d.deps.find((x: Row) => x.id === d.f.department_id)?.name], ['Status', <Badge key="s" t={d.f.status} />], ['Subjects assigned', d.subs.filter((s: Row) => s.faculty_id === d.f.id).map((s: Row) => s.subject_code).join(', ') || '—']]} /></>}
      {me.role === 'admin' && <><div className="who" style={{ marginBottom: 16 }}><div className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>UA</div><div><b style={{ fontSize: 16 }}>{me.name}</b><div className="muted">System Administrator</div></div></div><KV items={[['Admin ID', me.user_code], ['Role', 'System Administrator'], ['Department', 'University Administration']]} /></>}</Card>}</Async></>
}

export function SettingsPage({ me }: { me: api.Profile }) {
  const theme = useTheme(), { confirm, run } = useUI()
  return <><PageHeader title="Settings" />
    <Card title="Appearance"><div className="actions">{(['light', 'dark'] as const).map(t => <button key={t} className={'btn' + (theme === t ? ' primary' : '')} aria-pressed={theme === t} onClick={() => setTheme(t)}>{t === 'light' ? 'Light' : 'Dark'}</button>)}</div><p className="muted small" style={{ marginTop: 8 }}>Saved in this browser. Current: {getTheme()}.</p></Card>
    <Card title="Account"><KV items={[['Signed in as', `${me.name} (${me.user_code})`], ['Role', me.role]]} /></Card>
    <Card title="About this demo"><p>Smart University is a <b>demonstration application</b>. All records are fictional mock data kept in this browser's local storage — nothing is sent to a server, and data does not sync between browsers or devices. Sign-in is a mock for demos, not production security.</p></Card>
    {me.role === 'admin' && <Card title="Demo data"><p className="muted">Restore every record to the original seed (60 students, 8 faculty, subjects, fees, buses). Your changes will be lost.</p><button className="btn danger" onClick={async () => { if (await confirm({ title: 'Reset all demo changes?', message: 'This restores the original demo dataset and cannot be undone.', okLabel: 'Reset demo data', danger: true })) void run(() => api.resetDemoData(), 'Demo data reset to the original seed') }}>Reset demo data</button></Card>}</>
}
export { gradeOf }
