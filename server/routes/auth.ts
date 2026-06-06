import { Router } from "express";
import { getAdminDb, getAdminFieldValue } from "../services/firebaseAdmin.js";
import { config } from "../config.js";

const router = Router();

router.get("/api/auth/google/url", (req, res) => {
  const { uid } = req.query;
  if (!uid || typeof uid !== "string") {
    res.status(400).json({ error: "Missing user uid" });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: "GOOGLE_CLIENT_ID not configured" });
    return;
  }

  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost:3000";
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state: uid, // Pass the user ID so we know who this token is for when Google redirects back
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

router.get("/api/auth/google/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    res.status(400).send(`OAuth Error: ${error}`);
    return;
  }

  if (!code || typeof code !== "string" || !state || typeof state !== "string") {
    res.status(400).send("Missing code or state");
    return;
  }

  const uid = state;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost:3000";
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    res.status(500).send("Server missing OAuth credentials");
    return;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || data.error || "Failed to exchange code");
    }

    const { access_token, refresh_token, expires_in } = data;

    const db = await getAdminDb();
    
    // Save to Firestore so the scheduler can use it
    const updateData: any = {
      accessToken: access_token,
      expiresAt: new Date(Date.now() + expires_in * 1000).toISOString(),
      updatedAt: getAdminFieldValue().serverTimestamp(),
    };
    
    if (refresh_token) {
      updateData.refreshToken = refresh_token;
    }

    await db.doc(`users/${uid}/settings/authTokens`).set(updateData, { merge: true });

    // Redirect the user back to the settings page or dashboard
    res.redirect("/?google_connected=true");
  } catch (err: any) {
    console.error("Error in Google OAuth callback:", err);
    res.status(500).send(`Failed to authenticate with Google: ${err.message}`);
  }
});

export default router;
