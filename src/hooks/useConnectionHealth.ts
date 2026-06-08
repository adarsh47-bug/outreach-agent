/**
 * useConnectionHealth — monitors all critical connections for autonomous operation.
 *
 * Tracks:
 *  - Network online/offline status (navigator.onLine)
 *  - Firebase Firestore connection state (via a lightweight ping)
 *  - Gmail OAuth token validity + TTL
 *  - Backend scheduler health (via GET /api/scheduler/status)
 */
import { useState, useEffect, useCallback } from "react";
import type { TokenStatus } from "./useAuth";
import { getISTDateString } from "../utils/date";

export interface ConnectionHealth {
  isOnline: boolean;
  firebaseOk: boolean;
  gmailOk: boolean;
  schedulerRunning: boolean;
  schedulerLastTick: string | null;
  schedulerNextEmail: string | null;
  emailsSentToday: number;
  tokenStatus: TokenStatus;
  tokenExpiresAt: Date | null;
  lastCheckedAt: string | null;
}

interface UseConnectionHealthOptions {
  tokenStatus: TokenStatus;
  tokenExpiresAt: Date | null;
  googleToken: string;
  pollIntervalMs?: number;
}

export function useConnectionHealth({
  tokenStatus,
  tokenExpiresAt,
  googleToken,
  pollIntervalMs = 60_000,
}: UseConnectionHealthOptions): ConnectionHealth {
  const [health, setHealth] = useState<ConnectionHealth>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    firebaseOk: true,
    gmailOk: false,
    schedulerRunning: false,
    schedulerLastTick: null,
    schedulerNextEmail: null,
    emailsSentToday: 0,
    tokenStatus,
    tokenExpiresAt,
    lastCheckedAt: null,
  });

  // ── Network status ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () =>
      setHealth((h) => ({ ...h, isOnline: true }));
    const handleOffline = () =>
      setHealth((h) => ({ ...h, isOnline: false }));

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ── Token status sync ──────────────────────────────────────────────────────
  useEffect(() => {
    setHealth((h) => ({
      ...h,
      tokenStatus,
      tokenExpiresAt,
      gmailOk: tokenStatus === "valid" && !!googleToken,
    }));
  }, [tokenStatus, tokenExpiresAt, googleToken]);

  // ── Scheduler status poll ──────────────────────────────────────────────────
  const pollScheduler = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduler/status", { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        setHealth((h) => ({
          ...h,
          firebaseOk: true,
          schedulerRunning: data.scheduler?.running ?? false,
          schedulerLastTick: data.scheduler?.lastTickAt ?? null,
          schedulerNextEmail: data.scheduler?.nextEmailDueAt ?? null,
          emailsSentToday: data.scheduler?.totalEmailsSentToday ?? 0,
          lastCheckedAt: getISTDateString(),
        }));
      } else {
        setHealth((h) => ({ ...h, schedulerRunning: false }));
      }
    } catch {
      // Backend might be briefly unavailable; don't panic
      setHealth((h) => ({
        ...h,
        firebaseOk: false,
        schedulerRunning: false,
        lastCheckedAt: getISTDateString(),
      }));
    }
  }, []);

  useEffect(() => {
    pollScheduler();
    const interval = setInterval(pollScheduler, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollScheduler, pollIntervalMs]);

  return health;
}
