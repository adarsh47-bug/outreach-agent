# Project Architecture — V3

## 1. Overview

Outreach Agent V3 is a **Full Stack (Vite + React client + Node/Express server)** application with the following design principles:

1. **Gemini API key** is server-side only — never in the client bundle
2. **Google OAuth token** is React state only — never persisted to disk or Firestore
3. **Firestore security rules** enforce per-user data isolation via `request.auth.uid`
4. **AI used minimally** — only for resume parsing, enrichment, email generation, reply classification, and daily reports; all scheduling and scoring is rule-based

---

## 2. Component Diagram

```mermaid
graph TD
  User((Adarsh))
  ReactApp["React SPA (Vite)\nSidebar + 7 Sections"]
  ServerProxy["Express Server (tsx)\n8 Route Modules"]
  FBAuth[(Firebase Auth)]
  FirestoreDB[(Cloud Firestore\n9 Collections)]
  GeminiAPI(Google Gemini API)
  GmailAPI(Gmail API)

  User ==>|Interacts| ReactApp
  ReactApp ==>|Google Sign-In| FBAuth
  FBAuth -->|JWT + OAuth Token| ReactApp
  ReactApp -->|Real-time sync| FirestoreDB
  ReactApp -->|API calls| ServerProxy
  ServerProxy -->|GEMINI_API_KEY secured| GeminiAPI
  ServerProxy -->|User OAuth token| GmailAPI
  GeminiAPI -->|JSON responses| ServerProxy
  GmailAPI -->|Message IDs| ServerProxy
  ServerProxy -->|Results| ReactApp
  ReactApp -->|Write results| FirestoreDB
```

---

## 3. Frontend Component Tree

```
App.tsx
└── Sidebar.tsx                  ← Dark collapsible sidebar, badges
    ├── Dashboard (activeSection)
    │   └── DashboardSection.tsx ← 6 stat cards, campaign bars, activity feed
    ├── Resume
    │   └── ResumeSection.tsx    ← PDF/DOCX upload + Gemini analysis
    ├── Contacts
    │   └── ContactsV2Section.tsx ← 20-field CSV import, score rings, enrichment
    ├── Campaigns
    │   └── CampaignsSection.tsx  ← Builder + 5-step launch progress
    ├── Pipeline
    │   └── PipelineSection.tsx   ← Kanban (9 stages) + list view
    ├── Reports
    │   └── ReportsSection.tsx    ← Live snapshot + AI report + history
    └── Settings
        └── SettingsSection.tsx   ← Gmail, limits, scheduler, FU timeline
```

**Supporting hooks:**
- `useAuth.ts` — Firebase auth + Gmail OAuth scopes
- `useFirestoreSync.ts` — 8-collection live subscriptions + CRUD handlers
- `useCampaign.ts` — 5-step campaign launch orchestrator

---

## 4. Backend Route Structure

```
server/index.ts
├── GET  /api/health
├── POST /api/resume/analyze
├── POST /api/resume/parse-document
├── POST /api/campaign/create
├── POST /api/campaign/score-contact       ← rule-based, no AI
├── POST /api/campaign/enrich-contact      ← Gemini
├── POST /api/campaign/build-queue         ← rule-based, no AI
├── POST /api/outreach/generate            ← Gemini
├── POST /api/reports/generate             ← Gemini
├── POST /api/reports/classify-reply       ← Gemini
├── POST /api/gmail/send
├── POST /api/scrape/url
└── POST /api/job/match                    ← legacy
```

---

## 5. Sequence Diagrams

### A. Google Sign-In
```mermaid
sequenceDiagram
  autonumber
  User->>ReactApp: Click "Sign in with Google"
  ReactApp->>Firebase: signInWithPopup(GoogleAuthProvider)
  Note over ReactApp,Firebase: Scopes: gmail.send, gmail.compose, drive.file, calendar.events
  Firebase-->>ReactApp: Firebase User + credential.accessToken
  ReactApp->>ReactApp: setUser(firebaseUser), setGoogleToken(accessToken)
  ReactApp->>Firestore: Update /users/{uid} (email, displayName)
  ReactApp-->>User: Sidebar shows user avatar
```

