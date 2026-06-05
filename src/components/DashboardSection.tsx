/**
 * Dashboard section — V3.
 * Central monitoring hub: 6 stat widgets + recent activity + high priority companies.
 */

import { useMemo } from "react";
import {
  LayoutDashboard,
  Mail,
  Send,
  MessageSquare,
  Calendar,
  Clock,
  Star,
  TrendingUp,
  Zap,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { Application, Campaign, Contact, EmailQueueItem } from "../types";

interface DashboardSectionProps {
  applications: Application[];
  campaigns: Campaign[];
  contacts: Contact[];
  emailQueue: EmailQueueItem[];
  onNavigate: (section: string) => void;
  onStartCampaign: () => void;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  trend?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`stat-card ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      id={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="p-2.5 rounded-10"
          style={{ background: color + "20", borderRadius: "10px" }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        {trend && (
          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function DashboardSection({
  applications,
  campaigns,
  contacts,
  emailQueue,
  onNavigate,
  onStartCampaign,
}: DashboardSectionProps) {
  const stats = useMemo(() => {
    const scheduled = emailQueue.filter((q) => q.status === "Pending").length;
    const sent = applications.filter(
      (a) =>
        a.status === "Sent" ||
        a.status === "Follow Up 1" ||
        a.status === "Follow Up 2" ||
        a.status === "Follow-Up Sent"
    ).length;
    const replies = applications.filter(
      (a) => a.status === "Replied"
    ).length;
    const interviews = applications.filter(
      (a) => a.status === "Interview" || a.status === "Interview Scheduled"
    ).length;
    const followUpsPending = emailQueue.filter(
      (q) => q.status === "Pending" && q.attemptNumber > 1
    ).length;
    const highPriority = contacts.filter(
      (c) => c.priority === "High"
    ).length;

    return { scheduled, sent, replies, interviews, followUpsPending, highPriority };
  }, [applications, campaigns, contacts, emailQueue]);

  // Recent activity from application timelines
  const recentActivity = useMemo(() => {
    const events: { company: string; note: string; timestamp: string; status: string }[] = [];
    for (const app of applications) {
      for (const t of app.timeline.slice(-2)) {
        events.push({
          company: app.companyName,
          note: t.note,
          timestamp: t.timestamp,
          status: t.status,
        });
      }
    }
    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [applications]);

  // High priority companies
  const highPriorityContacts = useMemo(
    () =>
      contacts
        .filter((c) => c.priority === "High")
        .sort((a, b) => (b.outreachScore || 0) - (a.outreachScore || 0))
        .slice(0, 5),
    [contacts]
  );

  // Active campaigns
  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === "Running").slice(0, 3),
    [campaigns]
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    const diffM = Math.floor(diffMs / 60000);
    if (diffM < 1) return "just now";
    if (diffM < 60) return `${diffM}m ago`;
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  };

  const getStatusColor = (status: string) => {
    if (status.includes("Interview")) return "#16a34a";
    if (status.includes("Replied")) return "#2563eb";
    if (status.includes("Sent")) return "#6366f1";
    if (status.includes("Queued")) return "#f59e0b";
    if (status.includes("Rejected") || status.includes("Archived")) return "#dc2626";
    return "#94a3b8";
  };

  const hasData = contacts.length > 0 || applications.length > 0;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-10 bg-indigo-50" style={{ borderRadius: "10px" }}>
            <LayoutDashboard className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-display">Dashboard</h1>
            <p className="text-sm text-slate-500">Your outreach at a glance</p>
          </div>
        </div>
        <button
          onClick={onStartCampaign}
          className="btn-primary"
          id="dashboard-new-campaign-btn"
        >
          <Zap className="w-3.5 h-3.5" />
          New Campaign
        </button>
      </div>

      {/* Welcome / Empty state */}
      {!hasData && (
        <div
          className="card"
          style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)",
            border: "none",
          }}
        >
          <div className="card-body text-center py-10">
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-indigo-300" />
            </div>
            <h2 className="text-2xl font-bold text-white font-display mb-2">
              Ready to generate interviews?
            </h2>
            <p className="text-indigo-200 text-sm mb-6 max-w-sm mx-auto">
              Upload your resume, import contacts, and let AI handle the rest.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => onNavigate("resume")}
                className="btn-primary text-sm"
                id="dashboard-upload-resume-btn"
              >
                <span>Upload Resume</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate("contacts")}
                className="btn-secondary text-sm bg-white/10 border-white/20 text-white hover:bg-white/20"
                id="dashboard-import-contacts-btn"
              >
                Import Contacts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Scheduled"
          value={stats.scheduled}
          icon={Clock}
          color="#6366f1"
          onClick={() => onNavigate("pipeline")}
        />
        <StatCard
          label="Sent"
          value={stats.sent}
          icon={Send}
          color="#0ea5e9"
          onClick={() => onNavigate("pipeline")}
        />
        <StatCard
          label="Replies"
          value={stats.replies}
          icon={MessageSquare}
          color="#10b981"
          onClick={() => onNavigate("pipeline")}
        />
        <StatCard
          label="Interviews"
          value={stats.interviews}
          icon={Calendar}
          color="#f59e0b"
          onClick={() => onNavigate("pipeline")}
          trend={stats.interviews > 0 ? `${stats.interviews} 🎉` : undefined}
        />
        <StatCard
          label="Follow Ups"
          value={stats.followUpsPending}
          icon={Mail}
          color="#8b5cf6"
          onClick={() => onNavigate("pipeline")}
        />
        <StatCard
          label="High Priority"
          value={stats.highPriority}
          icon={Star}
          color="#ef4444"
          onClick={() => onNavigate("contacts")}
        />
      </div>

      {/* Active Campaigns */}
      {activeCampaigns.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="status-dot running" />
              Active Campaigns
            </h2>
            <button
              onClick={() => onNavigate("campaigns")}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
            >
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {activeCampaigns.map((campaign) => {
              const total = campaign.stats.total || 1;
              const sentPct = Math.round((campaign.stats.sent / total) * 100);
              return (
                <div key={campaign.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{campaign.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {campaign.stats.sent} / {campaign.stats.total} sent
                        {campaign.stats.replies > 0 && ` · ${campaign.stats.replies} replies`}
                        {campaign.stats.interviews > 0 && ` · ${campaign.stats.interviews} interviews`}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-600">{sentPct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${sentPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom grid: High Priority + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High Priority Companies */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              High Priority Companies
            </h2>
            <button
              onClick={() => onNavigate("contacts")}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
            >
              All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {highPriorityContacts.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">
                No high priority companies yet.
                <br />
                <button
                  onClick={() => onNavigate("contacts")}
                  className="text-indigo-600 font-semibold mt-1 hover:underline"
                >
                  Import contacts →
                </button>
              </div>
            ) : (
              highPriorityContacts.map((c) => (
                <div key={c.id} className="px-6 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{c.companyName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.role} · {c.location}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.outreachScore !== undefined && (
                      <div
                        className={`score-ring ${
                          c.outreachScore >= 80
                            ? "very-high"
                            : c.outreachScore >= 60
                            ? "high"
                            : c.outreachScore >= 40
                            ? "medium"
                            : "low"
                        }`}
                        title="Outreach Opportunity Score"
                      >
                        {c.outreachScore}
                      </div>
                    )}
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Recent Activity
            </h2>
          </div>
          <div className="card-body py-2">
            {recentActivity.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                No activity yet.
                <br />
                <button
                  onClick={onStartCampaign}
                  className="text-indigo-600 font-semibold mt-1 hover:underline"
                >
                  Start your first campaign →
                </button>
              </div>
            ) : (
              <div className="space-y-0">
                {recentActivity.map((event, idx) => (
                  <div key={idx} className="activity-item">
                    <div
                      className="activity-dot mt-1"
                      style={{ background: getStatusColor(event.status) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">
                        {event.company}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{event.note}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
