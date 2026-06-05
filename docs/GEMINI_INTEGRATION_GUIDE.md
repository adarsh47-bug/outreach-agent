# Gemini AI Integration Guide — V3

## 1. Principle: AI Where It Matters

Gemini is used **only** for tasks that require language understanding or generation. Everything else — scheduling, scoring, status transitions — is rule-based.

| Uses Gemini | Rule-Based Instead |
|---|---|
| Resume field extraction | — |
| Company research synthesis | — |
| Personalized email generation | — |
| Reply classification | — |
| Daily report narrative | — |
| — | Outreach Opportunity Score |
| — | Email scheduler |
| — | Follow-up timing |
| — | Pipeline status transitions |

---

## 2. Model Selection

```
Model: gemini-2.5-flash (configured via GEMINI_MODEL env or config.ts default)
```

All calls use `responseMimeType: "application/json"` with `responseSchema` for type-safe, directly parsable outputs. No prompt parsing or regex required.

---

## 3. SDK Initialization (Server-Side Only)

```ts
// server/services/gemini.ts
import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return aiInstance;
}
```

The API key **never** leaves the server. The client only sees API responses.

---

## 4. Resume Analysis

**Endpoint:** `POST /api/resume/analyze`  
**Input:** Raw resume text (extracted from PDF/DOCX by document-parser.ts)  
**Output:** 7 structured arrays + summary

```ts
responseSchema: {
  type: Type.OBJECT,
  properties: {
    summary: Type.STRING,          // 3-sentence professional summary
    skills: Type.ARRAY<STRING>,    // all technical skills
    projects: Type.ARRAY<STRING>,  // "Built X using Y technology"
    experience: Type.ARRAY<STRING>,// "Role at Company, Period: Description"
    achievements: Type.ARRAY<STRING>, // quantified wins
    cloudExperience: Type.ARRAY<STRING>, // Firebase, GCP, Cloud Run, etc.
    aiExperience: Type.ARRAY<STRING>,    // RAG, Gemini, embeddings, etc.
  },
  required: ["summary", "skills", "projects", "experience",
             "achievements", "cloudExperience", "aiExperience"]
}
```

---

## 5. Company Enrichment

**Endpoint:** `POST /api/campaign/enrich-contact`  
**Input:** All available company context from the contact CSV fields  
**Output:** Research summary optimized for outreach personalization

```ts
responseSchema: {
  type: Type.OBJECT,
  properties: {
    summary: Type.STRING,           // Why this company is interesting
    techStack: Type.ARRAY<STRING>,  // Identified/inferred stack
    hiringSignals: Type.ARRAY<STRING>, // Growth/hiring signals
    talkingPoints: Type.ARRAY<STRING>, // Email personalization hooks
    engineeringFocus: Type.STRING,  // What they build
  }
}
```

**Fallback:** If Gemini fails (rate limit, timeout), the endpoint returns a rule-based fallback using the raw CSV fields — no crash, no empty response.

---

## 6. Email Generation

**Endpoint:** `POST /api/outreach/generate`  
**Input:** Resume summary + company research + contact fields + email type  
**Output:** `{ subject, body }`

### Strict Email Rules (enforced in system prompt)
```
✓ Must mention company name naturally
✓ Must reference a specific project or achievement
✓ Must mention 1-2 matching technologies from their stack
✓ Must reference the role or reason for outreach
✓ Must end with a low-pressure CTA ("Would you be open to a 15-minute call?")
✗ Under 130 words total
✗ No bullet points — flowing prose only
✗ No generic phrases ("I hope this email finds you well")
✗ No placeholders ([Company Name], [Your Name])
```

### Email Types
```
"application"         → Express interest in a specific role, request next steps
"recruiter_outreach"  → Networking pitch, ask for a brief call
"follow_up"           → Short warm follow-up referencing the previous email
```

### Prompt Structure
```
System:
  "You are an elite outreach copywriter..."
  "Write from Adarsh (Full Stack: React, TypeScript, Node.js, Firebase, Gemini AI)"
  "To: {recruiterName} at {companyName}"

Context block:
  CANDIDATE BACKGROUND: {resumeSummary}
  TARGET OPPORTUNITY: {jobDetails}
  COMPANY RESEARCH: {techStack, recentHiringActivity, talkingPoints, ...}
  MATCHING SKILLS: {top 4 skills}

Rules: (strict list as above)
```

---

## 7. Reply Classification

**Endpoint:** `POST /api/reports/classify-reply`  
**Input:** Email subject + body  
**Output:** Classification + confidence + suggested action

```ts
responseSchema: {
  classification: Type.STRING,    // see values below
  confidence: Type.NUMBER,        // 0.0 – 1.0
  suggestedAction: Type.STRING,   // what to do next
  summary: Type.STRING,           // brief summary of reply
}
```

**Classification values:**
- `Positive` — interested but no immediate action
- `Interview Request` — explicit request to schedule
- `Technical Assessment` — coding challenge or take-home sent
- `Rejection` — explicit decline
- `Out of Office` — auto-reply detected
- `Unsubscribe` — unsubscribe request
- `Unclear` — intent cannot be determined

---

## 8. Daily Report Generation

**Endpoint:** `POST /api/reports/generate`  
**Input:** Date + 5 metrics + top opportunities + recent activity  
**Output:** Subject, body, highlights, tomorrowFocus

```ts
responseSchema: {
  subject: Type.STRING,                  // e.g. "8 sent, 1 interview 🎉"
  body: Type.STRING,                     // full narrative under 200 words
  highlights: Type.ARRAY<STRING>,        // 3-5 bullet points
  tomorrowFocus: Type.ARRAY<STRING>,     // companies to prioritize
}
```

**Prompt persona:** "AI recruitment assistant generating daily summary for Adarsh, Full Stack Engineer (React, TypeScript, Node.js, Firebase, Gemini AI)"

**Fallback:** If Gemini fails, a rule-based summary is returned from raw metrics — the report is never blank.

---

## 9. Error Handling Strategy

All Gemini routes follow this pattern:

```ts
try {
  const response = await ai.models.generateContent({ ... });
  const output = response.text;
  if (!output) {
    res.status(502).json({ error: "Gemini returned empty response." });
    return;
  }
  res.json(JSON.parse(output.trim()));
} catch (error) {
  // Return graceful fallback instead of 500
  res.json({ success: true, ...fallbackData, _fallbackActive: true });
}
```

The `_fallbackActive: true` flag lets the client know AI was unavailable so it can surface a subtle indicator rather than crashing.
