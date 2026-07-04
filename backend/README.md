# AI Website QA Engineer — Backend (Phase 1 MVP)

Prebuilt Node.js/Express backend for the AI Website QA Engineer project.
Implements everything listed in **Phase 1 – Website Analysis (MVP)**:

- Website crawling (internal page discovery)
- Responsive testing (mobile/tablet/desktop screenshots)
- Broken link detection
- Lighthouse reports (performance, accessibility, SEO, best practices)
- Console error detection
- Automatic QA report generation with a scored, categorized issue list

No API key needed — Lighthouse + Puppeteer run locally against the target
website you submit.

## 1. Setup

```bash
cd qa-engineer-backend
npm install
cp .env.example .env
npm start          # or: npm run dev (nodemon, auto-restart)
```

Server starts at `http://localhost:5000`.

> **Note:** `npm install` will download a bundled Chromium for Puppeteer
> (~200MB). This needs an unrestricted internet connection — run it on your
> own machine, not inside a sandboxed environment.

## 2. How it works

1. Frontend calls `POST /api/tests` with a URL → a `Test` record is created
   with `status: "queued"` and pushed onto an in-memory scan queue
   (max 2 concurrent scans by default — tune with `SCAN_CONCURRENCY`).
2. `scanEngine.service.js` runs the pipeline stage by stage, updating
   `currentStage` / `progress` on the Test record as it goes (poll
   `GET /api/tests/:id` or `GET /api/pipeline` to show live progress).
3. When done, the Test record is filled with `score`, `scores` (per
   Lighthouse category), `issues[]`, `brokenLinks[]`, `consoleErrors[]`,
   `screenshots[]`, and a full JSON report is saved to
   `storage/reports/<testId>.json`.

Data is stored in flat JSON files under `data/` (`tests.json`) — no database
setup required. Swap `src/repositories/tests.repository.js` for a real DB
(Postgres/Mongo) later without touching controllers or services.

## 3. API Reference

### Create a scan
```
POST /api/tests
Body: { "url": "https://example.com", "name": "Example prod", "maxPages": 15, "maxDepth": 2 }
→ 201 { id, url, status: "queued", ... }
```

### List scans (for TestsTable / Filters)
```
GET /api/tests?status=passed&search=example
→ 200 [ { id, name, url, status, score, pagesScanned, createdAt, ... }, ... ]
```

### Get one scan / full report (for TestManagementPage detail view)
```
GET /api/tests/:id
→ 200 { ...full test object incl. issues, screenshots, brokenLinks, consoleErrors }
```

### Re-run a scan
```
POST /api/tests/:id/rerun
```

### Delete a scan
```
DELETE /api/tests/:id  → 204
```

### Unresolved issues (for UnresolvedIssues widget)
```
GET /api/tests/:id/issues?resolved=false
→ 200 [ { id, category, severity, title, description, url, suggestion, resolved }, ... ]
```

### Mark an issue resolved
```
PATCH /api/tests/:id/issues/:issueId
Body: { "resolved": true }
```

### Dashboard stats (for StatCard widgets)
```
GET /api/stats
→ 200 { total, passed, failed, running, avgScore, totalIssues, unresolvedIssues, issuesBySeverity }
```

### Live pipeline (for TestPipeline widget)
```
GET /api/pipeline
→ 200 { activeScans: [ { id, name, url, status, progress, currentStage } ], activeCount, pendingCount }
```

### Screenshots
Served statically:
```
GET /screenshots/:testId/mobile.png
GET /screenshots/:testId/tablet.png
GET /screenshots/:testId/desktop.png
```
(paths already returned inside `test.screenshots[]`, e.g. `/screenshots/<id>/mobile.png` —
just prefix with your backend origin on the frontend, e.g. `http://localhost:5000`).

### Health check
```
GET /api/health
```

## 4. Project structure

```
qa-engineer-backend/
├── server.js                  # entry point
├── src/
│   ├── app.js                 # express app + middleware wiring
│   ├── config/config.js       # crawler limits, viewports, lighthouse categories
│   ├── models/test.model.js   # Test object shape
│   ├── repositories/          # JSON file persistence
│   ├── services/
│   │   ├── browser.service.js       # shared Puppeteer instance
│   │   ├── crawler.service.js       # internal link discovery
│   │   ├── linkChecker.service.js   # broken link detection
│   │   ├── responsive.service.js    # mobile/tablet/desktop screenshots
│   │   ├── consoleError.service.js  # browser console + JS error capture
│   │   ├── lighthouse.service.js    # performance/a11y/seo/best-practices audit
│   │   ├── issueDetector.service.js # turns raw findings into scored issues
│   │   ├── scanEngine.service.js    # orchestrates the full pipeline
│   │   └── queue.service.js         # concurrency-limited scan queue
│   ├── controllers/           # request handlers
│   ├── routes/                # express routers
│   └── middleware/errorHandler.js
├── data/tests.json            # auto-created — all test records
└── storage/
    ├── screenshots/<testId>/  # captured PNGs
    └── reports/<testId>.json  # full raw report per scan
```

## 5. Next steps (Phase 2+, not included here)

This backend covers Phase 1 only, matching what you listed. When you're
ready for Phase 2 (visual regression diffing, cross-browser testing via
Playwright, screenshot comparison) or Phase 3 (AI bug prioritization / root
cause analysis / PR generation via an LLM, CI/CD webhooks), those slot in as
new services the same way — say the word and I'll build those on top of this
same structure.

## 6. Connecting your existing frontend (`QA-DASHBOARD`)

Set the API base URL in your Next.js app (e.g. `.env.local`):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
```
Then point `Dashboard.tsx` → `GET /stats` + `GET /pipeline`,
`TestsTable.tsx` / `Filters.tsx` → `GET /tests`,
`NewTestModal.tsx` → `POST /tests`,
`UnresolvedIssues.tsx` → `GET /tests/:id/issues?resolved=false`,
`TestManagementPage.tsx` → `GET /tests/:id`.
