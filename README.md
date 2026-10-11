# Smart University — local demo (React + TypeScript, mock data only)

A demonstration university-management app. **No database, no cloud.** All records are fictional and live in one shared store
(`src/store/db.ts`) persisted in your browser's `localStorage`. Every portal reads and writes through `src/services/index.ts`,
which enforces permissions and validation.

## Run it
```
npm install
npm run dev          # then open the printed address (normally http://localhost:5173)
```
Other commands: `npm run build` (type-check + production build) · `npm run test:all` (type-check + service tests + UI tests)

## Demo logins
| Role | ID | Password |
|---|---|---|
| Student | `STU202401` (Priya Sharma) | `student123` |
| Faculty | `FAC001` (Dr. Arun Kumar) | `faculty123` |
| Admin | `ADMIN001` | `admin123` |
(The login page has buttons that fill these in.) Admins can create more students/faculty; the one-time password is shown once and only a salted hash is stored.

## Screens
* **Student:** Dashboard, Profile, Academics, Attendance, Fees, Transport, Verification, Notifications, Settings
* **Faculty:** Dashboard, Subjects (+ detail with enrol/remove), Students, Attendance, Marks, Verification, Reports, Notifications, Profile, Settings
* **Admin:** Dashboard, Students (search, filters, select-all, bulk actions, CSV), Faculty, Departments, Subjects, Academics, Fees, Transport, Verification, Reports, Notifications, Profile, Settings (Reset demo data)

## Behaviour
* A faculty edit (profile, attendance, marks) is saved to the shared store and appears in the student's portal immediately, and after a refresh.
* Attendance %, fee totals/outstanding/status, grades and bus occupancy are always **derived** from stored records.
* Open pages update by themselves when another tab of the same browser saves.
* Light/dark theme is remembered. "Reset demo data" (Admin → Settings) restores the original seed.

## Limits
* `localStorage` is per browser: data does **not** sync between browsers or devices.
* Mock sign-in is for a local demo, not production security.
* Tests run in Node/jsdom (a simulated browser). They do not cover real-browser layout, CSS, or file-download behaviour.

`archive/` holds material that is **not used by the app**: `supabase-optional/` (earlier Supabase schema/seed/Edge Function work, no dependency in `package.json`) and `original-html-prototype/` (the first single-file HTML prototype).
