# GTM Decision Tracker — Frontend

> Dashboard UI for the GTM Decision Tracker. Lets GTM teams log decisions, attach revenue outcomes, and view automated ROI + recommendations (SCALE / MAINTAIN / MONITOR / KILL).

**Live app:** "https://gtm-frontend-production.up.railway.app"

---

## Tech Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** — styling
- **Railway** — deployment

---

## Quick Start

```bash
git clone https://github.com/karanaawla1/gtm-frontend.git
cd gtm-frontend
npm install
```

Create a `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Run the dev server:
```bash
npm run dev
```

Open `http://localhost:3000`

---

## Pages / Features

| Page | Description |
|---|---|
| Dashboard | Overview stats — total decisions, scale-worthy count, decisions needing action, average ROI, recent decisions table |
| Decisions | Full list of decisions with type, owner, cost, ROI, confidence, recommendation |
| Analysis | Pick a decision and view its ROI, confidence, outcome count, and recommendation explanation |
| Add Decision | Form to log a new GTM decision (type, owner, cost, date, description) |
| Add Outcome | Form to link a revenue/pipeline/churn outcome to an existing decision |
| CSV Upload | Bulk-import decisions via CSV |

---

## Project Structure

```
app/
├── page.tsx          # Main app — all pages and components in one file
├── layout.tsx        # Root layout
└── globals.css       # Tailwind + global styles
```

---

<br>

# 📖 Detailed Documentation

## What This App Does

GTM teams spend money on hires, ads, vendors, and tools — but rarely know which decisions actually drove revenue. This dashboard lets a team:

1. Log a **decision** (what was spent, by whom, when)
2. Log **outcomes** (revenue/pipeline that followed)
3. See an automatic **ROI + recommendation** per decision, calculated by the backend's time-decay attribution engine

## Recommendation Badges

| Badge | Meaning |
|---|---|
| 🚀 SCALE | ROI > 3x, high confidence — invest more |
| 🔴 KILL | ROI < 0.5x, high confidence — stop this spend |
| 👀 MONITOR | Not enough data yet — add more outcomes |
| ✅ MAINTAIN | Performing as expected |
| ⚪ NO_DATA | No outcomes linked yet |

## How the Frontend Talks to the Backend

All API calls go through `process.env.NEXT_PUBLIC_API_URL`. Set this to:
- `http://localhost:8000` for local development (backend running via `uvicorn`)
- The Railway backend URL (e.g. `https://gtm-decision-tracker-production.up.railway.app`) for production

The backend has CORS enabled (`allow_origins=["*"]` in `app/main.py`) so the frontend can call it cross-origin.

## API Calls Used

| Frontend action | Backend endpoint |
|---|---|
| Load dashboard stats | `GET /api/decisions/summary` |
| Load decisions list | `GET /api/decisions/` |
| Load ROI for a decision | `GET /api/decisions/{id}/analysis` |
| Create decision | `POST /api/decisions/` |
| Delete decision | `DELETE /api/decisions/{id}` |
| Add outcome | `POST /api/outcomes/` |
| Upload CSV | `POST /api/decisions/upload-csv` |

> ⚠️ **Note:** `GET /api/decisions/` now returns a paginated object `{ items: [...], pagination: {...} }` instead of a plain array. If you've recently updated the backend, make sure `getDecisions()` reads `data.items` instead of treating the response as an array directly — otherwise list rendering will break.

## Adding a Decision — Required Fields

- `type` — one of `hire`, `ad_spend`, `vendor`, `tool`
- `owner` — team or person responsible
- `cost_amount` — number (USD)
- `date` — ISO date
- `description` — optional free text

## Adding an Outcome — Required Fields

- `decision_id` — UUID of the decision (from the decisions list)
- `metric_type` — one of `revenue`, `pipeline`, `churn`
- `value` — number
- `date` — ISO date
- `source` — usually `manual`

## CSV Upload Format

```csv
type,date,owner,cost_amount,description
hire,2024-01-10,Sales Team,75000,SDR hire for outbound pipeline
ad_spend,2024-01-15,Marketing,40000,LinkedIn Ads Q1 campaign
```

CSV upload only creates **decisions**. Outcomes must be added separately afterward through the Add Outcome page for ROI to show up.

## Deployment

Deployed on Railway, connected to the backend via the `NEXT_PUBLIC_API_URL` environment variable. Any change to this variable requires a redeploy.

## Links

- Backend API docs (Swagger): "https://gtm-decision-tracker-production.up.railway.app/docs"
- Backend repo: "https://github.com/karanaawla1/gtm-decision-tracker"
