# Firestore Schema — V3

All collections live under `/users/{userId}/` to enforce per-user isolation via Firestore security rules.

---

## Collection Map

```
/users/{userId}/
  ├── resumes/{resumeId}
  ├── contacts/{contactId}
  ├── campaigns/{campaignId}
  ├── applications/{applicationId}
  ├── emailQueue/{queueItemId}
  ├── companyResearch/{researchId}
  ├── generatedEmails/{emailId}
  ├── reports/{reportId}
  ├── settings/userSettings          ← single document
  └── settings/authTokens            ← single document
```

---

## 1. `resumes/{resumeId}`

Stores parsed resume profiles from Gemini analysis.

| Field | Type | Description |
|---|---|---|
| `id` | string | Document ID |
| `fileName` | string | Original uploaded filename |
| `uploadedAt` | string (ISO) | Upload timestamp |
| `textContent` | string | Raw full resume text |
| `summary` | string | Gemini-generated 3-sentence summary |
| `skills` | string[] | All extracted technical skills |
| `projects` | string[] | Key projects with brief descriptions |
| `experience` | string[] | Work history entries |
| `achievements` | string[] | Quantified wins and recognitions |
| `cloudExperience` | string[] | Cloud/infra expertise items |
| `aiExperience` | string[] | AI/ML specific experience |

---

## 2. `contacts/{contactId}`

Recruiter/company contacts. Supports 3 tiers of field richness.

### Required Fields
| Field | Type | Description |
|---|---|---|
| `id` | string | Document ID |
| `companyName` | string | Target company name |
| `email` | string | Contact email address |
| `role` | string | Target role (e.g. "Full Stack Engineer") |
| `location` | string | Office location or "Remote" |
| `priority` | `"High" \| "Medium" \| "Low"` | Outreach priority tier |
| `createdAt` | string (ISO) | Import timestamp |

### Recommended Fields
| Field | Type | Description |
|---|---|---|
| `website` | string | Company website URL |
| `personName` | string | Recruiter or founder name |
| `designation` | string | Their job title |
| `linkedin` | string | LinkedIn profile URL |
| `industry` | string | Company industry vertical |
| `companySize` | string | Headcount range |
| `careersUrl` | string | Careers page URL |
| `reasonForOutreach` | string | Why this company (e.g. "Recently hiring full stack") |
| `recentNews` | string | Recent company news or milestones |
| `techStack` | string | Comma-separated tech stack |

### Advanced Personalization Fields
| Field | Type | Description |
|---|---|---|
| `recentHiringActivity` | string | Specific hiring signals |
| `engineeringBlog` | string | Engineering blog URL |
| `founderName` | string | Founder name for direct outreach |
| `companyStage` | string | Stage (Seed, Series A, etc.) |
| `fundingStatus` | string | Latest funding round info |
| `jobUrl` | string | Direct job listing URL |
| `personalNotes` | string | Freeform notes for personalization |

### Computed Fields (set during campaign)
| Field | Type | Description |
|---|---|---|
| `enriched` | boolean | Whether Gemini research has been run |
| `outreachScore` | number | Outreach Opportunity Score (0–100) |

---

## 3. `campaigns/{campaignId}`

Campaign configuration and live stats.

| Field | Type | Description |
|---|---|---|
| `id` | string | Document ID |
| `name` | string | Campaign name |
| `resumeId` | string | Selected resume reference |
| `status` | `"Draft" \| "Running" \| "Paused" \| "Complete"` | Campaign state |
| `dailyLimit` | number | Max emails per day (8–20) |
| `followUpEnabled` | boolean | Whether to auto-queue follow-ups |
| `contactIds` | string[] | Included contact IDs |
| `createdAt` | string (ISO) | Creation timestamp |
| `updatedAt` | string (ISO) | Last update timestamp |
| `stats.total` | number | Total contacts in campaign |
| `stats.queued` | number | Emails queued |
| `stats.sent` | number | Emails sent |
| `stats.replies` | number | Replies received |
| `stats.interviews` | number | Interviews booked |
| `stats.followUpsSent` | number | Follow-ups sent |
| `launchProgress` | object | `{ step: 1-5, label: string, complete: boolean }` |

---

## 4. `applications/{applicationId}`

One record per contact × campaign pairing. Tracks the full lifecycle.

| Field | Type | Description |
|---|---|---|
| `id` | string | Document ID |
| `contactId` | string | Reference to contact |
| `campaignId` | string | Reference to campaign |
| `companyName` | string | Denormalized company name |
| `recruiterName` | string | Denormalized contact name |
| `role` | string | Target role |
| `status` | OutreachStage | See pipeline stages below |
| `matchScore` | number | Job match score (legacy, 0–100) |
| `outreachScore` | number | Outreach Opportunity Score (0–100) |
| `matchingSkills` | string[] | Skills that match |
| `missingSkills` | string[] | Skills gaps |
| `recommendations` | string[] | AI improvement suggestions |
| `generatedSubject` | string | Generated email subject |
| `generatedBody` | string | Generated email body |
| `createdAt` | string (ISO) | Record creation |
| `updatedAt` | string (ISO) | Last status change |
| `lastEmailSentAt` | string (ISO) | When initial email was sent |
| `followUp1SentAt` | string (ISO) | When FU#1 was sent |
| `followUp2SentAt` | string (ISO) | When FU#2 was sent |
| `gmailMessageId` | string | Gmail message ID for tracking |
| `timeline` | object[] | `[{ status, timestamp, note }]` — full audit log |