### B. Campaign Launch (5 Steps)
```mermaid
sequenceDiagram
  autonumber
  User->>ReactApp: Click "Launch Campaign"
  ReactApp->>useCampaign: launch(campaign, contacts, resume)

  Note over useCampaign: Step 1 — Parse Resume
  useCampaign->>Server: POST /api/resume/analyze
  Server->>Gemini: Extract skills, projects, experience, etc.
  Gemini-->>Server: Structured JSON
  Server-->>useCampaign: ResumeProfile fields

  Note over useCampaign: Step 2 — Enrich Companies
  loop For each contact
    useCampaign->>Server: POST /api/campaign/enrich-contact
    Server->>Gemini: Research summary + talking points
    Gemini-->>Server: {summary, techStack, talkingPoints}
    Server-->>useCampaign: CompanyResearch
    useCampaign->>Firestore: Write companyResearch/{id}
  end

  Note over useCampaign: Step 3 — Score Contacts (rule-based)
  loop For each contact
    useCampaign->>Server: POST /api/campaign/score-contact
    Server-->>useCampaign: score (0-100)
    useCampaign->>Firestore: Update contact.outreachScore
  end

  Note over useCampaign: Step 4 — Generate Emails
  loop Sorted by score desc
    useCampaign->>Server: POST /api/outreach/generate
    Server->>Gemini: Personalized email with all company context
    Gemini-->>Server: {subject, body}
    Server-->>useCampaign: Email draft
    useCampaign->>Firestore: Write emailQueue/{id}
  end

  Note over useCampaign: Step 5 — Build Queue (rule-based)
  useCampaign->>Server: POST /api/campaign/build-queue
  Server-->>useCampaign: scheduledAt slots array
  useCampaign->>Firestore: Update emailQueue items with scheduledAt
  useCampaign->>Firestore: Update campaign.status = "Running"
  ReactApp-->>User: Campaign live ✓
```

### C. Email Send Flow
```mermaid
sequenceDiagram
  autonumber
  Scheduler->>ReactApp: scheduledAt time reached
  ReactApp->>Server: POST /api/gmail/send {accessToken, to, subject, body}
  Server->>Gmail: Create + send message via Gmail API
  Gmail-->>Server: {messageId, status: "SENT"}
  Server-->>ReactApp: {success, messageId}
  ReactApp->>Firestore: emailQueue status → "Sent"
  ReactApp->>Firestore: application status → "Sent"
  ReactApp->>Firestore: Append timeline entry
```

### D. Daily Report
```mermaid
sequenceDiagram
  autonumber
  User->>ReportsSection: Click "Generate Report"
  ReportsSection->>ReportsSection: computeLiveMetrics() from applications[]
  ReportsSection->>Server: POST /api/reports/generate {date, metrics, topOpportunities}
  Server->>Gemini: Write narrative: highlights, body, tomorrowFocus
  Gemini-->>Server: {subject, body, highlights}
  Server-->>ReportsSection: Report data
  ReportsSection->>Firestore: Write reports/{id}
  ReportsSection-->>User: Display generated report
```

---

## 6. Design Decisions

| Decision | Rationale |
|---|---|
| **No ATS scoring** | The goal is interviews, not keyword matching. Outreach Opportunity Score targets companies most likely to hire, not job descriptions most likely to pass ATS. |
| **Rule-based scheduler** | Human-like timing (09:00–18:00, 120–240 min delays) is deterministic — AI adds no value here and would waste quota. |
| **Gemini for email only** | One AI call per contact, not per scheduling decision, keeps cost near zero. |
| **Firestore real-time** | All data syncs live across sections without polling — Dashboard always reflects current pipeline state. |
| **No mass emailing** | Daily limit (8–12) + random delays mimic human behavior, protect Gmail reputation, and prevent spam flags. |
| **Single user focus** | Built for Adarsh. Firebase rules enforce single-user isolation, but no multi-tenant complexity. |
