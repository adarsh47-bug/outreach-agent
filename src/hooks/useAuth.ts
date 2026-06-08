/**
 * Custom hook for Firebase authentication state management.
 *
 * Improvements for autonomous background operation:
 *  - Persists Google OAuth access token to localStorage (survives page reload).
 *  - Saves token to Firestore `users/{uid}/settings/authTokens` so the
 *    server-side scheduler can dispatch emails without a browser session.
 *  - Auto-refreshes the token when it has < 10 minutes remaining.
 *  - Exposes `tokenStatus` for connection health UI.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { nowMs } from "../utils/date";
import {
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signOut,
  User,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const TOKEN_STORAGE_KEY = "outreach_google_token";
const TOKEN_EXPIRY_KEY = "outreach_token_expiry";
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 minutes (Google tokens last ~60 min)
const REFRESH_THRESHOLD_MS = 10 * 60 * 1000; // refresh when < 10 min left

export type TokenStatus = "valid" | "expiring_soon" | "expired" | "missing";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [googleToken, setGoogleTokenState] = useState("");
  const [tokenExpiresAt, setTokenExpiresAt] = useState<Date | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("missing");
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Token persistence helpers ──────────────────────────────────────────────

  const clearToken = useCallback(() => {
    setGoogleTokenState("");
    setTokenExpiresAt(null);
    setTokenStatus("missing");
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
        setUser(firebaseUser);
        setLoadingAuth(false);

        if (!firebaseUser) {
          clearToken();
        }
      });
      return unsubscribeAuth;
    };
    bootstrap();
  }, [clearToken]);

  // Listen to authTokens from Firestore
  useEffect(() => {
    if (!user) return;
    import("firebase/firestore").then(({ doc, onSnapshot }) => {
      const unsub = onSnapshot(doc(db, "users", user.uid, "settings", "authTokens"), (docSnap) => {
        const data = docSnap.data();
        if (data && data.accessToken && data.expiresAt) {
          let expiresAt: Date;
          if (typeof data.expiresAt.toDate === "function") {
            expiresAt = data.expiresAt.toDate();
          } else {
            expiresAt = new Date(data.expiresAt);
          }
          
          if (isNaN(expiresAt.getTime())) {
            expiresAt = new Date(0);
          }

          setGoogleTokenState(data.accessToken);
          setTokenExpiresAt(expiresAt);

          // Force expired if we don't have a refresh token (to trigger re-auth for new OAuth flow)
          if (!data.refreshToken) {
            setTokenStatus("expired");
          } else {
            // Set Token Status
            const remaining = expiresAt.getTime() - nowMs();
            if (remaining <= 0) {
              setTokenStatus("expired");
            } else if (remaining <= REFRESH_THRESHOLD_MS) {
              setTokenStatus("expiring_soon");
            } else {
              setTokenStatus("valid");
            }
          }
        } else {
          setTokenStatus("missing");
        }
      });
      return () => unsub();
    });
  }, [user]);

  // Poll token status every 30 seconds for UI freshness
  useEffect(() => {
    if (!tokenExpiresAt) return;
    const interval = setInterval(() => {
      const remaining = tokenExpiresAt.getTime() - nowMs();
      if (remaining <= 0) {
        setTokenStatus("expired");
      } else if (remaining <= REFRESH_THRESHOLD_MS) {
        setTokenStatus("expiring_soon");
      } else {
        setTokenStatus("valid");
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [tokenExpiresAt]);

  // ── Sign in / out ──────────────────────────────────────────────────────────

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("[useAuth] Firebase Sign-in successful.");
    } catch (err) {
      console.error("[useAuth] Sign-in failed:", err);
    }
  };

  const handleConnectGmail = async () => {
    if (!user) {
      console.error("Cannot connect Gmail: No user signed in");
      return;
    }
    try {
      const res = await fetch(`/api/auth/google/url?uid=${user.uid}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Server responded with ${res.status}`);
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error("[useAuth] Failed to fetch Google auth url:", err);
      alert(`Could not start Google connection: ${err.message}. Please check your .env configuration.`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      clearToken();
    } catch (err) {
      console.error("[useAuth] Sign-out failed:", err);
    }
  };

  const handleForceRefresh = useCallback(async () => {
    // Rely on backend for token refresh if refresh token exists
    if (!user) return;
    try {
      const res = await fetch(`/api/auth/google/url?uid=${user.uid}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Server responded with ${res.status}`);
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error("[useAuth] Failed to force refresh:", err);
      alert(`Could not refresh Google token: ${err.message}. Please check your .env configuration.`);
    }
  }, [user]);

  return {
    user,
    loadingAuth,
    googleToken,
    setGoogleToken: setGoogleTokenState,
    tokenStatus,
    tokenExpiresAt,
    handleSignIn,
    handleConnectGmail,
    handleSignOut,
    handleForceRefresh,
  };
}
