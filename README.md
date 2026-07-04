# AI Website QA Engineer

Full project: **backend** (Node/Express + Puppeteer + Lighthouse) + **frontend**
(your existing `qa-dashboard` Next.js app, now wired to real data with live
progress, animations, and a working test report view).

```
ai-website-qa-engineer/
├── backend/     # Phase 1 MVP QA scanning API (see backend/README.md)
└── frontend/    # qa-dashboard Next.js app (now fully wired to the backend)
```

## Quick start

**1. Start the backend** (in one terminal):
```bash
cd backend
npm install
cp .env.example .env
npm start
```
Runs at `http://localhost:5000`. First `npm install` downloads a bundled
Chromium for Puppeteer (~200MB) — needs a normal internet connection.

**2. Start the frontend** (in a second terminal):
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
Runs at `http://localhost:3000`.

Open `http://localhost:3000`, click **Run New Test**, enter a URL, and watch
the scan run live — pipeline steps animate in real time, and when it's done
you get a full report: overall + Lighthouse category scores, responsive
screenshots, broken links, console errors, and a resolvable issue list.

## What changed in the frontend

The dashboard you built (`Dashboard.tsx`, `TestManagementPage.tsx`,
`ReportsPage.tsx`, `TestsTable`, `StatCard`, `TestPipeline`,
`UnresolvedIssues`, `StatsGrid`, `TrendsAndSeverity`, `ReportsTable`, the
"Run New Test" modal, etc.) was all hardcoded/dummy data with no backend
call. It's now wired to the real API end-to-end:

- **`src/lib/api.ts`** — typed API client for every backend endpoint.
- **`src/context/QADataContext.tsx`** — single source of truth: fetches
  tests/stats/pipeline, polls every 3s while a scan is running (12s
  otherwise), exposes `createTest`, `rerunTest`, `deleteTest`, `updateIssue`.
- **`src/context/ReportModalContext.tsx`** + **`ReportDetailModal.tsx`** —
  this is the actual "test report" screen: animated score gauges, per-category
  Lighthouse breakdown, responsive screenshots, a live progress bar while a
  scan is running, and a resolve/reopen toggle per issue. Opens from
  "View Report" / "Watch live" / "Inspect" anywhere in the app.
- **`src/context/NewTestModalContext.tsx`** + **`ToastContext.tsx`** — the
  "Run New Test" button (sidebar, header, or Test Management page) opens one
  shared modal that actually calls `POST /api/tests`, shows inline errors if
  the backend is unreachable, and toasts on success/failure.
- **Filters, search, sort, and pagination** on the Tests table are now real
  (client-side, driven by the live test list).
- **Reports page**: stat cards, severity distribution, and the reports table
  all read from `/api/stats` and the real test list. The old severity/trend
  panel used fabricated numbers with no backing data source — replaced with
  a real animated average-score gauge, since the backend doesn't (yet) store
  historical time-series. CSV export is now real, built from live data.
- **Bug fixes**: `Layout.tsx` was receiving an `onNewTestClick` prop it never
  declared (would've been a build error) — fixed and wired to the shared
  modal. The Phosphor **icon font was never actually loaded** anywhere, so
  every `<i className="ph ph-*">` icon in the app was invisible — added the
  `@phosphor-icons/web` stylesheet in `layout.tsx`. `animate-fade-in`,
  `animate-fade-in-up`, `skeleton`, and `invisible-scrollbar` classes were
  used throughout but never defined — added real `@keyframes` for all of
  them in `globals.css`.
- **Animations** (via `framer-motion` + a few CSS keyframes): modals spring
  in/out, table rows and issue cards stagger in, stat numbers count up,
  pipeline steps pulse while active, score gauges sweep in on an SVG stroke
  animation, toasts slide in, skeleton loaders shimmer while data loads.

## Notes

- Data persists in flat JSON files (`backend/data/tests.json`) — no DB setup
  needed. Swap `backend/src/repositories/tests.repository.js` for a real DB
  later without touching controllers/services.
- Screenshots are served by the backend at `/screenshots/:testId/:viewport.png`
  and rendered directly in the report modal.
- If a scan fails to connect, the sidebar shows a **Backend offline**
  indicator so it's obvious what to check.
