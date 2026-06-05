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

## 3. Get Firebase Config Keys

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

## 4. Configure OAuth for Gmail

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Find the OAuth 2.0 Client ID for your Firebase project
3. Add authorized origins: `http://localhost:3000`
4. Add authorized redirect URIs: your Firebase auth domain (`xxx.firebaseapp.com/__/auth/handler`)

5. Enable these APIs in the Cloud Console:
   - **Gmail API** (for sending emails)
   - **Google Drive API** (for drive.file scope)

---

## 5. Configure Firebase Auth Authorized Domains

1. Firebase Console → Authentication → Settings → Authorized domains
2. `localhost` is already there (for dev)
3. Add your Cloud Run URL when deploying to production

---

## 6. Deploy Firestore Security Rules

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

## 7. V3 Firestore Collections

All 9 collections are auto-created on first write — no manual setup needed:

```
resumes / contacts / campaigns / applications /
emailQueue / companyResearch / generatedEmails / reports / settings
```

See [`FIRESTORE_SCHEMA.md`](FIRESTORE_SCHEMA.md) for complete field definitions.

---

## 8. Verify Setup

Run the app and check:
- [ ] Sign in with Google popup appears and succeeds
- [ ] Sidebar shows user avatar / email
- [ ] Uploading a resume writes to Firestore (`resumes` collection visible in Firebase Console)
- [ ] Settings page shows "Gmail Connected" with green checkmark after sign-in
