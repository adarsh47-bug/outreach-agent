# Deployment Guide — V3

## Development (Current)

The app runs in a single process using `tsx` (TypeScript execution):

```bash
npm run dev
# → Starts Express server + Vite dev middleware
# → Visit http://localhost:3000
```

---

## Production Build

```bash
npm run build
# → Vite builds the React SPA to dist/
# → esbuild bundles server/index.ts to dist/server.cjs

npm run start
# → node dist/server.cjs
# → Serves Vite build as static files + API routes
```

---

## Cloud Run Deployment

### Prerequisites
- Google Cloud project with Cloud Run enabled
- `gcloud` CLI authenticated
- `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` stored in Secret Manager

### Steps

#### 1. Store secrets
```bash
gcloud secrets create GEMINI_API_KEY --data-file=- <<< "your-gemini-key"
gcloud secrets create GOOGLE_CLIENT_ID --data-file=- <<< "your-google-client-id"
gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=- <<< "your-google-client-secret"
```

#### 2. Build Docker image
Create `Dockerfile`:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/server.cjs"]
```

#### 3. Build and push
```bash
# Build production bundle first
npm run build

# Build container
docker build -t gcr.io/YOUR_PROJECT_ID/outreach-agent .

# Push to Artifact Registry
docker push gcr.io/YOUR_PROJECT_ID/outreach-agent
```

#### 4. Deploy to Cloud Run
```bash
gcloud run deploy outreach-agent \
  --image gcr.io/YOUR_PROJECT_ID/outreach-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest \
  --set-env-vars PORT=3000
```

---

## Environment Variables for Production

All `VITE_FIREBASE_*` variables must be set at **build time** (baked into the client bundle):

```bash
# Set in Cloud Run as env vars or in .env before building
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_ID=...

# Server-side only (set as Cloud Run secrets)
GEMINI_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Firebase Authorized Domains

After deploying, add your Cloud Run URL to Firebase Auth's authorized domains:

1. Firebase Console → Authentication → Settings → Authorized Domains
2. Add: `your-service-xyz.run.app`

---

## Scripts Reference

```bash
npm run dev      # Local dev (Vite + Express)
npm run build    # Production bundle
npm run start    # Run production server
npm run lint     # TypeScript type check
npm run clean    # Delete dist/
```
