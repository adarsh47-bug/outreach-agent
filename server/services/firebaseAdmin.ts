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
      let credsLoaded = false;

      if (credPath) {
        try {
          const fs = await import("fs");
          const path = await import("path");
          const absolutePath = path.resolve(process.cwd(), credPath);
          if (fs.existsSync(absolutePath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
            initializeApp({ credential: cert(serviceAccount), projectId });
            console.log("[FirebaseAdmin] Initialized with service account credentials.");
            credsLoaded = true;
          } else {
            console.log(`[FirebaseAdmin] Service account file not found at ${absolutePath}. Removing env var to allow ADC fallback.`);
            delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
          }
        } catch (e: any) {
          console.warn(`[FirebaseAdmin] Failed to load service account:`, e?.message);
          delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
        }
      }

      if (!credsLoaded) {
        // Application Default Credentials (Cloud Run / local gcloud auth)
        try {
          initializeApp({ credential: applicationDefault(), projectId });
          console.log("[FirebaseAdmin] Initialized with Application Default Credentials.");
        } catch (err: any) {
          console.warn(
            "[FirebaseAdmin] No credentials found or ADC failed. Scheduler will operate in simulation mode. Error:", err?.message
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

