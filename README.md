# Outreach Agent V3

> **Personal AI Recruiter Assistant** — Generate interviews for Adarsh.

A fully automated outreach platform built with **React + TypeScript**, **Express**, **Google Gemini**, **Firebase Firestore**, and **Vite**. One goal: book interviews.

---

## 🎯 What This Does

| Step | Action | Who |
|---|---|---|
| 1 | Login with Google | You |
| 2 | Upload Resume (PDF/DOCX) | You |
| 3 | Import Contacts CSV | You |
| 4 | Start Campaign | You |
| 5 | Research companies, score contacts, generate emails | AI |
| 6 | Schedule + send emails (human-like timing) | Automated |
| 7 | Track replies, detect interviews | Automated |
| 8 | Send daily report to Gmail | Automated |

---

## ✨ Feature Overview

| Feature | Description |
|---|---|
| **Dark Sidebar Navigation** | 7 sections: Dashboard, Resume, Contacts, Campaigns, Pipeline, Reports, Settings |
| **Resume Parser** | Upload PDF/DOCX → Gemini extracts skills, projects, experience, achievements, cloud & AI expertise |
| **Contact Import** | 20-field CSV import with template download; required + recommended + advanced fields |
| **Company Enrichment** | Gemini researches each company → stored in `companyResearch` Firestore collection |
| **Outreach Opportunity Score** | Rule-based 0–100 score: tech match, role, priority, hiring signals, growth, personalization data |
| **Campaign Builder** | Select resume + contacts + daily limit → 5-step AI launch (Parse → Enrich → Score → Generate → Queue) |
| **Email Generation** | Gemini writes <130-word emails mentioning company, project, tech, role, CTA — no generics |
| **Human-Like Scheduler** | 09:00–18:00 weekdays, 120–240 min random delays, 8–12 emails/day |
| **Gmail Integration** | OAuth send via `POST /api/gmail/send` with stored `gmailMessageId` |
| **9-Stage Pipeline** | Unreached → Queued → Sent → Follow Up 1/2 → Replied → Interview → Rejected → Archived |
| **Automatic Follow-Ups** | FU#1 at Day 5, FU#2 at Day 7, auto-archive at Day 14 |
| **Reply Classification** | Gemini detects: Positive, Interview Request, Assessment, Rejection, Out of Office |
| **Daily Reports** | AI-generated daily summary with metrics, highlights, top opportunities |
| **Settings** | Gmail status, daily limit, scheduler delays, follow-up timeline visualizer |

---

## 🏗️ Project Structure

```
outreach/
├── server/                         # Express backend
│   ├── index.ts                    # Entry point — registers all routes
│   ├── config.ts                   # Centralized env config
│   ├── routes/
│   │   ├── health.ts               # GET /api/health
│   │   ├── resume.ts               # POST /api/resume/analyze, /parse-document
│   │   ├── campaign.ts             # POST /api/campaign/create, /score-contact, /enrich-contact, /build-queue
│   │   ├── outreach.ts             # POST /api/outreach/generate
│   │   ├── reports.ts              # POST /api/reports/generate, /classify-reply
│   │   ├── gmail.ts                # POST /api/gmail/send
│   │   ├── job.ts                  # POST /api/job/match (legacy)
│   │   └── scraper.ts              # POST /api/scrape/url
│   └── services/
│       ├── gemini.ts               # Gemini AI singleton (server-side only)
│       └── document-parser.ts      # PDF/DOCX/TXT parser
│
├── src/                            # React frontend
│   ├── App.tsx                     # Root — sidebar layout, all 7 sections
│   ├── types.ts                    # All V3 TypeScript interfaces
│   ├── index.css                   # Design system (dark sidebar vars, animations)
│   ├── hooks/
│   │   ├── useAuth.ts              # Firebase auth + Gmail OAuth scopes
│   │   ├── useFirestoreSync.ts     # 8-collection Firestore live sync + CRUD
│   │   └── useCampaign.ts          # 5-step campaign orchestration hook
│   ├── services/
│   │   └── api.ts                  # Type-safe API client (12 methods)
│   ├── components/
│   │   ├── Sidebar.tsx             # Collapsible dark sidebar, 7 nav items, badges
│   │   ├── DashboardSection.tsx    # 6 stat cards, campaign bars, activity feed
│   │   ├── ResumeSection.tsx       # PDF/DOCX upload + Gemini analysis
│   │   ├── ContactsV2Section.tsx   # 20-field CSV import + enrichment cards
│   │   ├── CampaignsSection.tsx    # Campaign builder + 5-step progress UI
│   │   ├── PipelineSection.tsx     # Kanban (9 stages) + list view
│   │   ├── ReportsSection.tsx      # Daily report + live metrics snapshot
│   │   ├── SettingsSection.tsx     # Gmail, limits, scheduler, FU timeline
│   │   └── ErrorBoundary.tsx       # Prevents full-app crashes
│   └── lib/
│       └── firebase.ts             # Firebase SDK setup
│
├── docs/                           # Technical documentation (this folder)
├── firebase-blueprint.json         # Firestore collection reference
├── firestore.rules                 # Security rules
├── .env.example                    # Environment variable template
└── package.json
```

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
GEMINI_API_KEY=your_key_here        # https://aistudio.google.com/apikey
PORT=3000

