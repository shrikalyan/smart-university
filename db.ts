// ONE shared mock database. Every portal reads and writes through src/services, which use this store.
// Persistence: localStorage (this browser only; it does NOT sync across browsers or devices).
import { useSyncExternalStore } from 'react'
import seed from '../data/seed.json'

export interface Dept { id: number; code: string; name: string }
export interface Student { id: number; student_code: string; register_number: string; name: string; department_id: number; batch: number; year: number; semester: number; section: string; gender: string; date_of_birth: string | null; phone: string; email: string; cgpa: number; account_status: 'Active' | 'Inactive' }
export interface Faculty { id: number; faculty_code: string; name: string; department_id: number; designation: string; email: string; status: 'Active' | 'On Leave' | 'Inactive' }
export interface Subject { id: number; subject_code: string; subject_name: string; department_id: number; semester: number; credits: number; faculty_id: number | null }
export interface Enrollment { id: number; student_id: number; subject_id: number; semester: number }
export interface Att { student_id: number; subject_id: number; date: string; status: 'P' | 'A' }
export interface Mark { id: number; student_id: number; subject_id: number; exam_type: string; marks_obtained: number; max_marks: number }
export interface Fee { id: number; student_id: number; tuition_fee: number; exam_fee: number; library_fee: number; technology_fee: number }
export interface Payment { id: number; fee_id: number; student_id: number; amount: number; payment_date: string; payment_method: string; transaction_reference: string; status: string }
export interface Route { id: number; route_name: string; origin: string; destination: string; pickup_points: string[] }
export interface Bus { id: number; bus_number: string; capacity: number; driver_name: string; route_id: number; status: string }
export interface Alloc { id: number; student_id: number; bus_id: number; route_id: number; pickup_point: string; seat_number: number }
export interface Ver { student_id: number; status: string; date: string }
export interface Note { id: number; user_code: string; message: string; when: string; is_read: boolean }
export interface Account { code: string; role: 'student' | 'faculty' | 'admin'; name?: string; salt: string; hash: string }
export interface DB { v: number; departments: Dept[]; students: Student[]; faculty: Faculty[]; subjects: Subject[]; enrollments: Enrollment[]; attendance: Att[]; marks: Mark[]; fees: Fee[]; payments: Payment[]; routes: Route[]; buses: Bus[]; allocations: Alloc[]; verification: Ver[]; notifications: Note[]; accounts: Account[]; counters: Record<string, number> }

const KEY = 'su_mock_v2', VERSION = 2

/** Attendance is stored as per-class records; percentages are always derived from them. */
function seedDb(): DB {
  const s = JSON.parse(JSON.stringify(seed)) as DB & { attTargets: [number, number, number][] }
  const base = Date.UTC(2026, 5, 1), attendance: Att[] = []
  for (const [student_id, subject_id, pct] of s.attTargets)
    for (let g = 1; g <= 100; g++) attendance.push({ student_id, subject_id, date: new Date(base + g * 864e5).toISOString().slice(0, 10), status: (g * 37) % 100 < pct ? 'P' : 'A' })
  const { attTargets, ...rest } = s; void attTargets
  return { ...rest, v: VERSION, attendance, counters: {} }
}
function load(): DB {
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw) as DB; if (d.v === VERSION) return d } } catch { /* corrupt or unavailable: fall through to a fresh seed */ }
  const d = seedDb(); try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* storage unavailable: keep in memory */ }
  return d
}
let db: DB = load(), version = 0
const subs = new Set<() => void>()
const notify = () => { version++; subs.forEach(f => f()) }
export const getDb = (): DB => db
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useDbVersion = () => useSyncExternalStore(subscribe, () => version)

/** Copy-on-write: validate + mutate a copy, persist it, and only then publish it. A failed save changes nothing. */
export function commit(fn: (d: DB) => void): void {
  const next = structuredClone(db); fn(next)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { throw new Error('Could not save: browser storage is full or unavailable.') }
  db = next; notify()
}
export function resetDb(): void { try { localStorage.removeItem(KEY) } catch { /* ignore */ } db = seedDb(); try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ } notify() }
/** Another tab of the SAME browser changed the data: adopt it and re-render. */
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { db = JSON.parse(e.newValue) as DB; notify() } catch { /* ignore */ } } })
