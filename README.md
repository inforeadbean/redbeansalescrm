# RBH Sales CRM

A production CRM for **Red Bean Hospitality** covering the full sales funnel: Lead → Call → Webinar → Event → IFO (Independent Food Operator) Conversion.

## Tech Stack

| Layer     | Choice |
|-----------|--------|
| Frontend  | React 18 (Vite), Tailwind CSS, React Router DOM, React Hook Form, Axios, Recharts, React Icons |
| Backend   | Node.js, Express.js, JWT auth |
| Database  | MongoDB + Mongoose |
| Password hashing | **bcryptjs** (pure JS) instead of `bcrypt` — same API, but has no native module to compile, so `npm install` never needs Windows build tools. Swap for `bcrypt` later if you deploy somewhere with a build toolchain and want the native version. |

## Folder Structure

```
Sales CRM/
├── backend/
│   ├── config/        # DB connection
│   ├── controllers/    # Route handler logic
│   ├── middleware/     # auth (JWT), error handling
│   ├── models/         # Mongoose schemas
│   ├── routes/         # Express routers
│   ├── seed/           # one-time / bulk data seed scripts
│   ├── utils/          # asyncHandler, generateToken
│   └── server.js
└── frontend/
    └── src/
        ├── components/  # Sidebar, Topbar, ProtectedRoute, ...
        ├── context/     # AuthContext
        ├── layouts/     # AuthLayout, DashboardLayout
        ├── pages/       # one folder per role where useful (admin/, manager/, sales/)
        ├── services/    # api.js (axios) + one file per resource
        └── utils/       # roles.js, calculations.js, etc.
```

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # then set JWT_SECRET (MONGO_URI already works out of the box)
npm run dev            # starts on http://localhost:5000
```

**No MongoDB install needed.** `npm run dev` runs an embedded MongoDB (via
`mongodb-memory-server`) on port 27017 whose data dir is **`backend/.mongo-data/`
— persistent**. Everything you enter survives nodemon restarts, `npm run dev`
restarts and machine reboots. It's never wiped automatically. On the first empty
boot it creates the **three starting accounts** and nothing else.

To use a full MongoDB server instead, point `MONGO_URI` at a local `mongod` or a
MongoDB Atlas cluster.

Other scripts:
- `npm run seed:base` — **DELETES all data**, resets to the three starting
  accounts. Asks for confirmation if the DB has real data (`CONFIRM_WIPE=yes npm run seed:base` to skip).
- `npm run seed:demo` — **DELETES all data**, loads the bulk demo dataset (10
  salespeople, ~1k leads, conversions) while keeping the 3 accounts. Same
  confirmation guard.
- `npm run seed:admin` — just the admin login (no wipe)
- `npm run dev:bare` — `nodemon server.js` with no managed DB

Starting logins (from `.env` — change before a real deployment):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@redbeanhospitality.com` | `Admin@123` |
| Sales Head | `saleshead@redbeanhospitality.com` | `Head@123` |
| Sales Person | `sales@redbeanhospitality.com` | `Sales@123` |

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL — default already points at localhost:5000
npm run dev             # starts on http://localhost:5173
```

Log in with any account from the list above. Admin/Manager see Sales Team,
Targets and the Weekly/Monthly reports; a Sales Person sees only their own
pipeline plus the company Leaderboard.

## Build Phases

This is a large system — it's being built module by module rather than all at once, so each phase is actually verified (installed, built, boot-tested) before the next one starts.

- [x] **Phase 1 — Foundation**: folder structure, Express server, MongoDB connection, `User` model, JWT login/`/me`/logout, role-based route protection (`protect` + `authorize` middleware, frontend `ProtectedRoute`), sidebar/topbar shell, responsive drawer, Tailwind theme, one `/dashboard` route that renders the right view per role.
- [x] **Phase 2 — Sales Team & Leads**: User CRUD (Sales Team page, admin/manager only, with team scoping), profile + change-password (Settings), `Lead` model + full status pipeline, Kanban (native drag-and-drop) + table views, append-only `Remark` timeline, search & filters, `/leads/:id` detail with quick actions.
- [x] **Phase 3 — Calling, Webinar, Event, IFO**: `Call` module (today/overdue worklist, log-call outcomes, follow-up booking), `Webinar` + `Event` modules (registrations/invitees, attendance, RSVP; registering a lead advances its stage), `IfoConversion` module (recording one marks the lead won).
- [x] **Phase 4 — Analytics & Reports**: role-aware Executive/Team/My dashboards (KPI tiles + funnel + trend/revenue charts via Recharts, sales "today's tasks" + target progress), `Target` module (editable per-salesperson monthly grid), Weekly Report (pace vs prorated target, red/amber/green), Monthly Report (target vs actual + CSV & PDF export), Leaderboard (weighted score + badges, company-wide).
- [x] **Phase 5 — Seed data & polish**: an empty boot creates just the three starting accounts (`npm run seed:base` to reset to them). `npm run seed:demo` (or `SEED_DEMO=true`) loads the optional bulk demo dataset — 10 salespeople, ~1k leads, calls, 4 webinars, 4 events, ~180 conversions, targets; activity generated per-salesperson-per-month as a fraction of target so reports show a real red/amber/green spread.
- [ ] **Deployment** — Vercel (frontend) + Render (backend) + Atlas. Not wired up.

## Deployment (once feature-complete)

Consistent with Red Bean Hospitality's other internal tools (HRMS, SmartCounter): **Vercel** for the frontend, **Render** for the backend (MongoDB Atlas for the database). Not wired up yet — comes in Phase 5.
