import { useState } from 'react'
import * as api from '../services'
import { Async, Badge, Bar, Card, Donut, Empty, KV, PageHeader, Select, Stat, Table, avg, gradeOf, inr, useAsync, useUI, type Row } from '../ui'
import { EXAMS, subjAvg, useAlerts, NotificationsPage } from './shared'
import { Link } from './link'

function useMine() {
  return useAsync(async () => {
    const [st] = (await api.getStudents()) as Row[]
    const [fees, att, subs, tr, pays, marks] = await Promise.all([api.getFees(), api.getAttendance(st.id), api.getSubjects(), api.getTransportAllocations(), api.getPayments(st.id), api.getMarks()])
    return { st, fee: (fees as Row[])[0], att: att as Row[], subs: subs as Row[], tr: (tr as Row[])[0], pays: pays as Row[], marks: marks as Row[] }
  })
}
export function StudentDashboard({ me }: { me: api.Profile }) {
  const q = useMine(), al = useAlerts(me), h = new Date().getHours(), g = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return <Async q={q}>{({ st, fee, att, subs, marks }) => { const mine = subs.filter(s => marks.some(m => m.subject_id === s.id)), overall = avg(att.map(a => a.percentage)); return <>
    <PageHeader title={`Good ${g}, ${st.name.split(' ')[0]}`} sub="Here is your university overview." />
    <Async q={al}>{a => a.length > 0 && <Card>{a.map((x, i) => <div key={i} className={'alert ' + (x.tone === 'bad' ? 'bad' : '')}>{x.t}</div>)}</Card>}</Async>
    <div className="grid g-stats"><Stat label="CGPA" value={st.cgpa} hint="out of 10" /><Stat label="Attendance" value={att.length ? overall + '%' : '—'} hint={att.length ? 'across enrolled subjects' : 'no records yet'} /><Stat label="Outstanding fees" value={fee ? inr(fee.outstanding) : '—'} hint={fee?.status} /><Stat label="Verification" value={st.verification?.status ?? '—'} /></div>
    <div className="grid g-2"><Card title="Marks by subject (average %)">{mine.length === 0 ? <p className="muted">No marks recorded yet.</p> : mine.map(s => <Bar key={s.id} label={s.subject_name} value={subjAvg(marks, s.id)} />)}</Card>
      <Card title="Attendance"><div style={{ display: 'grid', placeItems: 'center' }}><Donut value={overall} label="Overall" /></div></Card></div>
    <div className="grid g-3"><Card title="Fee summary">{fee ? <><KV items={[['Total', inr(fee.total_fee)], ['Paid', inr(fee.amount_paid)], ['Outstanding', inr(fee.outstanding)]]} /><p style={{ marginTop: 12 }}><Link to="student/fees" className="btn">View fees</Link></p></> : <p className="muted">No fee record.</p>}</Card>
      <Card title="My subjects">{mine.length === 0 ? <p className="muted">No subject enrolments yet.</p> : <ul className="list">{mine.map(s => <li key={s.id}><span>{s.subject_name}</span><span className="muted">Sem {s.semester}</span></li>)}</ul>}</Card></div></> }}</Async>
}
export function StudentAcademics() {
  const q = useMine(), [semSel, setSem] = useState(0)
  return <><PageHeader title="Academics" sub="Subjects, marks and grades from your shared record." /><Async q={q}>{({ st, subs, marks }) => {
    const enrolled = subs.filter(s => marks.some(m => m.subject_id === s.id)), sems = [...new Set(enrolled.map(s => s.semester))].sort(), sem = sems.includes(semSel) ? semSel : sems.includes(st.semester) ? st.semester : sems[0]
    if (!enrolled.length) return <Empty title="No subject enrolments yet" hint="Your faculty will enrol you in this semester's subjects." />
    const rows = enrolled.filter(s => s.semester === sem)
    return <><div className="toolbar"><Select label="Semester" value={sem} options={sems.map(s => ({ v: s, l: `Semester ${s}` }))} onChange={v => setSem(+v)} /><span className="muted">Current semester: {st.semester} · CGPA {st.cgpa}</span></div>
      <Table head={['Subject', 'Faculty', 'Credits', 'Average', 'Grade']} rows={rows.map(s => { const a = subjAvg(marks, s.id); return [s.subject_name, s.faculty?.name ?? 'Unassigned', s.credits, a + '%', <Badge key="g" t={gradeOf(a)} />] })} />
      <h2>Assessment marks</h2><Table head={['Subject', ...EXAMS]} rows={rows.map(s => [s.subject_name, ...EXAMS.map(e => { const m = marks.find(x => x.subject_id === s.id && x.exam_type === e); return m ? `${m.marks_obtained} (${m.grade})` : '—' })])} /></> }}</Async></>
}
export function StudentAttendance() {
  const q = useMine()
  return <><PageHeader title="Attendance" sub="Calculated from the attendance your faculty has recorded." /><Async q={q} >{({ att, subs }) => att.length === 0 ? <Empty title="No attendance records yet" /> : <>
    {att.filter(a => a.percentage < 75).map(a => <div key={a.subject_id} className="alert bad">Attendance in {subs.find(s => s.id === a.subject_id)?.subject_name} is {a.percentage}%, below the 75% requirement.</div>)}
    <div className="grid g-2"><Card title="Overall"><div style={{ display: 'grid', placeItems: 'center' }}><Donut value={avg(att.map(a => a.percentage))} label="Average across subjects" /></div></Card>
      <Card title="By subject">{att.map(a => <Bar key={a.subject_id} label={`${subs.find(s => s.id === a.subject_id)?.subject_name} (${a.present}/${a.sessions})`} value={a.percentage} warn={a.percentage < 75} />)}</Card></div></>}</Async></>
}
export function StudentFees() {
  const q = useMine(), { confirm, run } = useUI()
  return <><PageHeader title="Fees" sub="Fee summary, breakdown and payment history." /><Async q={q}>{({ st, fee, pays, tr }) => !fee ? <Empty title="No fee record" /> : <>
    <div className="grid g-stats"><Stat label="Total fees" value={inr(fee.total_fee)} /><Stat label="Paid" value={inr(fee.amount_paid)} /><Stat label="Outstanding" value={inr(fee.outstanding)} /><Stat label="Status" value={<Badge t={fee.status} />} /></div>
    <h2>Breakdown</h2><Table head={['Fee', 'Amount']} rows={[['Tuition fee', inr(fee.tuition_fee)], ['Examination fee', inr(fee.exam_fee)], ['Library fee', inr(fee.library_fee)], ['Technology fee', inr(fee.technology_fee)], ['Transport fee', tr ? inr(fee.transport_fee) : 'Not applicable (no bus)'], [<b key="t">Total</b>, <b key="v">{inr(fee.total_fee)}</b>]]} />
    {fee.outstanding > 0 && <p><button className="btn primary" onClick={async () => { if (await confirm({ title: 'Pay outstanding balance?', message: `Record a demo payment of ${inr(fee.outstanding)}. This is a mock payment: no money moves and no gateway is used.`, okLabel: `Pay ${inr(fee.outstanding)}` })) void run(() => api.recordPayment(fee.id, st.id, fee.outstanding), 'Payment recorded (demo)') }}>Pay outstanding (demo)</button></p>}
    <h2>Payment history</h2><Table head={['Date', 'Amount', 'Reference', 'Status']} rows={pays.map(p => [p.payment_date, inr(p.amount), p.transaction_reference, <Badge key="s" t={p.status === 'Paid' ? 'Paid' : p.status} />])} empty="No payments found" /></>}</Async></>
}
export function StudentTransport() {
  const q = useMine()
  return <><PageHeader title="Transport" sub="Your bus allocation (fictional routes, no live tracking)." /><Async q={q}>{({ tr }) => !tr ? <Empty title="No transport allocation" hint="Ask the administration office to assign a bus." /> : <Card>
    <KV items={[['Bus', tr.buses?.bus_number], ['Route', tr.routes?.route_name], ['Pickup point', tr.pickup_point], ['Seat', tr.seat_number], ['Driver', tr.buses?.driver_name], ['Status', <Badge key="s" t="Active" />]]} />
    <p className="muted" style={{ marginTop: 14 }}>{tr.pickup_point} → Campus</p></Card>}</Async></>
}
export function StudentVerification() {
  const q = useMine()
  return <><PageHeader title="Verification" sub="Your record status, as set by the administration office." /><Async q={q}>{({ st }) => { const v = st.verification; return <Card><KV items={[['Overall status', <Badge key="s" t={v?.status ?? 'Pending'} />], ['Last updated', v?.date ?? '—']]} />
    <p className="muted" style={{ marginTop: 12 }}>{v?.status === 'Verified' ? 'Your profile and academic records are verified.' : v?.status === 'Needs Review' ? 'Staff need to review your records. Contact the administration office.' : v?.status === 'Rejected' ? 'Your verification was rejected. Contact the administration office.' : 'Verification is pending. Staff will review your records soon.'}</p></Card> }}</Async></>
}
export const StudentNotifications = NotificationsPage
