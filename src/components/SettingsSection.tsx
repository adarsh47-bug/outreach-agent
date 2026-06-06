/**
 * Settings Section — V3.
 * User preferences: daily limits, sending window, follow-up timing, Gmail connection.
 */

import { useState } from "react";
import {
  Settings,
  Clock,
  Mail,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Zap,
  Database,
  Wifi,
} from "lucide-react";
import { UserSettings, SendingDays } from "../types";
import type { TokenStatus } from "../hooks/useAuth";

interface SettingsSectionProps {
  settings: UserSettings | null;
  userEmail?: string;
  googleToken: string;
  tokenStatus?: TokenStatus;
  tokenExpiresAt?: Date | null;
  onUpdateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  onConnectGmail: () => void;
  onSignOut: () => void;
  onForceRefresh?: () => void;
}

export default function SettingsSection({
  settings,
  userEmail,
  googleToken,
  tokenStatus = "missing",
  tokenExpiresAt,
  onUpdateSettings,
  onConnectGmail,
  onSignOut,
  onForceRefresh,
}: SettingsSectionProps) {
  const defaults = settings || {
    dailyLimit: 10,
    emailsSentToday: 0,
    lastResetDate: new Date().toISOString().split("T")[0],
    addFollowUpReminders: true,
    defaultFollowUpDays: 5,
    followUp2Days: 7,
    archiveDays: 14,
    sendingWindowStart: "09:00",
    sendingWindowEnd: "18:00",
    minDelayMinutes: 120,
    maxDelayMinutes: 240,
    updatedAt: new Date().toISOString(),
  };

  const [dailyLimit, setDailyLimit] = useState(defaults.dailyLimit);
  const [followUp1Days, setFollowUp1Days] = useState(defaults.defaultFollowUpDays);
  const [followUp2Days, setFollowUp2Days] = useState(defaults.followUp2Days);
  const [archiveDays, setArchiveDays] = useState(defaults.archiveDays);
  const [minDelay, setMinDelay] = useState(defaults.minDelayMinutes);
  const [maxDelay, setMaxDelay] = useState(defaults.maxDelayMinutes);
  const [sendingDays, setSendingDays] = useState<SendingDays>(
    (defaults as UserSettings & { sendingDays?: SendingDays }).sendingDays ?? "weekdays"
  );
  const [sendingWindowStart, setSendingWindowStart] = useState(defaults.sendingWindowStart);
  const [sendingWindowEnd, setSendingWindowEnd] = useState(defaults.sendingWindowEnd);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await onUpdateSettings({
        dailyLimit,
        defaultFollowUpDays: followUp1Days,
        followUp2Days,
        archiveDays,
        minDelayMinutes: minDelay,
        maxDelayMinutes: maxDelay,
        sendingDays,
        sendingWindowStart,
        sendingWindowEnd,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error("Save settings error:", e);
    } finally {
      setSaving(false);
    }
  };

  // Generate example schedule times
  const generateExampleTimes = () => {
    const times: string[] = [];
    let currentMin = 9 * 60 + Math.floor(Math.random() * 30); // 09:00–09:30
    for (let i = 0; i < 4; i++) {
      const h = Math.floor(currentMin / 60);
      const m = currentMin % 60;
      if (h >= 18) break;
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      currentMin += minDelay + Math.floor(Math.random() * (maxDelay - minDelay));
    }
    return times;
  };

  const exampleTimes = generateExampleTimes();

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-10 bg-indigo-50" style={{ borderRadius: "10px" }}>
            <Settings className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-display">Settings</h1>
            <p className="text-sm text-slate-500">Configure your outreach preferences</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary disabled:opacity-60"
          id="save-settings-btn"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-300" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      {/* Connection Status */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600" />
            Connection Status
          </h2>
          <span className="text-xs text-slate-400">Required for autonomous operation</span>
        </div>
        <div className="card-body space-y-3">
          {/* Gmail */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                googleToken && tokenStatus === "valid" ? "bg-green-100" :
                tokenStatus === "expiring_soon" ? "bg-amber-100" : "bg-red-100"
              }`}>
                <Mail className={`w-4 h-4 ${
                  googleToken && tokenStatus === "valid" ? "text-green-600" :
                  tokenStatus === "expiring_soon" ? "text-amber-600" : "text-red-600"
                }`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Gmail (OAuth)</p>
                <p className="text-xs text-slate-500">
                  {googleToken && tokenStatus === "valid"
                    ? `Connected${tokenExpiresAt ? ` · expires in ${Math.max(0, Math.floor((tokenExpiresAt.getTime() - Date.now()) / 60_000))}m` : ""}`
                    : tokenStatus === "expiring_soon"
                    ? "Token expiring soon — refresh recommended"
                    : "Not connected"}
                </p>
              </div>
            </div>
            {tokenStatus === "valid" && googleToken ? (
              <div className="flex items-center gap-2">
                {onForceRefresh && (
                  <button
                    onClick={onForceRefresh}
                    id="settings-refresh-token-btn"
                    className="btn-secondary text-xs"
                    title="Refresh Gmail token"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                )}
                <button
                  onClick={onSignOut}
                  className="btn-secondary text-xs"
                  id="settings-signout-btn"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={tokenStatus === "expiring_soon" && onForceRefresh ? onForceRefresh : onConnectGmail}
                className="btn-primary text-xs"
                id="settings-signin-btn"
              >
                {tokenStatus === "expiring_soon" ? "Refresh Token" : "Connect Gmail"}
              </button>
            )}
          </div>

          {/* Firebase */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Database className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">Firebase Firestore</p>
              <p className="text-xs text-slate-500">Real-time sync active · campaigns, contacts, queue</p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          </div>

          {/* Scheduler */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50">
            <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center flex-shrink-0">
              <Wifi className="w-4 h-4 text-indigo-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Background Scheduler</p>
              <p className="text-xs text-slate-500">Dispatches emails every 60s · respects sending window & daily limit</p>
            </div>
          </div>

          <p className="text-[10px] text-slate-400">
            Keep the server running (<span className="font-mono">npm run dev</span>) for autonomous campaign dispatch. Gmail token auto-refreshes every 50 minutes.
          </p>
        </div>
      </div>

      {/* Gmail Connection (legacy — retained for sign-in/out) */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Mail className="w-4 h-4 text-red-500" />
            Gmail Connection
          </h2>
        </div>
        <div className="card-body">
          {googleToken ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Gmail Connected</p>
                <p className="text-xs text-slate-500">{userEmail}</p>
                <p className="text-[10px] text-green-600 mt-0.5">
                  ✓ gmail.send · gmail.compose · drive.file scopes active
                </p>
              </div>
              <button
                onClick={onSignOut}
                className="btn-secondary text-xs ml-auto"
                id="settings-signout-btn"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Gmail Not Connected</p>
                <p className="text-xs text-slate-500">Connect to enable email sending</p>
              </div>
              <button
                onClick={onConnectGmail}
                className="btn-primary text-xs ml-auto"
                id="settings-signin-btn"
              >
                Connect Gmail
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sending Limits */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            Daily Send Limit
          </h2>
          <span className="text-xs text-slate-400">Gmail safe max: 20/day</span>
        </div>
        <div className="card-body space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Emails per Day</label>
              <span className="text-lg font-extrabold text-indigo-600 font-display">{dailyLimit}</span>
            </div>
            <input
              id="daily-limit-slider"
              type="range"
              min={1}
              max={20}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
              <span>1 (conservative)</span>
              <span className="text-amber-600 font-semibold">8–12 recommended</span>
              <span>20 (maximum)</span>
            </div>
          </div>

          {/* Sent today */}
          {settings?.emailsSentToday !== undefined && (
            <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
              <p className="text-xs text-slate-600 font-semibold">Sent today</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-700">
                  {settings.emailsSentToday} / {dailyLimit}
                </span>
                <div className="progress-bar w-24">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(100, (settings.emailsSentToday / dailyLimit) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sending Window + Schedule */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            Scheduler Settings
          </h2>
        </div>
        <div className="card-body space-y-5">
          {/* Sending window */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Window Start</label>
              <input
                id="settings-window-start"
                type="time"
                value={sendingWindowStart}
                onChange={(e) => setSendingWindowStart(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Window End</label>
              <input
                id="settings-window-end"
                type="time"
                value={sendingWindowEnd}
                onChange={(e) => setSendingWindowEnd(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Sending Days */}
          <div>
            <label className="label">Sending Days (Default for all campaigns)</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {([
                { value: "weekdays", label: "Weekdays", sub: "Mon – Fri" },
                { value: "full_week", label: "Full Week", sub: "Mon – Sun" },
                { value: "weekends", label: "Weekends", sub: "Sat – Sun" },
              ] as { value: SendingDays; label: string; sub: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  id={`settings-days-${opt.value}`}
                  onClick={() => setSendingDays(opt.value)}
                  className={`flex flex-col items-center justify-center gap-0.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                    sendingDays === opt.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-500 hover:border-indigo-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="text-[10px] font-normal opacity-70">{opt.sub}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Emails are only dispatched on the selected days. Individual campaigns can override this.
            </p>
          </div>

          {/* Delay settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Min Delay (minutes)</label>
              <div className="flex items-center gap-2">
                <input
                  id="min-delay-slider"
                  type="range"
                  min={60}
                  max={180}
                  step={10}
                  value={minDelay}
                  onChange={(e) => setMinDelay(Number(e.target.value))}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-sm font-bold text-slate-700 w-8 text-right">{minDelay}</span>
              </div>
            </div>
            <div>
              <label className="label">Max Delay (minutes)</label>
              <div className="flex items-center gap-2">
                <input
                  id="max-delay-slider"
                  type="range"
                  min={120}
                  max={360}
                  step={10}
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(Number(e.target.value))}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-sm font-bold text-slate-700 w-8 text-right">{maxDelay}</span>
              </div>
            </div>
          </div>

          {/* Example schedule */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Example Schedule</p>
              <span className="text-[10px] text-slate-400">Human-like randomized times</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {exampleTimes.map((t, i) => (
                <span key={i} className="tag tag-indigo font-mono">{t}</span>
              ))}
              <span className="text-slate-400 text-xs">→ ...</span>
            </div>
          </div>
        </div>
      </div>

      {/* Follow-Up Timing */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-indigo-600" />
            Follow-Up Automation
          </h2>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Follow-Up #1 (days)</label>
              <input
                id="followup1-days-input"
                type="number"
                min={1}
                max={14}
                value={followUp1Days}
                onChange={(e) => setFollowUp1Days(Number(e.target.value))}
                className="input-field"
              />
              <p className="text-[10px] text-slate-400 mt-1">After initial send</p>
            </div>
            <div>
              <label className="label">Follow-Up #2 (days)</label>
              <input
                id="followup2-days-input"
                type="number"
                min={1}
                max={21}
                value={followUp2Days}
                onChange={(e) => setFollowUp2Days(Number(e.target.value))}
                className="input-field"
              />
              <p className="text-[10px] text-slate-400 mt-1">After follow-up #1</p>
            </div>
            <div>
              <label className="label">Auto-Archive (days)</label>
              <input
                id="archive-days-input"
                type="number"
                min={7}
                max={60}
                value={archiveDays}
                onChange={(e) => setArchiveDays(Number(e.target.value))}
                className="input-field"
              />
              <p className="text-[10px] text-slate-400 mt-1">No response → archived</p>
            </div>
          </div>

          {/* Visual timeline */}
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Follow-Up Timeline</p>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px]">D0</div>
                <p className="text-slate-500 mt-1 text-[10px]">Initial</p>
              </div>
              <div className="flex-1 h-px bg-indigo-200" />
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-[10px]">D{followUp1Days}</div>
                <p className="text-slate-500 mt-1 text-[10px]">FU #1</p>
              </div>
              <div className="flex-1 h-px bg-purple-200" />
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-fuchsia-100 flex items-center justify-center text-fuchsia-700 font-bold text-[10px]">D{followUp1Days + followUp2Days}</div>
                <p className="text-slate-500 mt-1 text-[10px]">FU #2</p>
              </div>
              <div className="flex-1 h-px bg-slate-200" />
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px]">D{archiveDays}</div>
                <p className="text-slate-500 mt-1 text-[10px]">Archive</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
