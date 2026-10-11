// Mock service layer: the ONLY code that touches the store. Permission and validation checks live here (not just in the UI).
import { commit, getDb, resetDb, subscribe, type DB, type Student } from '../store/db'
export type Role = 'student' | 'faculty' | 'admin'
export interface Profile { id: string; user_code: string; name: string; role: Role }

// ---------- session + mock authentication (NOT production security: hashes live in localStorage) ----------
const SK = 'su_session'; let memSession: string | null = null
const getSession = () => { try { return sessionStorage.getItem(SK) } catch { return memSession } }
const setSession = (c: string | null) => { memSession = c; try { c ? sessionStorage.setItem(SK, c) : sessionStorage.removeItem(SK) } catch { /* ignore */ } }
const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('')
const rand = (n: number) => { const a = new Uint32Array(n); crypto.getRandomValues(a); return [...a].map(x => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join('') }
const profileOf = (d: DB, code: string): Profile | null => {
  const a = d.accounts.find(x => x.code === code); if (!a) return null
  const name = a.role === 'student' ? d.students.find(s => s.student_code === code)?.name : a.role === 'faculty' ? d.faculty.find(f => f.faculty_code === code)?.name : a.name
  return name ? { id: code, user_code: code, name, role: a.role } : null
}
const isInactive = (d: DB, p: Profile) => p.role === 'student' ? d.students.find(s => s.student_code === p.user_code)?.account_status === 'Inactive' : p.role === 'faculty' ? d.faculty.find(f => f.faculty_code === p.user_code)?.status === 'Inactive' : false
export const getCurrentProfile = async (): Promise<Profile | null> => {
  const c = getSession(); if (!c) return null; const d = getDb(), p = profileOf(d, c)
  if (!p || isInactive(d, p)) { setSession(null); if (p) throw new Error('This account is inactive.'); return null }
  return p
}
export const signIn = async (code: string, password: string) => {
  const d = getDb(), c = code.trim().toUpperCase(), a = d.accounts.find(x => x.code === c)
  if (!a || a.hash !== await sha(a.salt + password)) throw new Error('Incorrect ID or password.')
  const p = profileOf(d, c); if (!p) throw new Error('Incorrect ID or password.')
  if (isInactive(d, p)) throw new Error('This account is inactive. Contact the administrator.')
  setSession(c); return p
}
export const signOut = async () => setSession(null)
const me = () => { const c = getSession(), p = c ? profileOf(getDb(), c) : null; if (!p) throw new Error('Please sign in.'); return p }
const need = (...r: Role[]) => { const p = me(); if (!r.includes(p.role)) throw new Error('You do not have permission for that action.'); return p }
const myStudent = (d: DB) => d.students.find(s => s.student_code === me().user_code)
const myFaculty = (d: DB) => d.faculty.find(f => f.faculty_code === me().user_code)
const own = (d: DB, studentId?: number) => { const p = me(); if (p.role === 'student' && studentId !== undefined && myStudent(d)?.id !== studentId) throw new Error('You can only access your own records.'); return p }
const teaches = (d: DB, subjectId: number) => { const p = me(); if (p.role === 'admin') return true; const f = myFaculty(d), s = d.subjects.find(x => x.id === subjectId); return p.role === 'faculty' && !!f && !!s && s.faculty_id === f.id }

// ---------- derived values (never stored) ----------
const transportFee = (d: DB, sid: number) => (d.allocations.some(a => a.student_id === sid) ? 10000 : 0)
const feeRow = (d: DB, f: DB['fees'][number]) => {
  const transport_fee = transportFee(d, f.student_id), total_fee = f.tuition_fee + f.exam_fee + f.library_fee + f.technology_fee + transport_fee
  const amount_paid = d.payments.filter(p => p.fee_id === f.id && p.status === 'Paid').reduce((a, p) => a + p.amount, 0)
  return { ...f, transport_fee, total_fee, amount_paid, outstanding: Math.max(total_fee - amount_paid, 0), status: amount_paid >= total_fee ? 'Paid' : amount_paid === 0 ? 'Pending' : 'Partial' }
}
const grade = (m: number, max: number) => { const p = m * 100 / max; return p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B+' : p >= 60 ? 'B' : p >= 50 ? 'C' : 'F' }
const dept = (d: DB, id: number) => d.departments.find(x => x.id === id)
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/, EXAMS = ['Internal 1', 'Internal 2', 'Assignment', 'Lab', 'Model Exam']

// ---------- reads (students see only their own rows) ----------
export const getDepartments = async () => { me(); return getDb().departments }
export const getStudents = async (f: { q?: string; dept?: number } = {}) => {
  const d = getDb(), p = me(), q = (f.q ?? '').toLowerCase()
  return d.students.filter(s => (p.role !== 'student' || s.student_code === p.user_code) && (!q || [s.name, s.student_code, s.register_number].some(x => x.toLowerCase().includes(q))) && (!f.dept || s.department_id === f.dept))
    .map(s => ({ ...s, departments: dept(d, s.department_id), verification: d.verification.find(v => v.student_id === s.id) ?? null }))
}
export const getStudentById = async (id: number) => (await getStudents()).find(s => s.id === id)
export const getFaculty = async () => { need('admin', 'faculty'); const d = getDb(); return d.faculty.map(f => ({ ...f, departments: dept(d, f.department_id) })) }
export const getMyFaculty = async (code: string) => { const f = getDb().faculty.find(x => x.faculty_code === code); if (!f) throw new Error('Faculty record not found'); return f }
export const getSubjects = async () => { me(); const d = getDb(); return d.subjects.map(s => ({ ...s, faculty: d.faculty.find(f => f.id === s.faculty_id) ?? null })) }
export const getSubjectRoster = async (subjectId: number) => { const d = getDb(); need('faculty', 'admin'); if (!teaches(d, subjectId)) throw new Error('You are not assigned to this subject.'); return d.enrollments.filter(e => e.subject_id === subjectId).map(e => ({ ...e, students: d.students.find(s => s.id === e.student_id)! })) }
export const getAttendance = async (studentId?: number) => {
  const d = getDb(); own(d, studentId); const m = new Map<string, { student_id: number; subject_id: number; sessions: number; present: number }>()
  for (const a of d.attendance) { if (studentId !== undefined && a.student_id !== studentId) continue; const k = a.student_id + ':' + a.subject_id, r = m.get(k) ?? { student_id: a.student_id, subject_id: a.subject_id, sessions: 0, present: 0 }; r.sessions++; if (a.status === 'P') r.present++; m.set(k, r) }
  return [...m.values()].map(r => ({ ...r, percentage: Math.round(1000 * r.present / r.sessions) / 10 }))
}
export const getAttendanceForDate = async (subjectId: number, date: string) => { need('faculty', 'admin'); return getDb().attendance.filter(a => a.subject_id === subjectId && a.date === date) }
export const getMarks = async (studentId?: number, subjectId?: number) => { const d = getDb(); const p = me(); if (p.role === 'student') studentId = myStudent(d)?.id; return d.marks.filter(m => (studentId === undefined || m.student_id === studentId) && (subjectId === undefined || m.subject_id === subjectId)).map(m => ({ ...m, grade: grade(m.marks_obtained, m.max_marks) })) }
export const getFees = async (studentId?: number) => { const d = getDb(), p = me(); if (p.role === 'student') studentId = myStudent(d)?.id; return d.fees.filter(f => studentId === undefined || f.student_id === studentId).map(f => feeRow(d, f)) }
export const getPayments = async (studentId: number) => { const d = getDb(); own(d, studentId); return d.payments.filter(p => p.student_id === studentId) }
export const getTransportAllocations = async () => { const d = getDb(), p = me(), mine = myStudent(d); return d.allocations.filter(a => p.role !== 'student' || a.student_id === mine?.id).map(a => ({ ...a, students: d.students.find(s => s.id === a.student_id), buses: d.buses.find(b => b.id === a.bus_id), routes: d.routes.find(r => r.id === a.route_id) })) }
export const getBuses = async () => { const d = getDb(); me(); return d.buses.map(b => { const occupied = d.allocations.filter(a => a.bus_id === b.id).length; return { bus_id: b.id, bus_number: b.bus_number, route_name: d.routes.find(r => r.id === b.route_id)?.route_name, capacity: b.capacity, occupied, available: b.capacity - occupied, status: b.status } }) }
export const getRoutes = async () => { me(); return getDb().routes }
export const getNotifications = async () => { const c = me().user_code; return getDb().notifications.filter(n => n.user_code === c).sort((a, b) => b.id - a.id) }
export const markNotificationRead = async (id: number) => { const c = me().user_code; if (!getDb().notifications.some(n => n.id === id && n.user_code === c)) throw new Error('Notification not found'); commit(d => { d.notifications.find(n => n.id === id)!.is_read = true }) }

// ---------- student profile edits: field-level permissions ----------
const ALLOWED: Record<Role, string[]> = { student: ['name', 'email', 'phone'], faculty: ['name', 'email', 'phone', 'section', 'semester'], admin: ['name', 'email', 'phone', 'section', 'semester', 'department_id', 'batch', 'year', 'cgpa', 'account_status'] }
export const updateStudent = async (id: number, patch: Partial<Student>) => {
  const p = me(), d0 = getDb(), cur = d0.students.find(s => s.id === id); if (!cur) throw new Error('Student not found')
  if (p.role === 'student' && cur.student_code !== p.user_code) throw new Error('You can only edit your own profile.')
  const bad = Object.keys(patch).filter(k => !ALLOWED[p.role].includes(k)); if (bad.length) throw new Error(`You are not allowed to change: ${bad.join(', ')}`)
  const n = { ...cur, ...patch }
  if (!n.name?.trim()) throw new Error('Name is required'); if (!EMAIL.test(n.email)) throw new Error('Enter a valid email address')
  if (d0.students.some(s => s.id !== id && s.email.toLowerCase() === n.email.toLowerCase())) throw new Error('That email is already used')
  if (!(Number(n.cgpa) >= 0 && Number(n.cgpa) <= 10)) throw new Error('CGPA must be between 0 and 10')
  if (!dept(d0, n.department_id)) throw new Error('Choose an existing department')
  const y = Number(n.year), s = Number(n.semester); if (!(y >= 1 && y <= 4) || s < (y - 1) * 2 + 1 || s > y * 2) throw new Error(`Semester ${s} does not match year ${y}`)
  commit(d => { Object.assign(d.students.find(x => x.id === id)!, { ...patch, name: n.name.trim(), year: y, semester: s, cgpa: Number(n.cgpa) }) })
}
export const enrollStudent = async (subjectId: number, studentId: number) => { const d0 = getDb(); need('faculty', 'admin'); if (!teaches(d0, subjectId)) throw new Error('You are not assigned to this subject.'); const sub = d0.subjects.find(s => s.id === subjectId)!, st = d0.students.find(s => s.id === studentId); if (!st) throw new Error('Student not found'); if (st.semester !== sub.semester) throw new Error(`This subject is for semester ${sub.semester}; the student is in semester ${st.semester}.`); if (d0.enrollments.some(e => e.student_id === studentId && e.subject_id === subjectId)) throw new Error('Already enrolled'); commit(d => { d.enrollments.push({ id: Math.max(0, ...d.enrollments.map(e => e.id)) + 1, student_id: studentId, subject_id: subjectId, semester: sub.semester }) }) }
export const unenrollStudent = async (subjectId: number, studentId: number) => { const d0 = getDb(); need('faculty', 'admin'); if (!teaches(d0, subjectId)) throw new Error('You are not assigned to this subject.'); commit(d => { d.enrollments = d.enrollments.filter(e => !(e.student_id === studentId && e.subject_id === subjectId)); d.attendance = d.attendance.filter(a => !(a.student_id === studentId && a.subject_id === subjectId)); d.marks = d.marks.filter(m => !(m.student_id === studentId && m.subject_id === subjectId)) }) }

// ---------- attendance + marks (faculty: only own subjects and enrolled students) ----------
const enrolled = (d: DB, s: number, sub: number) => d.enrollments.some(e => e.student_id === s && e.subject_id === sub)
export const updateAttendance = async (studentId: number, subjectId: number, date: string, status: 'P' | 'A') => {
  const d0 = getDb(); need('faculty'); if (!teaches(d0, subjectId)) throw new Error('You are not assigned to this subject.'); if (!enrolled(d0, studentId, subjectId)) throw new Error('Student is not enrolled in this subject.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date')
  commit(d => { const r = d.attendance.find(a => a.student_id === studentId && a.subject_id === subjectId && a.date === date); if (r) r.status = status; else d.attendance.push({ student_id: studentId, subject_id: subjectId, date, status }) })
}
export const updateMarks = async (studentId: number, subjectId: number, examType: string, marks: number) => {
  const d0 = getDb(); need('faculty'); if (!teaches(d0, subjectId)) throw new Error('You are not assigned to this subject.'); if (!enrolled(d0, studentId, subjectId)) throw new Error('Student is not enrolled in this subject.'); if (!EXAMS.includes(examType)) throw new Error('Unknown assessment')
  const max = d0.marks.find(m => m.subject_id === subjectId && m.exam_type === examType)?.max_marks ?? 100; if (!Number.isFinite(marks) || marks < 0 || marks > max) throw new Error(`Marks must be between 0 and ${max}`)
  commit(d => { const r = d.marks.find(m => m.student_id === studentId && m.subject_id === subjectId && m.exam_type === examType); if (r) r.marks_obtained = marks; else d.marks.push({ id: Math.max(0, ...d.marks.map(m => m.id)) + 1, student_id: studentId, subject_id: subjectId, exam_type: examType, marks_obtained: marks, max_marks: max }) })
}

// ---------- fees (demo payment, no gateway), transport, verification ----------
export const recordPayment = async (feeId: number, studentId: number, amount: number) => {
  const d0 = getDb(); const p = need('student'); const st = myStudent(d0); if (!st || st.id !== studentId || p.role !== 'student') throw new Error('You can only pay your own fees.')
  const f = d0.fees.find(x => x.id === feeId && x.student_id === studentId); if (!f) throw new Error('Fee record not found'); const out = feeRow(d0, f).outstanding
  if (!(amount > 0) || amount > out) throw new Error(`Amount must be between 1 and ${out}`)
  commit(d => { d.payments.push({ id: Math.max(0, ...d.payments.map(x => x.id)) + 1, fee_id: feeId, student_id: studentId, amount, payment_date: new Date().toISOString().slice(0, 10), payment_method: 'Mock UPI', transaction_reference: 'PAY-' + Date.now(), status: 'Paid' }) })
}
export const assignTransport = async (studentId: number, busId: number, pickup: string, seat?: number) => {
  need('admin'); const d0 = getDb(), b = d0.buses.find(x => x.id === busId); if (!b || !d0.students.some(s => s.id === studentId)) throw new Error('Unknown student or bus')
  const used = d0.allocations.filter(a => a.bus_id === busId && a.student_id !== studentId).map(a => a.seat_number); let s = seat ?? 1; if (!seat) while (used.includes(s)) s++
  if (!(s >= 1 && s <= b.capacity)) throw new Error(`Seat must be between 1 and ${b.capacity}`); if (used.includes(s)) throw new Error(`Seat ${s} is already taken on ${b.bus_number}`)
  if (!pickup.trim()) throw new Error('Pickup point is required')
  commit(d => { const r = d.allocations.find(a => a.student_id === studentId); if (r) Object.assign(r, { bus_id: busId, route_id: b.route_id, pickup_point: pickup.trim(), seat_number: s }); else d.allocations.push({ id: Math.max(0, ...d.allocations.map(a => a.id)) + 1, student_id: studentId, bus_id: busId, route_id: b.route_id, pickup_point: pickup.trim(), seat_number: s }) })
}
export const removeTransport = async (studentId: number) => { need('admin'); commit(d => { d.allocations = d.allocations.filter(a => a.student_id !== studentId) }) }
export const getVerification = async () => { need('admin', 'faculty'); const d = getDb(); return d.verification.map(v => ({ ...v, students: d.students.find(s => s.id === v.student_id) })) }
const VS = ['Verified', 'Pending', 'Needs Review', 'Rejected']
export const updateVerification = async (studentId: number, status: string) => { need('admin', 'faculty'); if (!VS.includes(status)) throw new Error('Invalid status'); commit(d => { const v = d.verification.find(x => x.student_id === studentId); if (!v) throw new Error('Student not found'); v.status = status; v.date = new Date().toISOString().slice(0, 10) }) }
export const bulkSetVerification = async (ids: number[], status: string) => { need('admin'); if (!VS.includes(status)) throw new Error('Invalid status'); commit(d => { d.verification.forEach(v => { if (ids.includes(v.student_id)) { v.status = status; v.date = new Date().toISOString().slice(0, 10) } }) }) }
export const bulkSetAccountStatus = async (ids: number[], status: 'Active' | 'Inactive') => { need('admin'); commit(d => { d.students.forEach(s => { if (ids.includes(s.id)) s.account_status = status }) }) }

// ---------- admin: accounts, faculty, departments (IDs come from counters that never decrease, so they are never reused) ----------
const nextNum = (d: DB, key: string, floor: number) => (d.counters[key] = Math.max(d.counters[key] ?? 0, floor) + 1)
export const createAccount = async (b: { role: 'student' | 'faculty'; name: string; email: string; department_id: number; batch?: number; year?: number; semester?: number; cgpa?: number; designation?: string }) => {
  need('admin'); const d0 = getDb(); const dp = dept(d0, b.department_id)
  if (!b.name?.trim()) throw new Error('Name is required'); if (!EMAIL.test(b.email ?? '')) throw new Error('Enter a valid email address'); if (!dp) throw new Error('Choose an existing department')
  if ([...d0.students, ...d0.faculty].some(x => x.email.toLowerCase() === b.email.toLowerCase())) throw new Error('That email is already used')
  const pw = rand(10), salt = rand(8), hash = await sha(salt + pw); let code = '', reg: string | undefined
  commit(d => {
    if (b.role === 'faculty') { code = 'FAC' + String(nextNum(d, 'fac', Math.max(0, ...d.faculty.map(f => +f.faculty_code.slice(3) || 0)))).padStart(3, '0'); d.faculty.push({ id: Math.max(0, ...d.faculty.map(f => f.id)) + 1, faculty_code: code, name: b.name.trim(), department_id: b.department_id, designation: b.designation ?? 'Assistant Professor', email: b.email, status: 'Active' }) }
    else {
      const batch = Number(b.batch), year = Number(b.year), sem = Number(b.semester), cgpa = Number(b.cgpa ?? 0)
      if (!(batch >= 2000 && batch <= 2100)) throw new Error('Enter a valid batch year'); if (!(year >= 1 && year <= 4) || sem < (year - 1) * 2 + 1 || sem > year * 2) throw new Error('Semester does not match year'); if (!(cgpa >= 0 && cgpa <= 10)) throw new Error('CGPA must be between 0 and 10')
      code = `STU${batch}${String(nextNum(d, 'stu' + batch, Math.max(0, ...d.students.filter(s => s.batch === batch).map(s => +s.student_code.slice(7) || 0)))).padStart(2, '0')}`
      const rp = String(batch).slice(2) + (({ AIML: 'AIM', IT: 'INF' } as Record<string, string>)[dp.code] ?? dp.code.slice(0, 3))
      reg = rp + String(nextNum(d, 'reg' + rp, Math.max(0, ...d.students.filter(s => s.register_number.startsWith(rp)).map(s => +s.register_number.slice(rp.length) || 0)))).padStart(3, '0')
      const id = Math.max(0, ...d.students.map(s => s.id)) + 1
      d.students.push({ id, student_code: code, register_number: reg, name: b.name.trim(), department_id: b.department_id, batch, year, semester: sem, section: 'A', gender: '—', date_of_birth: null, phone: '—', email: b.email, cgpa, account_status: 'Active' })
      d.fees.push({ id: Math.max(0, ...d.fees.map(f => f.id)) + 1, student_id: id, tuition_fee: 60000, exam_fee: 5000, library_fee: 3000, technology_fee: 7000 }); d.verification.push({ student_id: id, status: 'Pending', date: new Date().toISOString().slice(0, 10) })
    }
    d.accounts.push({ code, role: b.role, salt, hash })
    d.notifications.push({ id: Math.max(0, ...d.notifications.map(n => n.id)) + 1, user_code: code, message: 'Welcome to Smart University.', when: 'Just now', is_read: false })
  })
  return { code, register_number: reg, initial_password: pw }   // shown once by the UI; only the salted hash is stored
}
export const updateFaculty = async (id: number, patch: Partial<DB['faculty'][number]>) => { need('admin'); const k = Object.keys(patch).filter(x => !['name', 'email', 'department_id', 'designation', 'status'].includes(x)); if (k.length) throw new Error('Not allowed: ' + k.join(', ')); if (patch.email !== undefined && !EMAIL.test(patch.email)) throw new Error('Enter a valid email address'); if (patch.name !== undefined && !patch.name.trim()) throw new Error('Name is required'); if (patch.department_id !== undefined && !dept(getDb(), patch.department_id)) throw new Error('Choose an existing department'); commit(d => { const f = d.faculty.find(x => x.id === id); if (!f) throw new Error('Faculty not found'); Object.assign(f, patch) }) }
export const createDepartment = async (code: string, name: string) => { need('admin'); const c = code.trim().toUpperCase(); if (!/^[A-Z]{2,6}$/.test(c)) throw new Error('Code must be 2-6 capital letters'); if (!name.trim()) throw new Error('Name is required'); const d0 = getDb(); if (d0.departments.some(x => x.code === c || x.name.toLowerCase() === name.trim().toLowerCase())) throw new Error('Department code or name already exists'); commit(d => { d.departments.push({ id: Math.max(0, ...d.departments.map(x => x.id)) + 1, code: c, name: name.trim() }) }) }
export const updateDepartment = async (id: number, name: string) => { need('admin'); if (!name.trim()) throw new Error('Name is required'); if (getDb().departments.some(x => x.id !== id && x.name.toLowerCase() === name.trim().toLowerCase())) throw new Error('Department name already exists'); commit(d => { const x = d.departments.find(y => y.id === id); if (!x) throw new Error('Department not found'); x.name = name.trim() }) }
export const deleteDepartment = async (id: number) => { need('admin'); const d0 = getDb(), n = d0.students.filter(s => s.department_id === id).length + d0.faculty.filter(f => f.department_id === id).length + d0.subjects.filter(s => s.department_id === id).length; if (n) throw new Error(`Cannot delete: ${n} students, faculty or subjects still belong to it. Reassign them first.`); commit(d => { d.departments = d.departments.filter(x => x.id !== id) }) }

// ---------- admin: subject management (additive) ----------
export interface SubjectInput { subject_code: string; subject_name: string; department_id: number; semester: number; credits: number; faculty_id: number | null }
const checkSubject = (d: DB, s: SubjectInput, selfId?: number) => {
  if (!/^\d{2}[A-Z]{3}\d{3}$/.test(s.subject_code)) throw new Error('Subject code looks like 23CSE305')
  if (d.subjects.some(x => x.subject_code === s.subject_code && x.id !== selfId)) throw new Error('That subject code already exists')
  if (!s.subject_name?.trim()) throw new Error('Subject name is required'); if (!dept(d, s.department_id)) throw new Error('Choose an existing department')
  if (!(s.semester >= 1 && s.semester <= 8)) throw new Error('Semester must be 1-8'); if (!(s.credits >= 1 && s.credits <= 10)) throw new Error('Credits must be 1-10')
  if (s.faculty_id !== null && !d.faculty.some(f => f.id === s.faculty_id && f.status !== 'Inactive')) throw new Error('Choose an active faculty member')
}
export const createSubject = async (s: SubjectInput) => { need('admin'); checkSubject(getDb(), s); commit(d => { d.subjects.push({ id: Math.max(0, ...d.subjects.map(x => x.id)) + 1, ...s, subject_name: s.subject_name.trim() }) }) }
export const updateSubject = async (id: number, s: SubjectInput) => { need('admin'); checkSubject(getDb(), s, id); commit(d => { const x = d.subjects.find(y => y.id === id); if (!x) throw new Error('Subject not found'); Object.assign(x, { ...s, subject_name: s.subject_name.trim() }) }) }
export const deleteSubject = async (id: number) => { need('admin'); const n = getDb().enrollments.filter(e => e.subject_id === id).length; if (n) throw new Error(`Cannot delete: ${n} students are enrolled. Remove their enrollment first.`); commit(d => { d.subjects = d.subjects.filter(x => x.id !== id) }) }
export const resetDemoData = async () => { need('admin'); resetDb() }
/** Re-render hook: fires after any change, including changes from another tab of this browser. */
export const subscribeToChanges = (_tables: string[], cb: () => void) => subscribe(cb)
