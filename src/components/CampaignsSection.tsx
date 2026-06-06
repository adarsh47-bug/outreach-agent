/**
 * Campaigns Section — V3.
 * Campaign builder with 5-step launch flow, progress indicator, and campaign list.
 */

import { useState, useMemo } from "react";
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
  ChevronRight,
  Users,
  FileText,
  Zap,
  BarChart3,
  X,
  AlertCircle,
  Clock,
  ChevronDown,
} from "lucide-react";
import { Campaign, Contact, ResumeProfile, EmailQueueItem, Application, UserSettings, CompanyResearch, CampaignSchedulerSettings, SendingDays } from "../types";
import { useCampaign, CampaignLaunchProgress } from "../hooks/useCampaign";

interface CampaignsSectionProps {
  campaigns: Campaign[];
  contacts: Contact[];
  resumes: ResumeProfile[];
  emailQueue: EmailQueueItem[];
  applications: Application[];
  settings: UserSettings | null;
  googleToken: string;
  onAddCampaign: (campaign: Campaign) => Promise<void>;
  onUpdateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>;
  onDeleteCampaign: (id: string) => Promise<void>;
  onEnrichComplete: (contactId: string, research: CompanyResearch) => Promise<void>;
  onScoreComplete: (contactId: string, score: number) => Promise<void>;
  onEmailGenerated: (contactId: string, subject: string, body: string) => Promise<void>;
  onQueueItemCreated: (item: EmailQueueItem) => Promise<void>;
  onApplicationUpsert: (app: Partial<Application> & { contactId: string }) => Promise<string>;
  onConnectGmail: () => void;
}

const STEPS = [
  { n: 1, label: "Parse Resume" },
  { n: 2, label: "Enrich Companies" },
  { n: 3, label: "Score Contacts" },
  { n: 4, label: "Generate Emails" },
  { n: 5, label: "Build Queue" },
];

function StepIndicator({
  step,
  currentStep,
  complete,
  label,
}: {
  step: number;
  currentStep: number;
  complete: boolean;
  label: string;
}) {
  const isActive = step === currentStep;
  const isDone = step < currentStep || complete;

  return (
    <div
      className={`step-indicator ${isActive ? "active" : ""} ${isDone ? "complete" : ""}`}
    >
      {isDone ? (
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
      ) : isActive ? (
        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
      )}
      <span className={`text-xs font-semibold ${isActive ? "text-indigo-700" : isDone ? "text-green-700" : "text-slate-400"}`}>
        {label}
      </span>
    </div>
  );
}

