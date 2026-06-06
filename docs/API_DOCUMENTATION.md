# V3 API Documentation

Full reference for all backend endpoints in the Outreach Agent V3 Express server.

> **Base URL:** `http://localhost:3000` (dev) · All endpoints use `Content-Type: application/json`

---

## Authentication

1. **Client-Side:** Firebase Google Sign-In handles UI authentication.
2. **Server-Side:** `/api/auth/google/url` provides the OAuth consent screen for the background Gmail agent.

Google OAuth access tokens and refresh tokens are securely stored in Firestore (`users/{uid}/settings/authTokens`) and retrieved internally by the background scheduler.

---

## Endpoints

---

### `GET /api/auth/google/url`

Generates the Google OAuth consent screen URL to authorize the backend agent to send emails.

**Query Parameters:**
- `uid` (required): The Firebase user ID to associate the tokens with.

**Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=..."
}
```

---

### `GET /api/auth/google/callback`

Google OAuth callback handler. Exchanges the authorization code for `accessToken` and `refreshToken` and saves them to Firestore.

**Query Parameters:**
- `code` (required): The authorization code returned by Google.
- `state` (required): Contains the user's `uid`.

**Response:**
Redirects to the frontend URL (e.g., `http://localhost:3000`) upon success.

---

### `GET /api/health`

Server health check.

**Response:**
```json
{ "status": "ok", "timestamp": "2026-06-05T17:00:00Z" }
```

---

### `POST /api/resume/parse-document`

Parse a PDF, DOCX, or TXT file and return raw text.

**Request:**
```json
{
  "base64": "JVBERi0xLj...",
  "fileName": "resume.pdf",
  "mimeType": "application/pdf"
}
```

**Response:**
```json
{
  "text": "Adarsh Kumar\nFull Stack Engineer\nSkills: React, TypeScript..."
}
```

---

### `POST /api/resume/analyze`

Structured Gemini AI extraction from raw resume text.

Extracts 7 fields: `summary`, `skills`, `projects`, `experience`, `achievements`, `cloudExperience`, `aiExperience`.

**Request:**
```json
{
  "text": "Full resume text content..."
}
```

**Response:**
```json
{
  "summary": "Full Stack Engineer with 3+ years of experience in React, TypeScript, Node.js, Firebase, and Gemini AI.",
  "skills": ["React", "TypeScript", "Node.js", "Firebase", "Gemini AI", "REST APIs"],
  "projects": [
    "Built RAG-based document assistant using Firebase + Gemini 1.5 Flash",
    "Developed SaaS internal tooling platform with 200+ daily active users"
  ],
  "experience": [
    "Software Engineer at Acme Corp, 2023–2025: Led full stack React/Node.js development"
  ],
  "achievements": [
    "Reduced API latency by 40% through Firestore query optimization",
    "Shipped AI-powered automation workflow used by 3 enterprise clients"
  ],
  "cloudExperience": [
    "Firebase Hosting",
    "Cloud Firestore schema design",
    "Google Cloud Run deployment"
  ],
  "aiExperience": [
    "Built RAG pipeline with Gemini 1.5",
    "Implemented semantic search with text-embedding-004"
  ]
}
```

---

### `POST /api/campaign/create`

Create and validate a new campaign record.

**Request:**
```json
{
  "name": "June 2026 Outreach",
  "resumeId": "res_abc123",
  "contactIds": ["cont_001", "cont_002", "cont_003"],
  "dailyLimit": 10,
  "followUpEnabled": true
}
```

**Response:**
```json
{
  "success": true,
  "campaignId": "camp_xyz789",
  "name": "June 2026 Outreach",
  "status": "Draft",
  "stats": {
    "total": 3,
    "queued": 0,
    "sent": 0,
    "replies": 0,
    "interviews": 0,
    "followUpsSent": 0
  }
}
```

---

### `POST /api/campaign/score-contact`

Rule-based Outreach Opportunity Score (0–100). No AI — instant, zero cost.

