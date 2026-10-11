import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useDbVersion } from './store/db'
export const useDbVersionSafe = useDbVersion

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any
export const inr = (n: number) => '₹' + Number(n).toLocaleString('en-IN')
export const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0)
export const gradeOf = (m: number) => (m >= 90 ? 'A+' : m >= 80 ? 'A' : m >= 70 ? 'B+' : m >= 60 ? 'B' : m >= 50 ? 'C' : 'F')
export const initials = (n: string) => n.replace('Dr. ', '').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()

const P: Record<string, string> = { home: 'M3 11l9-8 9 8M5 10v10h14V10', user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0', book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5', cal: 'M5 4h14v16H5zM5 9h14M9 2v4M15 2v4', wallet: 'M3 7h17v13H3zM3 7l3-3h12M16 13h2', bus: 'M5 4h14v14H5zM5 12h14M8 21v-3M16 21v-3', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', bell: 'M6 16v-5a6 6 0 1112 0v5l2 2H4zM10 21h4', gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2', chart: 'M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3', users: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20a7 7 0 0114 0M17 5a3.5 3.5 0 010 6M22 20a7 7 0 00-4-6', building: 'M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2', lib: 'M4 4h4v16H4zM10 4h4v16h-4zM16 6l4-1 2 14-4 1z', pen: 'M4 20l4-1L19 8l-3-3L5 16z', menu: 'M4 6h16M4 12h16M4 18h16', x: 'M6 6l12 12M18 6L6 18', sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5', moon: 'M20 14A8 8 0 1110 4a7 7 0 0010 10z', plus: 'M12 5v14M5 12h14', out: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9' }
export const Icon = ({ n, size = 18 }: { n: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n] ?? P.home} /></svg>

// ---- theme (a harmless UI preference, the only thing besides the data store kept in localStorage)
export const getTheme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
export const setTheme = (t: 'light' | 'dark') => { document.documentElement.dataset.theme = t; try { localStorage.setItem('su_theme', t) } catch { /* ignore */ } window.dispatchEvent(new Event('themechange')) }
export const useTheme = () => { const [t, set] = useState(getTheme()); useEffect(() => { const f = () => set(getTheme()); window.addEventListener('themechange', f); return () => window.removeEventListener('themechange', f) }, []); return t }

// ---- hash router: #/role/page/arg
export const useRoute = () => { const [h, setH] = useState(location.hash); useEffect(() => { const f = () => setH(location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, []); return h.replace(/^#\/?/, '').split('/').filter(Boolean) }
export const go = (p: string) => { location.hash = '#/' + p }

// ---- data loading: re-runs when the shared store changes (this tab, or another tab of the same browser)
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const ver = useDbVersion(), [s, set] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  const run = useCallback(() => { fn().then(data => set({ data, loading: false }), e => set({ error: (e as Error).message, loading: false })) }, [ver, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(run, [run])
  return { ...s, reload: run }
}
type Q<T> = { data?: T; error?: string; loading: boolean; reload: () => void }
export function Async<T>({ q, children, empty }: { q: Q<T>; children: (d: T) => ReactNode; empty?: ReactNode }) {
  if (q.error) return <div className="card"><p className="err" role="alert">Unable to load data: {q.error}</p><button className="btn" onClick={q.reload}>Retry</button></div>
  if (q.loading && q.data === undefined) return <div aria-busy="true" aria-label="Loading"><div className="skeleton" /><div className="skeleton" /></div>
  if (Array.isArray(q.data) && q.data.length === 0 && empty !== undefined) return <>{typeof empty === 'string' ? <Empty title={empty} /> : empty}</>
  return <>{children(q.data as T)}</>
}
export const Empty = ({ title, hint }: { title: string; hint?: string }) => <div className="card empty"><b>{title}</b>{hint}</div>
export const PageHeader = ({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) => <div className="page-head"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>{actions && <div className="actions">{actions}</div>}</div>
export const Card = ({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) => <section className={'card ' + className}>{title && <h2>{title}</h2>}{children}</section>
export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) => <div className="card"><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{hint && <div className="stat-hint">{hint}</div>}</div>
const TONE: Record<string, string> = { Verified: 'ok', Active: 'ok', Paid: 'ok', 'Good Standing': 'ok', Success: 'ok', Pending: 'warn', Partial: 'warn', 'On Leave': 'warn', 'Needs Review': 'bad', Inactive: 'bad', Rejected: 'bad', 'Needs Attention': 'bad' }
export const Badge = ({ t }: { t: string }) => <span className={'badge ' + (TONE[t] ?? '')}>{t}</span>
export function Table({ head, rows, empty = 'No matching records' }: { head: ReactNode[]; rows: ReactNode[][]; empty?: string }) {
  return <div className="table-wrap"><table><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>) : <tr><td colSpan={head.length} className="empty-cell">{empty}</td></tr>}</tbody></table></div>
}
export const Bar = ({ label, value, max = 100, text, warn }: { label: ReactNode; value: number; max?: number; text?: string; warn?: boolean }) => <div className="bar-row"><div className="bar-top"><span>{label}</span><span className={warn ? 'err' : ''}>{text ?? value + '%'}</span></div><div className="bar-track"><div className={'bar-fill' + (warn ? ' warn' : '')} style={{ width: `${Math.max(0, Math.min(100, max ? (value / max) * 100 : 0))}%` }} /></div></div>
export const Donut = ({ value, label }: { value: number; label?: string }) => { const c = 2 * Math.PI * 42, v = Math.max(0, Math.min(100, value)); return <div style={{ textAlign: 'center' }}><svg viewBox="0 0 100 100" width="130" height="130" role="img" aria-label={`${v}%`}><circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" style={{ stroke: 'var(--bg)' }} /><circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 50 50)" style={{ stroke: 'var(--accent)' }} /><text x="50" y="55" textAnchor="middle" fontSize="18" fontWeight="650" style={{ fill: 'var(--text)' }}>{v}%</text></svg>{label && <div className="muted small">{label}</div>}</div> }
export const KV = ({ items }: { items: [string, ReactNode][] }) => <dl className="kv">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
export const Select = ({ value, options, onChange, label }: { value: string | number; options: { v: string | number; l: string }[]; onChange: (v: string) => void; label: string }) => <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select>

// ---- dialogs, toasts, confirmations
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [onClose])
  return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><div className="dialog" role="dialog" aria-modal="true" aria-label={title}><div className="dialog-head"><h3>{title}</h3><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><Icon n="x" /></button></div><div className="dialog-body">{children}</div></div></div>
}
export interface Field { key: string; label: string; type?: 'text' | 'email' | 'tel' | 'number' | 'select'; options?: { v: string | number; l: string }[]; step?: number; wide?: boolean }
/** Form dialog: validation errors from the service show inline and the typed values are kept. */
export function FormDialog({ title, fields, initial, submitLabel = 'Save', note, onSubmit, onClose }: { title: string; fields: Field[]; initial: Row; submitLabel?: string; note?: string; onSubmit: (v: Row) => Promise<unknown>; onClose: () => void }) {
  const [v, setV] = useState<Row>(initial), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (busy) return; setBusy(true); setErr(''); try { await onSubmit(v); onClose() } catch (x) { setErr((x as Error).message) } finally { setBusy(false) } }
  return <Modal title={title} onClose={onClose}><form className="form" onSubmit={submit} noValidate>
    {fields.map(f => <label key={f.key} className={'field' + (f.wide ? ' wide' : '')}><span>{f.label}</span>{f.type === 'select' ? <select aria-label={f.label} value={String(v[f.key] ?? '')} onChange={e => setV({ ...v, [f.key]: e.target.value })}>{f.options!.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select> : <input aria-label={f.label} type={f.type ?? 'text'} step={f.step} value={v[f.key] ?? ''} onChange={e => setV({ ...v, [f.key]: e.target.value })} />}</label>)}
    {note && <p className="muted small wide">{note}</p>}{err && <p className="form-err" role="alert">{err}</p>}
    <div className="dialog-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button></div></form></Modal>
}
interface UIApi { toast: (t: string, kind?: 'ok' | 'err') => void; confirm: (o: { title: string; message: string; okLabel?: string; danger?: boolean }) => Promise<boolean>; run: (fn: () => Promise<unknown>, ok: string) => Promise<boolean> }
const Ctx = createContext<UIApi>(null as never)
export const useUI = () => useContext(Ctx)
export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setT] = useState<{ id: number; t: string; kind: string }[]>([]), [cf, setCf] = useState<{ o: Parameters<UIApi['confirm']>[0]; res: (b: boolean) => void } | null>(null), n = useRef(0)
  const toast = useCallback((t: string, kind: 'ok' | 'err' = 'ok') => { const id = ++n.current; setT(x => [...x, { id, t, kind }]); setTimeout(() => setT(x => x.filter(y => y.id !== id)), 4500) }, [])
  const confirm = useCallback((o: Parameters<UIApi['confirm']>[0]) => new Promise<boolean>(res => setCf({ o, res })), [])
  const run = useCallback(async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); return true } catch (e) { toast((e as Error).message, 'err'); return false } }, [toast])
  const close = (b: boolean) => { cf?.res(b); setCf(null) }
  return <Ctx.Provider value={{ toast, confirm, run }}>{children}
    <div className="toasts" aria-live="polite">{toasts.map(t => <div key={t.id} className={'toast' + (t.kind === 'err' ? ' err' : '')} role={t.kind === 'err' ? 'alert' : 'status'}>{t.t}</div>)}</div>
    {cf && <Modal title={cf.o.title} onClose={() => close(false)}><p>{cf.o.message}</p><div className="dialog-foot"><button className="btn" onClick={() => close(false)}>Cancel</button><button className={'btn ' + (cf.o.danger ? 'danger' : 'primary')} onClick={() => close(true)}>{cf.o.okLabel ?? 'Confirm'}</button></div></Modal>}</Ctx.Provider>
}
export function Credentials({ rows, onClose }: { rows: [string, string][]; onClose: () => void }) {
  return <Modal title="Account created" onClose={onClose}><KV items={rows} /><p className="alert info" style={{ marginTop: 14 }}>The initial password is shown only now and is not stored. Share it securely.</p>
    <div className="dialog-foot"><button className="btn" onClick={() => { try { void navigator.clipboard.writeText(rows.map(r => r.join(': ')).join('\n')) } catch { /* ignore */ } }}>Copy</button><button className="btn primary" onClick={onClose}>Done</button></div></Modal>
}
export function download(name: string, text: string, type = 'text/csv') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click() }
export const csvOf = (rows: unknown[][]) => rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
