# System Design: Outreach Agent V3

## 1. Product Goal

**Generate interviews for Adarsh.**

Not ATS scoring. Not mass emailing. Not CRM complexity.  
A personal AI recruiter assistant with one objective: maximize interview bookings through highly personalized, intelligently scheduled outreach.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React SPA (Vite)                         │
│  Sidebar → Dashboard / Resume / Contacts / Campaigns /          │
│            Pipeline / Reports / Settings                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP API calls
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Express Server (tsx)                          │
│  Routes: campaign, outreach, reports, resume, gmail, scraper    │
│  Services: gemini.ts (AI), campaignScheduler.ts (Background)    │
└───────────┬─────────────────────────────┬───────────────────────┘
            │ Gemini SDK                  │ Gmail API (OAuth2)
            ▼                             ▼
┌───────────────────┐          ┌──────────────────────┐
│  Google Gemini    │          │  Gmail API           │
│  (server-side     │          │  (Server-Side OAuth  │
│   API key only)   │          │   with Refresh Token)│
└───────────────────┘          └──────────────────────┘

React SPA ←──── Firebase SDK (client-side) ────→ Cloud Firestore
                 Auth: Firebase Google Sign-In
```

---

## 3. AI Usage Strategy

> Rule-based logic for cost efficiency. Gemini only where it adds irreplaceable value.

| Operation | Method | Rationale |
|---|---|---|
| Resume parsing | **Gemini** | Unstructured → structured JSON (skills, projects, achievements) |
| Company research | **Gemini** | Synthesizes sparse context into talking points |
| Email generation | **Gemini** | Highly personalized, company-specific prose |
| Reply classification | **Gemini** | Nuanced intent detection (Interview vs Rejection etc.) |
| Daily report narrative | **Gemini** | Human-readable summary from raw metrics |
| **Outreach Opportunity Score** | **Rule-based** | Tech match, role, priority, hiring signals — instant, zero cost |
| **Email scheduling** | **Rule-based** | Window + random delay — no AI needed |
| **Follow-up timing** | **Rule-based** | Toggleable fixed day offsets (5 / 7 / 14 days) |
| **Pipeline status transitions** | **Rule-based** | Deterministic stage machine |

---

## 4. Core System Flows

### A. Authentication Flow
```
1. App Authentication:
   User → "Sign in with Google" → Firebase Auth (signInWithPopup)
     → Authenticates user to access the React App and Firestore
     → Firebase user.uid used for all Firestore collection paths

2. Gmail Agent Authorization:
   User → Settings → "Connect Gmail" 
     → Redirects to backend /api/auth/google/url
     → Google consent screen shown (scopes: gmail.send, gmail.compose)
     → Redirects to backend /api/auth/google/callback
     → Server saves `accessToken` + `refreshToken` to Firestore
     → Background scheduler uses these tokens autonomously
```

### B. Campaign Launch (5-Step Orchestration)

```
useCampaign hook orchestrates:

Step 1 — Parse Resume
  POST /api/resume/analyze
  → Extract: skills, projects, experience, achievements, cloudExperience, aiExperience
  → Store in ResumeProfile (Firestore: resumes collection)

Step 2 — Enrich Companies  [Gemini]
  For each contact:
  POST /api/campaign/enrich-contact { contact }
  → Returns: summary, techStack, hiringSignals, talkingPoints, engineeringFocus
  → Store in companyResearch collection

Step 3 — Score Contacts  [Rule-based]
  POST /api/campaign/score-contact { contact, resumeSkills }
  → Outreach Opportunity Score (0-100)
  → Sort contacts by score descending

Step 4 — Generate Emails  [Gemini]
  For each contact (sorted by score):
  POST /api/outreach/generate { resumeSummary, jobDetails, companyName,
                                 techStack, talkingPoints, matchingSkills }
  → Returns: subject, body (<130 words, no generics)
  → Store in emailQueue collection

Step 5 — Build Queue  [Rule-based]
  POST /api/campaign/build-queue { contactCount, dailyLimit, minDelay, maxDelay }
  → Returns ISO datetime slots: 09:00-18:00 weekdays, 120-240 min random gaps
  → Each slot linked to a contact + scheduledAt timestamp
```

### C. Email Send Flow
```
EmailQueueItem (status: Pending, scheduledAt: ISO)
  → At scheduledAt: POST /api/gmail/send { accessToken, to, subject, body }
  → Gmail API creates and sends message
  → gmailMessageId stored
  → Application status: Queued → Sent
  → Timeline entry added
