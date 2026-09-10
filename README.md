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

One project. The Express API and the React (Vite) frontend live in `backend/`
and `frontend/`, but you run and deploy them together — in production the API
process also serves the built frontend from the same origin.

```bash
npm run setup              # installs root + backend + frontend deps

cp backend/.env.example  backend/.env    # set JWT_SECRET; MONGO_URI works as-is
cp frontend/.env.example frontend/.env   # VITE_API_URL=/api (default)

npm run dev                # API :5000 (Atlas) + Vite :5173 (HMR) together
```

Open **http://localhost:5173** — Vite proxies `/api` to the backend, so it's
one origin, no CORS.

| Command | What it does |
|---|---|
| `npm run dev` | API (`nodemon`, uses `MONGO_URI` from `.env`) + frontend (Vite HMR) |
| `npm run dev:local-db` | same, but the API runs a throwaway in-memory MongoDB (no `MONGO_URI` needed; data resets each restart) |
| `npm run build` | builds the frontend into `frontend/dist` |
| `npm start` | **single service** — `NODE_ENV=production`, the API serves `/api` **and** `frontend/dist` on one port (`PORT`, default 5000). Run `npm run build` first. |
| `npm run seed:base` | wipe the DB back to the three starting accounts (confirmation guard) |
| `npm run seed:demo` | wipe + load the bulk demo dataset |

Starting logins (from `backend/.env` — change before a real deployment):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@redbeanhospitality.com` | `Admin@123` |
| Sales Head | `saleshead@redbeanhospitality.com` | `Head@123` |
| Sales Person | `sales@redbeanhospitality.com` | `Sales@123` |

Admin/Manager see Sales Team, Targets and the reports; a Sales Person sees only
their own pipeline plus the company Leaderboard.

## Deployment

Deploy as **one Node web service** (Render, Railway, Fly, a VPS — anything that
runs `npm start`):

- **Build command:** `npm run setup && npm run build`
- **Start command:** `npm start`
- **Env vars:** `MONGO_URI` (Atlas), `JWT_SECRET`, `NODE_ENV=production`,
  `PORT` (the host usually sets this). Leave `CLIENT_URL` unset or point it at
  your own domain. **Don't set the `SEED_*_PASSWORD` vars** once the DB is
  seeded — in production the server refuses to start while any is the `X@123`
  default.
- **MongoDB Atlas:** Network Access → allow `0.0.0.0/0` (cloud hosts have
  dynamic egress IPs).

One URL serves everything. `frontend/.env` stays `VITE_API_URL=/api` — same
origin, no CORS, no proxy.

## Build Phases

This is a large system — it's being built module by module rather than all at once, so each phase is actually verified (installed, built, boot-tested) before the next one starts.

- [x] **Phase 1 — Foundation**: folder structure, Express server, MongoDB connection, `User` model, JWT login/`/me`/logout, role-based route protection (`protect` + `authorize` middleware, frontend `ProtectedRoute`), sidebar/topbar shell, responsive drawer, Tailwind theme, one `/dashboard` route that renders the right view per role.
- [x] **Phase 2 — Sales Team & Leads**: User CRUD (Sales Team page, admin/manager only, with team scoping), profile + change-password (Settings), `Lead` model + full status pipeline, Kanban (native drag-and-drop) + table views, append-only `Remark` timeline, search & filters, `/leads/:id` detail with quick actions.
- [x] **Phase 3 — Calling, Webinar, Event, IFO**: `Call` module (today/overdue worklist, log-call outcomes, follow-up booking), `Webinar` + `Event` modules (registrations/invitees, attendance, RSVP; registering a lead advances its stage), `IfoConversion` module (recording one marks the lead won).
- [x] **Phase 4 — Analytics & Reports**: role-aware Executive/Team/My dashboards (KPI tiles + funnel + trend/revenue charts via Recharts, sales "today's tasks" + target progress), `Target` module (editable per-salesperson monthly grid), Weekly Report (pace vs prorated target, red/amber/green), Monthly Report (target vs actual + CSV & PDF export), Leaderboard (weighted score + badges, company-wide).
- [x] **Phase 5 — Seed data & polish**: an empty boot creates just the three starting accounts (`npm run seed:base` to reset to them). `npm run seed:demo` (or `SEED_DEMO=true`) loads the optional bulk demo dataset — 10 salespeople, ~1k leads, calls, 4 webinars, 4 events, ~180 conversions, targets; activity generated per-salesperson-per-month as a fraction of target so reports show a real red/amber/green spread.
- [x] **Single-service packaging** — one `npm start` serves the API and the built frontend from one Node process / one URL. See **Deployment** above.