# Firebase — from Firebase Console > Project Settings
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_ID=
```

### 3. Run the development server

```bash
npm run dev
```

Visit → `http://localhost:3000`

---

## 📋 First-Time Setup Flow

```
1. Open http://localhost:3000
2. Click "Sign in with Google" in the sidebar
3. Go to Resume → upload your resume PDF or DOCX
4. Go to Contacts → click "Template" to download the CSV template
5. Fill in your contacts and import via "Import CSV"
6. Go to Campaigns → click "New Campaign" → select resume + contacts → Launch
7. Monitor in Pipeline view (Kanban or List)
8. Go to Reports → Generate your first daily AI summary
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `3000`) |
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key |
| `VITE_FIREBASE_API_KEY` | **Yes** | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | **Yes** | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | **Yes** | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | **Yes** | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | **Yes** | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | **Yes** | Firebase app ID |
| `VITE_FIREBASE_DATABASE_ID` | **Yes** | Custom Firestore database ID |

---

## 📡 API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Server health check |
| `/api/resume/analyze` | POST | Gemini extraction: skills, projects, experience, achievements, cloud & AI expertise |
| `/api/resume/parse-document` | POST | Parse PDF/DOCX/TXT (base64) → raw text |
| `/api/campaign/create` | POST | Create campaign record |
| `/api/campaign/score-contact` | POST | Rule-based Outreach Opportunity Score (0–100) |
| `/api/campaign/enrich-contact` | POST | Gemini company research → talking points |
| `/api/campaign/build-queue` | POST | Build human-like send schedule (slots array) |
| `/api/outreach/generate` | POST | Generate personalized email (subject + body) |
| `/api/reports/generate` | POST | Generate AI daily report narrative |
| `/api/reports/classify-reply` | POST | Classify reply type (Interview/Positive/Rejection etc.) |
| `/api/gmail/send` | POST | Send email or create draft via Gmail OAuth |
| `/api/scrape/url` | POST | Scrape career page for job details |
| `/api/job/match` | POST | Job description alignment score (legacy) |

Full API docs: [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)

---

## 🛠️ Scripts

```bash
npm run dev      # Start dev server (Vite + Express via tsx)
npm run build    # Production build (Vite + esbuild server bundle)
npm run start    # Run production server (dist/server.cjs)
npm run lint     # TypeScript type-check (tsc --noEmit)
npm run clean    # Delete build artifacts
```

---

## 🏛️ Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore** and **Google Authentication**
3. Copy credentials to `.env`
4. Gmail OAuth scopes required: `gmail.send`, `gmail.compose`, `drive.file`, `calendar.events`

Firestore collections used:
`resumes` · `contacts` · `campaigns` · `applications` · `emailQueue` · `companyResearch` · `generatedEmails` · `reports` · `settings`

See [`docs/FIREBASE_SETUP_GUIDE.md`](docs/FIREBASE_SETUP_GUIDE.md) for detailed instructions.

---

## 📂 Documentation

| File | Contents |
|---|---|
| [`API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) | Full V3 API endpoint specs with request/response |
| [`SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) | V3 architecture, flows, AI usage strategy |
| [`FIRESTORE_SCHEMA.md`](docs/FIRESTORE_SCHEMA.md) | All 9 Firestore collections with field definitions |
| [`PROJECT_ARCHITECTURE.md`](docs/PROJECT_ARCHITECTURE.md) | Component diagram, sequence diagrams |
| [`FIREBASE_SETUP_GUIDE.md`](docs/FIREBASE_SETUP_GUIDE.md) | Firebase configuration walkthrough |
| [`GEMINI_INTEGRATION_GUIDE.md`](docs/GEMINI_INTEGRATION_GUIDE.md) | AI usage strategy and prompt engineering |
| [`GMAIL_API_GUIDE.md`](docs/GMAIL_API_GUIDE.md) | Gmail OAuth + sending setup |
| [`DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md) | Cloud Run / Docker deployment |
| [`SECURITY_GUIDE.md`](docs/SECURITY_GUIDE.md) | Security practices and Firestore rules |
| [`COST_ESTIMATION.md`](docs/COST_ESTIMATION.md) | Estimated running costs |
| [`ROADMAP.md`](docs/ROADMAP.md) | What's done and what's planned |

---

## 📄 License

Apache-2.0 — see [LICENSE](LICENSE) file.
