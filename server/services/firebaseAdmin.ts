/**
 * Firebase Admin SDK — server-side Firestore access.
 *
 * Used exclusively by the CampaignScheduler to read/write Firestore
 * without a browser session. Supports two auth strategies:
 *   1. GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON.
 *   2. Application Default Credentials (gcloud auth, Cloud Run, etc.).
 *
 * If neither is available, adminDb is null and the scheduler degrades gracefully.
 */

import { config } from "../config.js";

let adminDb: any = null;
let adminInitialized = false;
let adminFieldValue: any = null;

export async function getAdminDb() {
  if (adminInitialized) return adminDb;
  adminInitialized = true;

  // Require a project ID — always available from client config fallback
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    "";

  if (!projectId) {
    console.warn(
      "[FirebaseAdmin] FIREBASE_PROJECT_ID not set. Scheduler will run in client-only mode."
    );
    return null;
  }

  try {
    const { initializeApp, getApps, cert, applicationDefault } = await import(
      "firebase-admin/app"
    );
    const { getFirestore, FieldValue } = await import("firebase-admin/firestore");

    if (getApps().length === 0) {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (credPath) {
        // Service account JSON path provided
        const fs = await import("fs");
        const path = await import("path");
        const absolutePath = path.resolve(process.cwd(), credPath);
        const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
        initializeApp({ credential: cert(serviceAccount), projectId });
        console.log("[FirebaseAdmin] Initialized with service account credentials.");
      } else {
        // Application Default Credentials (Cloud Run / local gcloud auth)
        try {
          initializeApp({ credential: applicationDefault(), projectId });
          console.log("[FirebaseAdmin] Initialized with Application Default Credentials.");
        } catch {
          console.warn(
            "[FirebaseAdmin] No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or run `gcloud auth application-default login`. Scheduler will operate in simulation mode."
          );
          return null;
        }
      }
    }

    const dbId =
      process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || "(default)";

    adminDb = getFirestore(dbId);
    adminFieldValue = FieldValue;
    console.log(`[FirebaseAdmin] Firestore connected (database: ${dbId}).`);
    return adminDb;
  } catch (err: any) {
    console.warn("[FirebaseAdmin] Initialization failed:", err?.message);
    return null;
  }
}

export function getAdminFieldValue() {
  return adminFieldValue;
}

