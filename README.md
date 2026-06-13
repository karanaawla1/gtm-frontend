# GTM Decision Tracker — Frontend 📊

> Dashboard UI for the GTM Decision Tracker — a ROI Attribution Engine that helps GTM teams decide whether to SCALE, MAINTAIN, MONITOR, or KILL a decision based on time-decay weighted revenue attribution.

---

## 🎯 What It Does

This is the frontend dashboard that connects to the [GTM Decision Tracker backend](https://github.com/karanaawla1/gtm-decision-tracker) (FastAPI + PostgreSQL + Redis + Celery). It lets users:

- View dashboard stats (total decisions, ROI averages, recommendation breakdowns)
- Add new GTM decisions (hires, ad spend, vendors, tools)
- Link revenue/pipeline/churn outcomes back to decisions
- Run ROI + confidence analysis on any decision
- Bulk-import historical decisions via CSV
- View and delete decisions in a sortable table

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Data Fetching | Native `fetch` against FastAPI REST API |

---

## 🚀 Quick Start (Local)

### 1. Clone & Install
```bash
git clone https://github.com/karanaawla1/gtm-frontend.git
cd gtm-frontend
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the project root:
```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> Set this to wherever your backend is running — local FastAPI server or a deployed backend URL.

### 3. Run the Dev Server
```bash
npm run dev
```

Visit: **http://localhost:3000**

---

## 📱 Pages / Views

| Page | Description |
|---|---|
| **Dashboard** | Overview stats — total decisions, SCALE/KILL counts, average ROI, recent decisions table |
| **Decisions** | Full list of all decisions with ROI, confidence bars, and recommendation badges |
| **Analysis** | Select a decision and view its detailed ROI + confidence breakdown |
| **Add Decision** | Form to log a new GTM decision (type, owner, cost, date, description) |
| **Add Outcome** | Form to link a revenue/pipeline/churn result back to a decision |
| **CSV Upload** | Drag-and-drop bulk import of historical decisions |

---

## 🎨 Design

- Dark theme with gradient accents (indigo/purple)
- Color-coded recommendation badges:
  - 🟢 SCALE — emerald
  - 🔴 KILL — red
  - 🟡 MONITOR — amber
  - 🔵 MAINTAIN — sky blue
- Responsive sidebar navigation (collapses on mobile)
- Confidence and ROI shown as animated progress bars

---

## 🔌 Connecting to the Backend

The frontend talks to the FastAPI backend via these endpoints:

| Action | Endpoint |
|---|---|
| Fetch all decisions | `GET /api/decisions/` |
| Fetch dashboard stats | `GET /api/decisions/summary` |
| Fetch ROI analysis | `GET /api/decisions/{id}/analysis` |
| Create a decision | `POST /api/decisions/` |
| Update a decision | `PATCH /api/decisions/{id}` |
| Delete a decision | `DELETE /api/decisions/{id}` |
| Add an outcome | `POST /api/outcomes/` |
| Upload CSV | `POST /api/decisions/upload-csv` |

All requests use `NEXT_PUBLIC_API_URL` as the base URL — change this in `.env.local` (or your hosting platform's environment variables) to point at the live backend.

---

## 🌐 Live Demo

- **Frontend:** [https://gtm-frontend-production.up.railway.app](https://gtm-frontend-production.up.railway.app)
- **Backend API Docs:** (link to be added once backend is deployed)

---

## 📁 Project Structure

```
gtm-frontend/
├── app/
│   ├── page.tsx          # Main app — all pages/components
│   ├── layout.tsx
│   ├── globals.css
│   └── lib/
│       ├── api.ts          # API helper functions
│       └── utils.ts         # Formatting helpers
├── tailwind.config.ts
├── package.json
└── .env.local
```

---

## 🔗 Related Repository

Backend: [gtm-decision-tracker](https://github.com/karanaawla1/gtm-decision-tracker) — FastAPI + PostgreSQL + Redis + Celery attribution engine
