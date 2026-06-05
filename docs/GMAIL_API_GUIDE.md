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

The access token is:
- Stored in React state (`googleToken` in `useAuth.ts`)
- Never written to Firestore or localStorage
- Passed to the server in the request body as `accessToken`
- Never logged server-side

---

## 2. OAuth Flow

```
User clicks "Sign in with Google"
  ↓
Firebase signInWithPopup(GoogleAuthProvider)
  + scopes: gmail.send, gmail.compose, drive.file, calendar.events
  ↓
Google consent screen shown
  ↓
On success: credential.accessToken → stored in React state
  ↓
Token passed per-request to POST /api/gmail/send
```

---

## 3. Send Flow (server-side)

```ts
// server/routes/gmail.ts
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2();
oauth2Client.setCredentials({ access_token: accessToken });

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

## 6. Token Refresh

Firebase Google Sign-In tokens expire after ~1 hour. The current implementation requires re-sign-in to refresh. The Settings section shows whether Gmail is connected and which scopes are active.

**Planned:** Automatic token refresh using `google.auth.OAuth2` `refresh_token` — requires the app to be published and verified by Google.
