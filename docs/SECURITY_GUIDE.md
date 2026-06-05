# Security Guide — V3

## 1. Credential Security

### Gemini API Key
- Stored exclusively in server-side `.env` (`GEMINI_API_KEY`)
- Never included in client bundle — Vite's `VITE_` prefix convention is intentionally NOT used
- Never logged in any server route
- The Gemini SDK singleton is initialized in `server/services/gemini.ts` and only accessible within the Express process

### Google OAuth Access Token
- Obtained via `credential.accessToken` from `signInWithPopup` result
- Stored **only** in React component state (`useState("")` in `useAuth.ts`)
- Never written to Firestore, localStorage, or sessionStorage
- Sent to the server as a request body field on `POST /api/gmail/send` only
- Never logged server-side
- Expires after ~1 hour (Firebase session)

### Firebase Config Keys
- These are `VITE_FIREBASE_*` variables — they are public by design (Firebase security enforced via rules, not key secrecy)
- Firebase Security Rules (`firestore.rules`) enforce data isolation

---

## 2. Firestore Security Rules

All user data is isolated by Firebase Auth UID:

```javascript
// firestore.rules (key principle)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

This ensures:
- User A cannot read or write User B's data
- Unauthenticated requests are rejected at the database level
- No server-side auth check needed for Firestore direct calls

---

## 3. Server-Side API Security

### No Auth Middleware (by design)
The Express server routes do not implement session-based auth middleware because:
1. All sensitive data writes go through the Firebase SDK (client-side, with Firebase rules)
2. The server only processes AI tasks (resume parsing, email generation, enrichment) — stateless, no PII stored server-side
3. Gmail send uses the user's own OAuth token — the server never holds credentials

### Input Validation
All routes validate required fields before processing:
```ts
if (!text || typeof text !== "string") {
  res.status(400).json({ error: "Invalid resume text payload." });
  return;
}
```

### Response Sanitization
- Gemini responses are JSON-parsed only if non-null
- Fallback responses are returned on Gemini failure — no raw error stack traces sent to client
- `_fallbackActive: true` flag indicates when AI was unavailable

---

## 4. Gmail Sending Security

- The server receives the OAuth token per-request and uses it only for that request
- The token is not stored, cached, or logged
- MIME message encoding happens server-side using Node.js `Buffer` — no third-party email libraries
- Only `gmail.send` and `gmail.compose` scopes are requested — the app cannot read or delete Gmail messages

---

## 5. Rate Limiting Considerations

The scheduler enforces natural rate limiting:
- Max 20 emails/day (configurable, hard-capped in UI at 20)
- Min 120 minutes between emails
- Weekdays 09:00–18:00 only

This protects against:
- Gmail account suspension
- Being flagged as a spammer
- IP reputation damage

---

## 6. Data Minimization

The application stores only what is needed:
- No resume files are stored (only extracted text + structured fields)
- No email thread content is stored (only message IDs for tracking)
- No OAuth tokens are persisted beyond the browser session
- Contacts contain only what the user explicitly provides via CSV

---

## 7. Environment Variables Checklist

```bash
# Never commit these to git:
GEMINI_API_KEY=...           # Server-only

# Safe to include in Firebase app config (but keep .env out of git):
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_ID=...
```

`.gitignore` must include:
```
.env
*.env.local
dist/
node_modules/
```
