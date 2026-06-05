# Cloud Functions & Serverless Backend Guide — V3

## Current Architecture

V3 uses an **Express server running via `tsx`** (TypeScript direct execution) for local development. In production, the same Express app is bundled with `esbuild` and served from `node dist/server.cjs`.

This is the recommended approach — simpler than Cloud Functions, no cold starts, no function timeout limits.

---

## Option A: Cloud Run (Recommended)

Wrap the built Express server in a Docker container and deploy to Google Cloud Run.

See [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for complete instructions.

**Advantages:**
- No cold starts (min instances = 1)
- Handles long AI requests (Gemini can take 2–5 seconds)
- Full Node.js environment (pdf-parse, mammoth work natively)
- Gemini API key stored as Cloud Run secret

---

## Option B: Firebase Cloud Functions (Advanced)

If you want pure serverless without a container, wrap the Express app in a Cloud Function:

### Setup

```bash
firebase init functions
# Choose TypeScript, install dependencies
```

### Wrap Express App

```ts
// functions/src/index.ts
import * as functions from "firebase-functions/v2/https";
import express from "express";

// Import all route modules
import campaignRoutes from "../../server/routes/campaign.js";
import outreachRoutes from "../../server/routes/outreach.js";
import reportsRoutes from "../../server/routes/reports.js";
// ... etc

const app = express();
app.use(express.json());
app.use(campaignRoutes);
app.use(outreachRoutes);
app.use(reportsRoutes);
// ... mount all routes

export const api = functions.onRequest(
  {
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 60,       // Gemini can take 5-10 seconds
    memory: "512MiB",
  },
  app
);
```

### Deploy

```bash
firebase deploy --only functions
```

### Caveats with Cloud Functions

| Issue | Notes |
|---|---|
| **pdf-parse** | Binary PDF parsing may not work in all Cloud Function environments — test carefully |
| **mammoth (DOCX)** | Works fine |
| **Cold starts** | First request after idle can take 2–3 seconds |
| **Timeout** | Set to 60s — Gemini normally responds in under 5s |
| **Secrets** | Use `firebase functions:secrets:set GEMINI_API_KEY` |

---

## Recommendation

**For personal use: stay with Cloud Run.**

Cloud Run gives you a persistent container, no timeout issues, no binary library compatibility concerns, and near-identical local-to-production behavior.

Cloud Functions make sense if you want auto-scaling to zero for cost savings at very low traffic volumes — but for a personal outreach tool with 8–12 daily emails, Cloud Run at `--min-instances 0` is effectively free.