**Scoring factors:**
| Factor | Max Points |
|---|---|
| Technology stack match | 35 |
| Role alignment (Full Stack / Backend / Frontend) | 25 |
| Contact priority (High/Medium/Low) | 15 |
| Hiring signals (recentHiringActivity / reasonForOutreach) | 15 |
| Company stage / growth | 10 |
| Personalization data (personName, linkedin) | 10 + 5 |

**Request:**
```json
{
  "contact": {
    "companyName": "Acme AI",
    "role": "Full Stack Engineer",
    "techStack": "React, TypeScript, Node.js, Firebase",
    "priority": "High",
    "recentHiringActivity": "Expanding engineering team",
    "personName": "Jane Doe",
    "email": "jane@acme.ai"
  },
  "resumeSkills": ["React", "TypeScript", "Firebase", "Gemini"]
}
```

**Response:**
```json
{
  "success": true,
  "score": 85,
  "reasons": [
    "Tech stack alignment (+30)",
    "Role alignment (+25)",
    "High priority (+15)",
    "Active hiring signals (+15)"
  ],
  "breakdown": {
    "techMatch": 30,
    "roleMatch": 25,
    "priority": 15,
    "hiringSignals": 15,
    "companyGrowth": 0
  }
}
```

---

### `POST /api/campaign/enrich-contact`

Gemini-powered company research. Generates outreach talking points from available company context.

**Request:**
```json
{
  "contact": {
    "companyName": "Acme AI",
    "website": "https://acme.ai",
    "industry": "AI SaaS",
    "techStack": "React, TypeScript, Firebase",
    "recentHiringActivity": "Hiring full stack engineers",
    "reasonForOutreach": "Building internal AI tooling",
    "companyStage": "Series A",
    "role": "Full Stack Engineer"
  }
}
```

**Response:**
```json
{
  "success": true,
  "research": {
    "summary": "Acme AI is a Series A startup building AI-powered SaaS tools. Their React/Firebase stack is a direct match for a Full Stack engineer with Gemini experience.",
    "techStack": ["React", "TypeScript", "Firebase", "Node.js"],
    "hiringSignals": ["Expanding engineering team", "Series A funded"],
    "talkingPoints": [
      "Direct React + Firebase stack match",
      "Can contribute to AI tooling initiatives immediately",
      "Experience with Gemini AI aligns with their product direction"
    ],
    "engineeringFocus": "AI-powered productivity tools for enterprise"
  },
  "enrichedAt": "2026-06-05T17:30:00Z"
}
```

---

### `POST /api/campaign/build-queue`

Build a human-like email send schedule respecting the 09:00–18:00 weekday sending window and daily limits.

**Request:**
```json
{
  "contactCount": 25,
  "dailyLimit": 10,
  "startDate": "2026-06-06T00:00:00Z",
  "minDelay": 120,
  "maxDelay": 240
}
```

**Response:**
```json
{
  "success": true,
  "slots": [
    "2026-06-06T09:13:00Z",
    "2026-06-06T11:47:00Z",
    "2026-06-06T14:22:00Z",
    "..."
  ],
  "totalSlots": 25,
  "estimatedDays": 3
}
```

---

### `POST /api/outreach/generate`

Gemini-powered personalized outreach email generation. Strict rules enforced in the prompt.

**Email rules:**
- Must mention company name
- Must reference a specific project or achievement
- Must mention 1–2 matching technologies
- Must reference the role or reason for outreach
- Must end with a low-pressure CTA
- Under 130 words, no bullet points, no generic phrases

**Request:**
```json
{
  "resumeSummary": "Full Stack Engineer with React, TypeScript, Node.js, Firebase...",
  "jobDetails": "Full Stack Engineer role at Acme AI — React, Firebase, Gemini AI",
  "companyName": "Acme AI",
  "recruiterName": "Jane Doe",
  "techStack": "React, TypeScript, Firebase",
  "recentHiringActivity": "Expanding engineering team",
  "talkingPoints": ["Direct stack match", "AI tooling experience"],
  "matchingSkills": ["React", "TypeScript", "Firebase"],
  "emailType": "recruiter_outreach"
}
```

