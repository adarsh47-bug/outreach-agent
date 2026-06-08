# Firebase Setup Guide — V3

## 1. Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `outreach-agent-v3`)
3. Disable Google Analytics (not needed)

---

## 2. Enable Services

### Firestore Database
1. Build → Firestore Database → **Create database**
2. Choose **Production mode**
3. Select a region close to you (e.g. `asia-south1` for India)
4. The 9 V3 collections are created automatically on first write

### Authentication
1. Build → Authentication → Get started
2. Sign-in method → **Google** → Enable
3. Add your email as a test user if needed

---

## 3. Get Firebase Config Keys (Client-Side)

1. Project Settings (gear icon) → General
2. Scroll to **Your apps** → Add app → Web (`</>`)
3. Register app name → Copy the `firebaseConfig` object
4. These map to your `.env` variables:

```js
// Firebase gives you:
const firebaseConfig = {
  apiKey: "...",           → VITE_FIREBASE_API_KEY
  authDomain: "...",       → VITE_FIREBASE_AUTH_DOMAIN
  projectId: "...",        → VITE_FIREBASE_PROJECT_ID
  storageBucket: "...",    → VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "...", → VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "..."             → VITE_FIREBASE_APP_ID
};
```

For `VITE_FIREBASE_DATABASE_ID`: use `(default)` unless you created a named database.

---

## 4. Get Firebase Admin SDK Key (Server-Side)

1. Go to Project Settings (gear icon) → **Service accounts**
2. Click **Generate new private key**
3. Save the downloaded JSON file as `service-account.json` in the root of the project (`outreach/service-account.json`)
4. This file allows the backend Express server to securely access Firestore from background tasks (like the automated campaign scheduler).

---

## 5. Configure OAuth for Gmail

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application** as the application type.
4. Add authorized origins: `http://localhost:3000`
5. Add authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
6. Copy the generated **Client ID** and **Client Secret**. Add them to your `.env` file as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

7. Enable these APIs in the Cloud Console:
   - **Gmail API** (for sending emails)
   - **Google Calendar API** (for calendar events)

---

## 6. Configure Firebase Auth Authorized Domains

1. Firebase Console → Authentication → Settings → Authorized domains
2. `localhost` is already there (for dev)
3. Add your Cloud Run URL when deploying to production

---

## 7. Deploy Firestore Security Rules

The rules file at `firestore.rules` enforces user data isolation:

```bash
# Install Firebase CLI if not installed
npm install -g firebase-tools

# Login
firebase login

# Select your project
firebase use YOUR_PROJECT_ID

# Deploy rules only
firebase deploy --only firestore:rules
```

---

## 8. V3 Firestore Collections

All 9 collections are auto-created on first write — no manual setup needed:

```
resumes / contacts / campaigns / applications /
emailQueue / companyResearch / generatedEmails / reports / settings
```

See [`FIRESTORE_SCHEMA.md`](FIRESTORE_SCHEMA.md) for complete field definitions.

---

## 9. Verify Setup

Run the app and check:
- [ ] Sign in with Google popup appears and succeeds
- [ ] Sidebar shows user avatar / email
- [ ] Uploading a resume writes to Firestore (`resumes` collection visible in Firebase Console)
- [ ] In Settings, clicking "Connect Gmail" correctly redirects to Google, asks for permissions, and redirects back.
- [ ] Settings page shows "Connected" and token expiry time after successful Gmail connection.
