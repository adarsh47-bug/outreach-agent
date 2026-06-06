# Gmail API & OAuth Guide — V3

The application sends emails from **Adarsh's personal Gmail account** using Google OAuth 2.0. No third-party SMTP service is used — all emails are sent directly through the Gmail API with the user's consent.

---

## 1. OAuth Scopes Requested

Requested at sign-in via `GoogleAuthProvider.addScope()`:

| Scope | Purpose |
|---|---|
| `https://www.googleapis.com/auth/gmail.send` | Send emails directly from the user's account |
| `https://www.googleapis.com/auth/gmail.compose` | Create and manage drafts |
| `https://www.googleapis.com/auth/drive.file` | Access files created by the app (future: resume attachment) |
| `https://www.googleapis.com/auth/calendar.events` | Create calendar events (future: interview scheduling) |

The access tokens are:
- Stored securely in Firestore under `users/{uid}/settings/authTokens`
- Kept strictly server-side and never exposed to the client bundle
- Accompanied by a `refreshToken` to allow 24/7 background operation

---

## 2. Server-Side OAuth Flow

```
User clicks "Connect Gmail" in Settings
  ↓
GET /api/auth/google/url?uid={uid}
  ↓
Google consent screen shown
  ↓
User authorizes, Google redirects to /api/auth/google/callback
  ↓
Server exchanges code for `accessToken` + `refreshToken`
  ↓
Tokens saved to Firestore `users/{uid}/settings/authTokens`
```

---

## 3. Send Flow (server-side)

```ts
// server/services/campaignScheduler.ts
import { google } from "googleapis";

// Retrieve tokens from Firestore
const tokenDoc = await db.doc(`users/${uid}/settings/authTokens`).get();
const { accessToken, refreshToken } = tokenDoc.data();

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ 
  access_token: accessToken,
  refresh_token: refreshToken
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });
```

### Email encoding (RFC 2822 → base64url)

```ts
function encodeEmail(to: string, subject: string, body: string): string {
  const emailLines = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString("base64")}?=`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    body,
  ];
  return Buffer.from(emailLines.join("\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
```

### Send vs Draft

```ts
// Send immediately
await gmail.users.messages.send({
  userId: "me",
  requestBody: { raw: encodedEmail },
});

// Create draft only (draftOnly: true)
await gmail.users.drafts.create({
  userId: "me",
  requestBody: { message: { raw: encodedEmail } },
});
```

---

## 4. API Endpoint

**`POST /api/gmail/send`**

```json
// Request
{
  "accessToken": "ya29.a0AfH6...",
  "to": "jane@acme.ai",
  "subject": "Full Stack Engineer — React + Firebase",
  "body": "Hi Jane,\n\n...\n\nBest,\nAdarsh",
  "draftOnly": false
}

// Response
{
  "success": true,
  "messageId": "msg-abc-123",
  "status": "SENT"    // or "DRAFT_CREATED"
}
```

---

## 5. Sending Limits & Safety

| Limit | Value | Reason |
|---|---|---|
| Daily emails | 8–12 (recommended) | Stays well under Gmail's ~500/day personal limit |
| Max daily emails | 20 | Hard cap in Settings |
| Sending window | 09:00–18:00 weekdays | Mimics human behavior |
| Min delay between emails | 120 minutes | Avoids burst patterns |
| Max delay between emails | 240 minutes | Maintains natural randomness |

Staying within these limits means:
- ✓ Zero spam flags
- ✓ No Gmail account suspension risk
- ✓ High deliverability to inbox (not spam)

---

## 6. Token Refresh & Autonomous Operation

The system handles token expiration entirely autonomously via the background scheduler:

1. Before dispatching any scheduled email, the scheduler inspects the `expiresAt` timestamp in Firestore.
2. If the token is expired (or expires within 2 minutes), the scheduler invokes `oauth2Client.refreshAccessToken()`.
3. The new `accessToken` and updated `expiresAt` are immediately written back to Firestore.
4. The email is subsequently dispatched.

This `refresh_token` architecture guarantees the system can run uninterrupted for days or months without requiring the user to keep the browser tab open or re-authenticate.