**Response:**
```json
{
  "subject": "Full Stack Engineer — React + Firebase + Gemini AI",
  "body": "Hi Jane,\n\nI came across Acme AI's work on AI-powered productivity tools and wanted to reach out. I'm a Full Stack Engineer who recently built a RAG-based document assistant using Firebase and Gemini — exactly the kind of stack you're working with.\n\nWith your team expanding, I'd love to explore if there's a fit. Would you be open to a 15-minute call this week?\n\nBest,\nAdarsh"
}
```

**`emailType` values:** `application` · `recruiter_outreach` · `follow_up`

---

### `POST /api/reports/generate`

Gemini-generated daily outreach report with metrics, highlights, and narrative.

**Request:**
```json
{
  "date": "2026-06-05",
  "emailsSent": 8,
  "replies": 2,
  "interviews": 1,
  "followUpsSent": 3,
  "pendingCompanies": 14,
  "topOpportunities": [
    { "companyName": "Acme AI", "role": "Full Stack", "score": 85, "status": "Replied" }
  ],
  "recentActivity": [
    { "note": "Acme AI: Replied positively", "timestamp": "2026-06-05T14:30:00Z" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "date": "2026-06-05",
  "report": {
    "subject": "Outreach Daily Report — 8 sent, 1 interview 🎉",
    "body": "Great day! You sent 8 emails and received 2 replies...",
    "highlights": [
      "8 emails sent today",
      "1 interview secured with Acme AI",
      "Reply rate: 25%"
    ],
    "tomorrowFocus": ["Company B", "Company C"]
  },
  "metrics": {
    "emailsSent": 8,
    "replies": 2,
    "interviews": 1,
    "replyRate": 25,
    "interviewRate": 13
  }
}
```

---

### `POST /api/reports/classify-reply`

Gemini-powered email reply classifier.

**Request:**
```json
{
  "subject": "Re: Full Stack Opportunities",
  "emailBody": "Hi Adarsh, thanks for reaching out! We'd love to schedule a call next week..."
}
```

**Response:**
```json
{
  "success": true,
  "classification": "Interview Request",
  "confidence": 0.97,
  "suggestedAction": "Reply promptly with your availability for next week",
  "summary": "Positive reply requesting a call to discuss opportunities"
}
```

**Classification values:** `Positive` · `Interview Request` · `Technical Assessment` · `Rejection` · `Out of Office` · `Unsubscribe` · `Unclear`

---

### `POST /api/gmail/send`

Send an email or create a draft via Gmail API using Google OAuth access token.

**Request:**
```json
{
  "accessToken": "ya29.a0AfH6...",
  "to": "jane@acme.ai",
  "subject": "Full Stack Engineer — React + Firebase",
  "body": "Hi Jane,\n\n...",
  "draftOnly": false
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "msg-abc-123456",
  "status": "SENT"
}
```

**`status` values:** `SENT` · `DRAFT_CREATED`

---

### `POST /api/scrape/url`

Scrape a career page URL for job details.

**Request:**
```json
{
  "url": "https://acme.ai/careers/full-stack-engineer"
}
```

**Response:**
```json
{
  "companyName": "Acme AI",
  "role": "Full Stack Engineer",
  "location": "Remote",
  "recruiterName": "Hiring Team",
  "description": "We are looking for a Full Stack Engineer..."
}
```

---

### `POST /api/job/match` *(legacy)*

ATS alignment score between resume and job description.

**Request:**
```json
{
  "resumeText": "Full resume text...",
  "jobDescription": "Job description text..."
}
```

**Response:**
```json
{
  "score": 82,
  "matchingSkills": ["React", "TypeScript", "Firebase"],
  "missingSkills": ["Docker"],
  "recommendations": ["Mention your Firebase deployment experience more prominently"]
}
```
