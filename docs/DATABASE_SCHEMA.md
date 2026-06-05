# Database Schema — V3

> **Note:** This file is a summary redirect. The complete V3 Firestore schema is documented in [`FIRESTORE_SCHEMA.md`](FIRESTORE_SCHEMA.md).

---

## Collections Summary

| Collection | Path | Purpose |
|---|---|---|
| `resumes` | `/users/{uid}/resumes/{id}` | Parsed resume profiles with 7 extracted field arrays |
| `contacts` | `/users/{uid}/contacts/{id}` | Company/recruiter contacts (20 CSV fields) |
| `campaigns` | `/users/{uid}/campaigns/{id}` | Campaign config + live stats |
| `applications` | `/users/{uid}/applications/{id}` | Per-contact pipeline tracking (9 stages) |
| `emailQueue` | `/users/{uid}/emailQueue/{id}` | Scheduled email send slots |
| `companyResearch` | `/users/{uid}/companyResearch/{id}` | Gemini-generated company intelligence |
| `generatedEmails` | `/users/{uid}/generatedEmails/{id}` | Archive of all AI-generated emails |
| `reports` | `/users/{uid}/reports/{id}` | Daily AI-generated outreach reports |
| `settings` | `/users/{uid}/settings/userSettings` | User preferences (limits, scheduler, follow-ups) |

---

## Key Relationships

```
resumes ──────────────────────────────────────┐
                                               ▼
contacts ──── campaigns ──── applications ──── emailQueue
   │                                │
   └──── companyResearch            └──── reports
```

- A **campaign** references one `resumeId` and many `contactIds`
- An **application** tracks one `contactId` × one `campaignId`
- An **emailQueue item** references one `contactId` + one `campaignId`
- **companyResearch** is keyed by `contactId`
- **reports** aggregate across all **applications**

---

For complete field definitions, see [FIRESTORE_SCHEMA.md](FIRESTORE_SCHEMA.md).