export default function CampaignsSection({
  campaigns,
  contacts,
  resumes,
  emailQueue,
  applications,
  settings,
  googleToken,
  onAddCampaign,
  onUpdateCampaign,
  onDeleteCampaign,
  onEnrichComplete,
  onScoreComplete,
  onEmailGenerated,
  onQueueItemCreated,
  onApplicationUpsert,
  onConnectGmail,
}: CampaignsSectionProps) {
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeLaunchId, setActiveLaunchId] = useState<string | null>(null);

  // Builder form state
  const [campaignName, setCampaignName] = useState("");
  const [selectedResumeId, setSelectedResumeId] = useState(resumes[0]?.id || "");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [dailyLimit, setDailyLimit] = useState(settings?.dailyLimit || 10);
  const [followUpEnabled, setFollowUpEnabled] = useState(true);
  const [contactFilter, setContactFilter] = useState("");

  // Per-campaign scheduler overrides — pre-filled from global settings
  const [showScheduler, setShowScheduler] = useState(false);
  const [schedSendingDays, setSchedSendingDays] = useState<SendingDays>(
    (settings as (UserSettings & { sendingDays?: SendingDays }) | null)?.sendingDays ?? "weekdays"
  );
  const [schedWindowStart, setSchedWindowStart] = useState(
    settings?.sendingWindowStart ?? "09:00"
  );
  const [schedWindowEnd, setSchedWindowEnd] = useState(
    settings?.sendingWindowEnd ?? "18:00"
  );
  const [schedMinDelay, setSchedMinDelay] = useState(
    settings?.minDelayMinutes ?? 120
  );
  const [schedMaxDelay, setSchedMaxDelay] = useState(
    settings?.maxDelayMinutes ?? 240
  );

  const { launching, launchProgress: localLaunchProgress, launchCampaign, cancelLaunch } = useCampaign();

  const activeCampaign = useMemo(() => campaigns.find(c => c.id === activeLaunchId), [campaigns, activeLaunchId]);
  const launchProgress = activeCampaign?.launchProgress || localLaunchProgress;

  const filteredContactsForBuilder = useMemo(() => {
    const q = contactFilter.toLowerCase();
    return contacts.filter((c) =>
      !q ||
      c.companyName.toLowerCase().includes(q) ||
      (c.role || "").toLowerCase().includes(q)
    );
  }, [contacts, contactFilter]);

  const handleCreate = async () => {
    if (!campaignName.trim() || selectedContactIds.length === 0 || !selectedResumeId) return;

    const schedulerSettings: CampaignSchedulerSettings = {
      sendingWindowStart: schedWindowStart,
      sendingWindowEnd: schedWindowEnd,
      minDelayMinutes: schedMinDelay,
      maxDelayMinutes: schedMaxDelay,
      sendingDays: schedSendingDays,
    };

    const campId = "camp_" + Math.random().toString(36).substring(2, 10);
    const campaign: Campaign = {
      id: campId,
      name: campaignName.trim(),
      resumeId: selectedResumeId,
      status: "Draft",
      dailyLimit,
      followUpEnabled,
      contactIds: selectedContactIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schedulerSettings,
      stats: {
        total: selectedContactIds.length,
        queued: 0,
        sent: 0,
        replies: 0,
        interviews: 0,
        followUpsSent: 0,
      },
    };

    await onAddCampaign(campaign);
    setShowBuilder(false);
    setCampaignName("");
    setSelectedContactIds([]);
    setShowScheduler(false);
  };

  const handleLaunch = async (campaign: Campaign) => {
    const resume = resumes.find((r) => r.id === campaign.resumeId);
    if (!resume) return;

    const campaignContacts = contacts.filter((c) => campaign.contactIds.includes(c.id));
    if (campaignContacts.length === 0) return;

    setActiveLaunchId(campaign.id);

    await launchCampaign({
      campaign,
      resume,
      contacts: campaignContacts,
      googleToken,
      settings: {
        dailyLimit: campaign.dailyLimit,
        minDelayMinutes: settings?.minDelayMinutes || 120,
        maxDelayMinutes: settings?.maxDelayMinutes || 240,
        followUpEnabled: campaign.followUpEnabled,
      },
      onEnrichComplete,
      onScoreComplete,
      onEmailGenerated,
      onQueueItemCreated,
      onApplicationUpsert,
      onCampaignUpdate: onUpdateCampaign,
    });

    setActiveLaunchId(null);
  };

  const getCampaignQueueStats = (campaignId: string) => {
    const items = emailQueue.filter((q) => q.campaignId === campaignId);
    const pendingItems = items.filter((q) => q.status === "Pending").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return {
      pending: pendingItems.length,
      sent: items.filter((q) => q.status === "Sent").length,
      nextScheduledAt: pendingItems.length > 0 ? pendingItems[0].scheduledAt : null
    };
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });

  const STATUS_CONFIG: Record<Campaign["status"], { color: string; dot: string; label: string }> = {
    Draft: { color: "text-slate-500 bg-slate-100", dot: "draft", label: "Draft" },
    Running: { color: "text-emerald-700 bg-emerald-50 border border-emerald-200", dot: "running", label: "Running" },
    Paused: { color: "text-amber-700 bg-amber-50 border border-amber-200", dot: "pending", label: "Paused" },
    Complete: { color: "text-indigo-700 bg-indigo-50 border border-indigo-200", dot: "complete", label: "Complete" },
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-10 bg-indigo-50" style={{ borderRadius: "10px" }}>
            <Megaphone className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-display">Campaigns</h1>
            <p className="text-sm text-slate-500">
              {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
              {campaigns.filter((c) => c.status === "Running").length > 0 &&
                ` · ${campaigns.filter((c) => c.status === "Running").length} running`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowBuilder(!showBuilder)}
          className="btn-primary"
          id="new-campaign-btn"
        >
          <Plus className="w-3.5 h-3.5" />
          New Campaign
        </button>
      </div>

      {/* Requirements check */}
      {!googleToken && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-10 text-sm text-amber-800" style={{ borderRadius: "10px" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            Connect Google to send emails.{" "}
            <button onClick={onConnectGmail} className="font-semibold underline">Connect Google →</button>
          </span>
        </div>
      )}

      {/* Campaign Builder */}
      {showBuilder && (
        <div className="card animate-scale-in">
          <div className="card-header">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              Build Campaign
            </h2>
            <button onClick={() => setShowBuilder(false)} className="btn-icon">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="card-body space-y-5">
            {/* Name */}
            <div>
              <label className="label">Campaign Name</label>
              <input
                id="campaign-name-input"
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="input-field"
                placeholder="e.g. Series B Startups — June 2026"
              />
            </div>

            {/* Resume */}
            <div>
              <label className="label">Resume</label>
              {resumes.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  ⚠ Upload a resume first.
                </div>
              ) : (
                <select
                  id="campaign-resume-select"
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="input-field"
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>{r.fileName}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Contact Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Select Contacts</label>
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => setSelectedContactIds(contacts.map((c) => c.id))}
                    className="text-indigo-600 hover:underline font-semibold"
                  >
                    Select All ({contacts.length})
                  </button>
                  <button
                    onClick={() => setSelectedContactIds([])}
                    className="text-slate-400 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value)}
                className="input-field mb-2 text-sm"
                placeholder="Search contacts..."
              />
              <div className="border border-slate-200 rounded-10 divide-y divide-slate-100 max-h-56 overflow-y-auto" style={{ borderRadius: "10px" }}>
                {contacts.length === 0 ? (
                  <div className="p-4 text-xs text-slate-400 text-center">
                    No contacts yet. Import a CSV first.
                  </div>
                ) : filteredContactsForBuilder.length === 0 ? (
                  <div className="p-4 text-xs text-slate-400 text-center">No contacts match your search.</div>
                ) : (
                  filteredContactsForBuilder.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedContactIds.includes(c.id)}
                        onChange={(e) =>
                          setSelectedContactIds((prev) =>
                            e.target.checked
                              ? [...prev, c.id]
                              : prev.filter((id) => id !== c.id)
                          )
                        }
                        className="accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-slate-700 block truncate">
                          {c.companyName}
                        </span>
                        <span className="text-xs text-slate-400 truncate">{c.role} · {c.priority}</span>
                      </div>
                      {c.outreachScore !== undefined && (
                        <span className="text-xs font-mono font-bold text-indigo-600">{c.outreachScore}</span>
                      )}
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {selectedContactIds.length} contacts selected
              </p>
            </div>

            {/* Settings row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Daily Limit</label>
                <div className="flex items-center gap-2">
                  <input
                    id="campaign-daily-limit"
                    type="range"
                    min="1"
                    max="20"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value))}
                    className="flex-1 accent-indigo-600"
                  />
                  <span className="text-sm font-bold text-slate-700 w-6 text-center">{dailyLimit}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">emails / day (Gmail safe: max 20)</p>
              </div>
              <div>
                <label className="label">Follow-Ups</label>
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    id="campaign-followup-toggle"
                    type="checkbox"
                    checked={followUpEnabled}
                    onChange={(e) => setFollowUpEnabled(e.target.checked)}
                    className="accent-indigo-600 w-4 h-4"
                  />
                  <span className="text-sm text-slate-700 font-medium">Auto follow-ups</span>
                </label>
                {followUpEnabled && (
                  <p className="text-[10px] text-slate-400 mt-1">Day 5, Day 7, Archive Day 14</p>
                )}
              </div>
            </div>

            {/* Scheduler Settings (collapsible) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                id="campaign-scheduler-toggle"
                type="button"
                onClick={() => setShowScheduler((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  Scheduler Settings
                  <span className="text-[10px] font-normal text-slate-400 ml-1">(overrides global defaults for this campaign)</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    showScheduler ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showScheduler && (
                <div className="px-4 py-4 space-y-4 border-t border-slate-100">
                  {/* Sending Days */}
                  <div>
                    <label className="label">Sending Days</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {([
                        { value: "weekdays", label: "Weekdays", sub: "Mon – Fri" },
                        { value: "full_week", label: "Full Week", sub: "Mon – Sun" },
                        { value: "weekends", label: "Weekends", sub: "Sat – Sun" },
                      ] as { value: SendingDays; label: string; sub: string }[]).map((opt) => (
                        <button
                          key={opt.value}
                          id={`campaign-days-${opt.value}`}
                          type="button"
                          onClick={() => setSchedSendingDays(opt.value)}
                          className={`flex flex-col items-center justify-center gap-0.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                            schedSendingDays === opt.value
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 text-slate-500 hover:border-indigo-200 hover:bg-slate-50"
                          }`}
                        >
                          <span>{opt.label}</span>
                          <span className="text-[10px] font-normal opacity-70">{opt.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sending Window */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Window Start</label>
                      <input
                        id="campaign-window-start"
                        type="time"
                        value={schedWindowStart}
                        onChange={(e) => setSchedWindowStart(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Window End</label>
                      <input
                        id="campaign-window-end"
                        type="time"
                        value={schedWindowEnd}
                        onChange={(e) => setSchedWindowEnd(e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>

                  {/* Delay between emails */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Min Delay (min)</label>
                      <div className="flex items-center gap-2">
                        <input
                          id="campaign-min-delay"
                          type="range"
                          min={60}
                          max={180}
                          step={10}
                          value={schedMinDelay}
                          onChange={(e) => setSchedMinDelay(Number(e.target.value))}
                          className="flex-1 accent-indigo-600"
                        />
                        <span className="text-xs font-bold text-slate-700 w-8 text-right">{schedMinDelay}</span>
                      </div>
                    </div>
                    <div>
                      <label className="label">Max Delay (min)</label>
                      <div className="flex items-center gap-2">
                        <input
                          id="campaign-max-delay"
                          type="range"
                          min={120}
                          max={360}
                          step={10}
                          value={schedMaxDelay}
                          onChange={(e) => setSchedMaxDelay(Number(e.target.value))}
                          className="flex-1 accent-indigo-600"
                        />
                        <span className="text-xs font-bold text-slate-700 w-8 text-right">{schedMaxDelay}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400">
                    These settings apply only to this campaign. Leave the panel collapsed to use global defaults.
                  </p>
                </div>
              )}
            </div>

            {/* Create button */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={!campaignName.trim() || selectedContactIds.length === 0 || !selectedResumeId}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                id="create-campaign-btn"
              >
                <Megaphone className="w-3.5 h-3.5" />
                Create Campaign
              </button>
              <button onClick={() => setShowBuilder(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Launch Progress Modal */}
      {activeLaunchId && launchProgress && (
        <div className="card border-indigo-200 animate-scale-in">
          <div className="card-header bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <h2 className="text-sm font-bold text-indigo-800">Campaign Launching...</h2>
            </div>
            {launchProgress.error && (
              <button onClick={cancelLaunch} className="btn-icon">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="card-body space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>{launchProgress.label}</span>
                <span className="font-mono font-bold">{launchProgress.progress}%</span>
              </div>
              <div className="progress-bar h-2">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${launchProgress.progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">{launchProgress.detail}</p>
            </div>

            {/* Step grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {STEPS.map((s) => (
                <StepIndicator
                  key={s.n}
                  step={s.n}
                  currentStep={launchProgress.step}
                  complete={launchProgress.complete && launchProgress.step >= s.n}
                  label={s.label}
                />
              ))}
            </div>

            {launchProgress.error && (
              <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {launchProgress.error}
                </div>
                <button onClick={() => setActiveLaunchId(null)} className="btn-secondary py-1 px-2 text-xs">Dismiss</button>
              </div>
            )}

            {launchProgress.complete && !launchProgress.error && (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Campaign is live! Emails will be sent on schedule.
                </div>
                <button onClick={() => setActiveLaunchId(null)} className="btn-secondary py-1 px-2 text-xs">Dismiss</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Megaphone className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No campaigns yet</p>
            <p className="text-slate-400 text-sm mt-1">Create a campaign to start automated outreach</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const statusConf = STATUS_CONFIG[campaign.status];
            const queueStats = getCampaignQueueStats(campaign.id);
            const total = campaign.stats.total || 1;
            const sentPct = Math.round((campaign.stats.sent / total) * 100);
            const resumeName = resumes.find((r) => r.id === campaign.resumeId)?.fileName || "Resume";
            const isThisLaunching = activeLaunchId === campaign.id && launching;

            return (
              <div key={campaign.id} id={`campaign-${campaign.id}`} className="card hover:border-indigo-100 transition-colors">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-slate-800 text-sm">{campaign.name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${statusConf.color}`}>
                          <span className={`status-dot ${statusConf.dot}`} style={{ width: 6, height: 6 }} />
                          {statusConf.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {resumeName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {campaign.stats.total} contacts
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          {campaign.stats.sent} sent · {campaign.stats.replies} replies · {campaign.stats.interviews} interviews
                        </span>
                        <span>{formatDate(campaign.createdAt)}</span>
                        {campaign.schedulerSettings && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 font-semibold">
                            <Clock className="w-3 h-3" />
                            {campaign.schedulerSettings.sendingDays === "weekdays"
                              ? "Weekdays"
                              : campaign.schedulerSettings.sendingDays === "weekends"
                              ? "Weekends"
                              : "Full Week"}{" "}
                            · {campaign.schedulerSettings.sendingWindowStart}–{campaign.schedulerSettings.sendingWindowEnd}
                          </span>
                        )}
                      </div>


                      {/* Progress bar */}
                      {(campaign.status === "Running" || campaign.stats.sent > 0) && (
                        <div className="mt-3">
                          <div className="progress-bar">
                            <div className="progress-bar-fill" style={{ width: `${sentPct}%` }} />
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
                            <span>{sentPct}% sent · {queueStats.pending} pending</span>
                            <span>
                              {queueStats.nextScheduledAt
                                ? `Next: ${new Date(queueStats.nextScheduledAt).toLocaleString("en-IN", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}`
                                : `Limit: ${campaign.dailyLimit}/day`}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {campaign.status === "Draft" && (
                        <button
                          onClick={() => handleLaunch(campaign)}
                          disabled={isThisLaunching || launching}
                          className="btn-primary text-xs py-2 disabled:opacity-50"
                          id={`launch-campaign-${campaign.id}`}
                        >
                          {isThisLaunching ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          {isThisLaunching ? "Launching..." : "Launch"}
                        </button>
                      )}
                      {campaign.status === "Running" && (
                        <button
                          onClick={() => onUpdateCampaign(campaign.id, { status: "Paused" })}
                          className="btn-secondary text-xs py-2"
                          id={`pause-campaign-${campaign.id}`}
                        >
                          <Pause className="w-3.5 h-3.5" />
                          Pause
                        </button>
                      )}
                      {campaign.status === "Paused" && (
                        <button
                          onClick={() => onUpdateCampaign(campaign.id, { status: "Running" })}
                          className="btn-primary text-xs py-2"
                          id={`resume-campaign-${campaign.id}`}
                        >
                          <Play className="w-3.5 h-3.5" />
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteCampaign(campaign.id)}
                        className="btn-icon hover:text-red-500 hover:border-red-200"
                        id={`delete-campaign-${campaign.id}`}
                        title="Delete campaign"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
