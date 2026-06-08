/**
 * ConnectionStatusBar — always-visible banner at the top of the main content area.
 * Shows Gmail, Firebase, network, and scheduler status with action buttons.
 */
import { Wifi, WifiOff, Mail, Database, Zap, RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { nowMs, formatISTTime } from "../utils/date";
import type { ConnectionHealth } from "../hooks/useConnectionHealth";
import type { User } from "firebase/auth";

interface ConnectionStatusBarProps {
  health: ConnectionHealth;
  user: User | null;
  onForceRefresh: () => void;
  onConnectGmail: () => void;
}

function StatusPill({
  ok,
  label,
  icon: Icon,
}: {
  ok: boolean | "warn";
  label: string;
  icon: React.ElementType;
}) {
  const color =
    ok === true
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : ok === "warn"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-red-700 bg-red-50 border-red-200";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${color}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function ConnectionStatusBar({
  health,
  user,
  onForceRefresh,
  onConnectGmail,
}: ConnectionStatusBarProps) {
  // Only show if there's something worth surfacing
  const hasIssue =
    !health.isOnline ||
    !health.firebaseOk ||
    !health.gmailOk ||
    health.tokenStatus === "expired" ||
    health.tokenStatus === "expiring_soon";

  const allGood =
    health.isOnline &&
    health.firebaseOk &&
    health.gmailOk &&
    health.schedulerRunning &&
    health.tokenStatus === "valid";

  if (!user) return null; // Don't show before login

  const gmailStatus =
    health.tokenStatus === "valid" && health.gmailOk
      ? true
      : health.tokenStatus === "expiring_soon"
      ? "warn"
      : false;

  const formatTime = (iso: string | null) => {
    if (!iso) return null;
    return formatISTTime(iso);
  };

  const formatTimeUntil = (date: Date | null) => {
    if (!date) return null;
    const mins = Math.floor((date.getTime() - nowMs()) / 60_000);
    if (mins <= 0) return "Expired";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div
      style={{
        borderBottom: "1px solid #e2e8f0",
        padding: "6px 24px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        background: allGood
          ? "linear-gradient(90deg, #f0fdf4, #f8fafc)"
          : hasIssue
          ? "linear-gradient(90deg, #fffbeb, #fef2f2)"
          : "#f8fafc",
        fontSize: "11px",
      }}
    >
      {/* Status pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusPill
          ok={health.isOnline}
          label={health.isOnline ? "Online" : "Offline"}
          icon={health.isOnline ? Wifi : WifiOff}
        />
        <StatusPill
          ok={health.firebaseOk}
          label={health.firebaseOk ? "Firebase" : "Firebase ✗"}
          icon={Database}
        />
        <StatusPill
          ok={gmailStatus}
          label={
            health.tokenStatus === "valid"
              ? `Gmail (${formatTimeUntil(health.tokenExpiresAt)} left)`
              : health.tokenStatus === "expiring_soon"
              ? "Gmail expiring"
              : "Gmail ✗"
          }
          icon={Mail}
        />
        <StatusPill
          ok={health.schedulerRunning}
          label={
            health.schedulerRunning
              ? `Scheduler ✓ (${health.emailsSentToday} sent today)`
              : "Scheduler ✗"
          }
          icon={Zap}
        />
      </div>

      {/* Next email info */}
      {health.schedulerNextEmail && (
        <span className="flex items-center gap-1 text-slate-400">
          <Clock className="w-3 h-3" />
          Next: {formatTime(health.schedulerNextEmail)}
        </span>
      )}

      {/* Last checked */}
      {health.lastCheckedAt && (
        <span className="text-slate-300 ml-auto text-[10px]">
          Checked {formatTime(health.lastCheckedAt)}
        </span>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {(health.tokenStatus === "expired" || health.tokenStatus === "expiring_soon") && (
          <button
            onClick={health.tokenStatus === "expired" ? onConnectGmail : onForceRefresh}
            id="connection-refresh-token-btn"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            {health.tokenStatus === "expired" ? "Reconnect Gmail" : "Refresh Token"}
          </button>
        )}
        {!health.isOnline && (
          <span className="inline-flex items-center gap-1 text-red-600 text-[10px] font-semibold">
            <WifiOff className="w-3 h-3" />
            No network — scheduler paused
          </span>
        )}
        {allGood && (
          <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            All systems operational
          </span>
        )}
      </div>
    </div>
  );
}
