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

## Notes

- Data persists in flat JSON files (`backend/data/tests.json`) — no DB setup
  needed. Swap `backend/src/repositories/tests.repository.js` for a real DB
  later without touching controllers/services.
- Screenshots are served by the backend at `/screenshots/:testId/:viewport.png`
  and rendered directly in the report modal.
- If a scan fails to connect, the sidebar shows a **Backend offline**
  indicator so it's obvious what to check.
