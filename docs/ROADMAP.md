# V3 Feature Status & Roadmap

## ✅ Implemented (V3 — June 2026)

### Core Infrastructure
- [x] React + TypeScript + Vite frontend
- [x] Express server with tsx (TypeScript direct execution)
- [x] Firebase Authentication (Google OAuth)
- [x] Cloud Firestore real-time subscriptions (8 collections)
- [x] 9-route Express backend
- [x] TypeScript: 0 errors

### Navigation & UI
- [x] Dark collapsible sidebar (7 nav items)
- [x] Active state, badges, mobile overlay
- [x] Consistent design system (CSS custom properties, animations)
- [x] All 7 sections: Dashboard, Resume, Contacts, Campaigns, Pipeline, Reports, Settings

### Resume Module
- [x] PDF upload + DOCX upload via `pdf-parse` + `mammoth`
- [x] Drag-and-drop file zone
- [x] Gemini extraction: `summary`, `skills`, `projects`, `experience`, `achievements`, `cloudExperience`, `aiExperience`
- [x] Resume card shows skill/project/cloud/AI badges
- [x] Firestore persistence (`resumes` collection)

### Contacts Module
- [x] 20-field CSV import with paste zone
- [x] CSV template download (all 20 fields pre-filled with examples)
- [x] Required + recommended + advanced personalization field support
- [x] Priority filter tabs (High/Medium/Low)
- [x] Search by company, name, role, tech stack
- [x] Expandable contact cards with enrichment status + score ring
- [x] Firestore persistence (`contacts` collection)

### Campaign Builder
- [x] Campaign name, resume selector, contact multi-select, daily limit slider
- [x] Follow-up toggle
- [x] 5-step launch orchestration with progress indicator
  - Step 1: Parse Resume (Gemini)
  - Step 2: Enrich Companies (Gemini)
  - Step 3: Score Contacts (rule-based Outreach Opportunity Score)
  - Step 4: Generate Emails (Gemini, sorted by score)
  - Step 5: Build Queue (rule-based scheduler)
- [x] Campaign list with status badges, stats, progress bars
- [x] Pause / Resume campaigns

### Email Generation
- [x] Under 130 words, flowing prose
- [x] Must mention: company, project, matching tech, role, CTA
- [x] Email types: application, recruiter_outreach, follow_up
- [x] Context: resume summary + company research + talking points

### Scheduler
- [x] 09:00–18:00 weekday window only
- [x] 120–240 minute random delays
- [x] 8–12 recommended daily limit (configurable up to 20)
- [x] Auto-skips weekends and respects daily limits

### Gmail Integration
- [x] Server-Side OAuth 2.0 flow (`/api/auth/google/url`)
- [x] Background scheduler with autonomous token refresh
- [x] Send via `POST /api/gmail/send` (Gmail OAuth)
- [x] Store `gmailMessageId` in emailQueue + application
- [x] Draft creation mode (`draftOnly: true`)

### Pipeline
- [x] 9 stages: Unreached, Queued, Sent, Follow Up 1, Follow Up 2, Replied, Interview, Rejected, Archived
- [x] Kanban view (columns per stage, drag-style)
- [x] List view with quick status buttons
- [x] Score rings on every card
- [x] Full timeline audit log per application

### Follow-Up Automation
- [x] Follow-Up #1 at Day 5 after initial send
- [x] Follow-Up #2 at Day 7 after FU#1
- [x] Auto-archive at Day 14 (no response)
- [x] Configurable in Settings

### Reply Classification
- [x] Gemini classifies: Positive, Interview Request, Technical Assessment, Rejection, Out of Office, Unsubscribe, Unclear
- [x] Confidence score + suggested action
- [x] Updates application status automatically

### Reports
- [x] Live today snapshot (5 metrics + top opportunities)
- [x] AI-generated daily report (subject, body, highlights, tomorrow focus)
- [x] 14-day report history
- [x] Interview celebration badges in history

### Settings
- [x] Gmail connection status with scope verification
- [x] Daily limit slider (1–20)
- [x] Scheduler delay controls with example times
- [x] Follow-up timeline visualizer (D0 → FU1 → FU2 → Archive)
- [x] Sent-today counter with progress bar

---

## 🔲 Planned Improvements

### Short-Term
- [ ] **Gmail Inbox Monitor** — Poll Gmail for replies and auto-classify using `/api/reports/classify-reply`
- [ ] **Automatic report send to Gmail** — Deliver daily report to Adarsh's inbox at 21:00 IST
- [ ] **Contact enrichment from URL** — Auto-scrape careers page linked in CSV `jobUrl` field
- [ ] **Email preview modal** — Preview generated email before it enters the queue
- [ ] **Undo send** — Cancel a queued item before it fires

### Medium-Term
- [ ] **Reply detection webhook** — Use Gmail push notifications instead of polling
- [ ] **Interview calendar integration** — Auto-create calendar event when interview detected
- [ ] **Multi-resume support in pipeline** — Show which resume was used for each application
- [ ] **Contact CSV enrichment mode** — Bulk-enrich all contacts in a campaign before launch
- [ ] **Email variant A/B** — Generate 2 subject variants per contact, pick winner

### Long-Term
- [ ] **LinkedIn outreach** — Generate LinkedIn connection messages alongside emails
- [ ] **Mobile PWA** — Installable on phone for status monitoring
- [ ] **Cloud Run deployment** — One-command cloud deploy with CI/CD

---

## 📊 Current Metrics

| Metric | Value |
|---|---|
| TypeScript errors | 0 |
| Backend routes | 13 endpoints |
| Firestore collections | 9 |
| Frontend sections | 7 |
| Gemini endpoints | 5 (resume, enrich, email, classify, report) |
| Rule-based endpoints | 3 (score, queue, health) |
| AI cost per campaign (25 contacts) | ~$0.03–$0.08 |