### Pipeline Stages (`status`)

```
Unreached → Queued → Sent → Follow Up 1 → Follow Up 2
                                                      ↓
                              Replied ← (any stage, on reply detected)
                                ↓
                            Interview ← (on interview request classified)
                                ↓
                Rejected / Archived (no response after 14 days)
```

---

## 5. `emailQueue/{queueItemId}`

The send schedule. Each item = one email to send at a specific time.

| Field | Type | Description |
|---|---|---|
| `id` | string | Document ID |
| `campaignId` | string | Parent campaign |
| `contactId` | string | Target contact |
| `companyName` | string | Denormalized company name |
| `recipientEmail` | string | Recipient email address |
| `scheduledAt` | string (ISO) | When to send (09:00–18:00 weekday) |
| `sentAt` | string (ISO) | Actual send timestamp |
| `status` | `"Pending" \| "Sent" \| "Failed" \| "Cancelled"` | Queue item state |
| `subject` | string | Email subject |
| `body` | string | Email body |
| `attemptNumber` | number | 1 = initial, 2 = FU#1, 3 = FU#2 |
| `gmailMessageId` | string | Gmail message ID after send |
| `createdAt` | string (ISO) | Queue entry timestamp |

---

## 6. `companyResearch/{researchId}`

Gemini-generated company intelligence. Created during Step 2 of campaign launch.

| Field | Type | Description |
|---|---|---|
| `id` | string | Document ID |
| `contactId` | string | Reference to source contact |
| `companyName` | string | Company name |
| `summary` | string | Research summary for personalization |
| `techStack` | string[] | Identified or inferred tech stack |
| `hiringSignals` | string[] | Hiring signals detected |
| `productInfo` | string | What this company builds |
| `fundingInfo` | string | Funding context |
| `engineeringFocus` | string | Engineering focus area |
| `enrichedAt` | string (ISO) | When research was generated |

---

## 7. `generatedEmails/{emailId}`

Archive of all Gemini-generated emails.

| Field | Type | Description |
|---|---|---|
| `id` | string | Document ID |
| `contactId` | string | Target contact reference |
| `campaignId` | string | Parent campaign |
| `subject` | string | Generated subject |
| `body` | string | Generated body |
| `generatedAt` | string (ISO) | Generation timestamp |
| `outreachScore` | number | Contact's score at time of generation |

---

## 8. `reports/{reportId}`

Daily outreach summaries.

| Field | Type | Description |
|---|---|---|
| `id` | string | Document ID |
| `date` | string | Report date (YYYY-MM-DD) |
| `emailsSent` | number | Emails sent that day |
| `replies` | number | Replies received |
| `interviews` | number | Interviews secured |
| `followUpsSent` | number | Follow-ups sent |
| `pendingCompanies` | number | Companies not yet contacted |
| `topOpportunities` | object[] | `[{ companyName, role, score, status }]` |
| `generatedAt` | string (ISO) | Report generation timestamp |
| `sentToGmail` | boolean | Whether the report was emailed |

---

## 9. `settings/userSettings`

Single document per user at `/users/{userId}/settings/userSettings`.

| Field | Type | Default | Description |
|---|---|---|---|
| `dailyLimit` | number | 10 | Max emails per day |
| `emailsSentToday` | number | 0 | Counter (resets daily) |
| `lastResetDate` | string | today | YYYY-MM-DD of last counter reset |
| `addFollowUpReminders` | boolean | true | Enable automatic follow-ups |
| `defaultFollowUpDays` | number | 5 | Days until Follow-Up #1 |
| `followUp2Days` | number | 7 | Days until Follow-Up #2 (after FU#1) |
| `archiveDays` | number | 14 | Days until auto-archive (no response) |
| `sendingWindowStart` | string | "09:00" | Sending window start time |
| `sendingWindowEnd` | string | "18:00" | Sending window end time |
| `minDelayMinutes` | number | 120 | Minimum delay between emails |
| `maxDelayMinutes` | number | 240 | Maximum delay between emails |
| `updatedAt` | string (ISO) | — | Last settings update |

---

## 10. `settings/authTokens`

Single document per user at `/users/{userId}/settings/authTokens`. Stores backend OAuth tokens for the background scheduler.

| Field | Type | Description |
|---|---|---|
| `accessToken` | string | Google OAuth 2.0 access token |
| `refreshToken` | string | Google OAuth 2.0 refresh token |
| `expiresAt` | string (ISO) | Token expiration timestamp |
| `updatedAt` | string (ISO) | Last token refresh timestamp |

---

## Recommended Composite Indices

```
Collection: applications
Fields: status (Ascending), updatedAt (Descending)

Collection: emailQueue
Fields: status (Ascending), scheduledAt (Ascending)

Collection: contacts
Fields: priority (Ascending), outreachScore (Descending)

Collection: reports
Fields: date (Descending)
```