```

### D. Follow-Up Automation
```
After initial send (Day 0), if `followUpEnabled` is true:
  Day +5  → Follow Up 1 email queued (emailType: "follow_up")
  Day +7  → Follow Up 2 email queued (emailType: "follow_up")
  Day +14 → Auto-archive (no response received)

Status machine:
  Sent → Follow Up 1 → Follow Up 2 → Archived (no response)
  Sent → Replied (reply detected)
  Replied → Interview (interview request classified)
```

### E. Reply Classification Flow
```
[Gmail inbox monitoring]
  → POST /api/reports/classify-reply { emailBody, subject }
  → Gemini classifies: Positive / Interview Request / Technical Assessment /
                       Rejection / Out of Office / Unsubscribe / Unclear
  → Application status updated accordingly
  → Timeline entry logged
```

### F. Daily Report Flow
```
[User triggers or scheduled at 21:00]
  → Compute live metrics from applications collection
  → POST /api/reports/generate { date, emailsSent, replies, interviews,
                                  followUpsSent, pendingCompanies, topOpportunities }
  → Gemini writes: subject, body, highlights, tomorrowFocus
  → Report saved to reports collection
  → Optional: send to Gmail via /api/gmail/send
```

---

## 5. Scheduling Engine

```
Sending Window:   09:00 – 18:00 (local time, weekdays only)
Daily Limit:      8–12 recommended, max 20
Min Delay:        120 minutes (between emails)
Max Delay:        240 minutes (between emails)
Random Jitter:    Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay

*Note: The scheduler natively handles day boundaries. If the calculated send time exceeds the `Sending Window` end time, it reliably rolls over to the next valid sending day, ensuring sending limits and windows are always respected.*

Example schedule (10 contacts, 10/day limit):
  Day 1: 09:13 → 11:47 → 14:22 → 16:55
  Day 2: 09:05 → 11:38 → 14:10 → 16:43
  Day 3: 09:20 → 11:52 (remaining contacts)
```

---

## 6. Outreach Opportunity Score (0–100)

Rule-based scoring — no AI, runs instantly.

```
Tech Stack Match (0-35 pts)
  Check contact.techStack against:
  - Full Stack: react, typescript, javascript, node.js, express, rest api
  - Cloud: firebase, gcp, google cloud, firestore, cloud run
  - AI: gemini, openai, rag, llm, ai, machine learning
  +5 pts per matching technology (max 35)

Role Match (0-25 pts)
  Check contact.role against: full stack, fullstack, software engineer,
  backend, frontend, web developer, node, react
  +25 pts if match found

Priority (0-15 pts)
  High → +15 · Medium → +8 · Low → +3

Hiring Signals (0-15 pts)
  recentHiringActivity or reasonForOutreach containing:
  "hiring", "expanding", "engineer" → +15
  Any content → +5

Company Growth/Stage (0-10 pts)
  companyStage or fundingStatus containing:
  "series", "startup", "growth", "seed" → +10

Response Potential (0-15 pts)
  personName or linkedin present → +10
  Valid email → +5

Maximum score: 100
```

---

## 7. Firestore Collections

```
/users/{userId}/resumes/{resumeId}
/users/{userId}/contacts/{contactId}
/users/{userId}/campaigns/{campaignId}
/users/{userId}/applications/{applicationId}
/users/{userId}/emailQueue/{queueItemId}
/users/{userId}/companyResearch/{researchId}
/users/{userId}/generatedEmails/{emailId}
/users/{userId}/reports/{reportId}
/users/{userId}/settings/userSettings
```

---

## 8. Security Model

- **Gemini API Key** — server-side only, never in client bundle
- **Google OAuth Tokens** — `accessToken` and `refreshToken` are stored securely in Firestore `users/{userId}/settings/authTokens`. They are never exposed to the client browser.
- **Firestore Rules** — all reads/writes gated by `request.auth.uid == userId`
- **No credentials in logs** — tokens never logged server-side

---

## 9. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Vanilla CSS (custom design system, no Tailwind in prod) |
| Icons | Lucide React |
| Backend | Express 4, tsx (TypeScript execution) |
| AI | Google Gemini via `@google/genai` SDK |
| Auth | Firebase Authentication (Google OAuth) |
| Database | Cloud Firestore (real-time subscriptions) |
| File Parsing | `mammoth` (DOCX), `pdf-parse` (PDF) |
| Email | Gmail API via Google OAuth |
| Build | esbuild (server bundle), Vite (client bundle) |
