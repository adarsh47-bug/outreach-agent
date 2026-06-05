/**
 * Reports Section — V3.
 * Daily report generation, history, and manual trigger.
 */

import { useState } from "react";
import {
  BarChart3,
  Send,
  MessageSquare,
  Calendar,
  Clock,
  TrendingUp,
  Loader2,
  CheckCircle2,
  FileText,
  Zap,
  Mail,
} from "lucide-react";
import { DailyReport, Application, EmailQueueItem } from "../types";
import { generateDailyReport } from "../services/api";

interface ReportsSectionProps {
  reports: DailyReport[];
  applications: Application[];
  emailQueue: EmailQueueItem[];
  userEmail?: string;
  googleToken: string;
  onSaveReport: (report: DailyReport) => Promise<void>;
  onSignIn: () => void;
}

export default function ReportsSection({
  reports,
  applications,
  emailQueue,
  userEmail,
  googleToken,
  onSaveReport,
  onSignIn,
}: ReportsSectionProps) {
  const [generating, setGenerating] = useState(false);
  const [latestReport, setLatestReport] = useState<{
    subject: string;
    body: string;
    highlights: string[];
    metrics: Record<string, number>;
  } | null>(null);
  const [error, setError] = useState("");

  const computeLiveMetrics = () => {
    const today = new Date().toISOString().split("T")[0];
    const sentToday = applications.filter((a) => {
      const updated = a.updatedAt?.split("T")[0];
      return updated === today && (a.status === "Sent" || a.status === "Follow Up 1" || a.status === "Follow Up 2");
    }).length;

    const replies = applications.filter((a) => a.status === "Replied").length;
    const interviews = applications.filter(
      (a) => a.status === "Interview" || a.status === "Interview Scheduled"
    ).length;
    const followUps = applications.filter(
      (a) => a.status === "Follow Up 1" || a.status === "Follow Up 2" || a.status === "Follow-Up Sent"
    ).length;
    const pending = applications.filter(
      (a) => a.status === "Unreached" || a.status === "Queued" || a.status === "Not Contacted"
    ).length;

    const topOpportunities = applications
      .filter((a) => (a.outreachScore || a.matchScore) > 0)
      .sort((a, b) => (b.outreachScore || b.matchScore) - (a.outreachScore || a.matchScore))
      .slice(0, 5)
      .map((a) => ({
        companyName: a.companyName,
        role: a.role,
        score: a.outreachScore || a.matchScore,
        status: a.status,
      }));

    const recentActivity = applications
      .flatMap((a) =>
        (a.timeline || []).map((t) => ({
          note: `${a.companyName}: ${t.note}`,
          timestamp: t.timestamp,
        }))
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    return {
      emailsSent: sentToday,
      replies,
      interviews,
      followUpsSent: followUps,
      pendingCompanies: pending,
      topOpportunities,
      recentActivity,
    };
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    setError("");

    try {
      const metrics = computeLiveMetrics();
      const today = new Date().toISOString().split("T")[0];

      const result = await generateDailyReport({
        date: today,
        ...metrics,
      });

      setLatestReport({
        subject: result.report.subject,
        body: result.report.body,
        highlights: result.report.highlights || [],
        metrics: result.metrics,
      });

      // Save to Firestore
      const report: DailyReport = {
        id: `report_${today}_${Date.now()}`,
        date: today,
        emailsSent: metrics.emailsSent,
        replies: metrics.replies,
        interviews: metrics.interviews,
        followUpsSent: metrics.followUpsSent,
        pendingCompanies: metrics.pendingCompanies,
        topOpportunities: metrics.topOpportunities,
        generatedAt: new Date().toISOString(),
        sentToGmail: false,
      };

      await onSaveReport(report);
    } catch (err: any) {
      setError(err?.message || "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  const liveMetrics = computeLiveMetrics();

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-10 bg-indigo-50" style={{ borderRadius: "10px" }}>
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-display">Reports</h1>
            <p className="text-sm text-slate-500">
              Daily AI-generated outreach summaries
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={generating}
          className="btn-primary disabled:opacity-60"
          id="generate-report-btn"
        >
          {generating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          {generating ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Today's Live Snapshot */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            Today's Snapshot
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}
          </span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {[
              { label: "Sent Today", value: liveMetrics.emailsSent, icon: Send, color: "#6366f1" },
              { label: "Replies", value: liveMetrics.replies, icon: MessageSquare, color: "#10b981" },
              { label: "Interviews", value: liveMetrics.interviews, icon: Calendar, color: "#f59e0b" },
              { label: "Follow-Ups", value: liveMetrics.followUpsSent, icon: Mail, color: "#8b5cf6" },
              { label: "Pending", value: liveMetrics.pendingCompanies, icon: Clock, color: "#64748b" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="text-center">
                <div
                  className="w-10 h-10 rounded-10 mx-auto mb-2 flex items-center justify-center"
                  style={{ background: color + "15", borderRadius: "10px" }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-2xl font-extrabold text-slate-900 font-display">{value}</p>
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Top opportunities */}
          {liveMetrics.topOpportunities.length > 0 && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">
                Top Opportunities
              </p>
              <div className="space-y-2">
                {liveMetrics.topOpportunities.map((opp, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2 px-3 bg-slate-50 rounded-lg"
                  >
                    <span className="text-sm font-bold text-slate-400 font-mono w-4">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{opp.companyName}</p>
                      <p className="text-xs text-slate-500 truncate">{opp.role} · {opp.status}</p>
                    </div>
                    <div
                      className={`score-ring ${
                        opp.score >= 80 ? "very-high" :
                        opp.score >= 60 ? "high" :
                        opp.score >= 40 ? "medium" : "low"
                      }`}
                      style={{ width: 36, height: 36, fontSize: 11 }}
                    >
                      {opp.score}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Latest Generated Report */}
      {latestReport && (
        <div className="card border-indigo-200 animate-scale-in">
          <div className="card-header bg-gradient-to-r from-indigo-50 to-purple-50">
            <h2 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              Generated Report
            </h2>
            <span className="text-xs text-indigo-400 font-mono">
              {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST
            </span>
          </div>
          <div className="card-body space-y-4">
            {/* Subject */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Subject</p>
              <p className="text-sm font-semibold text-slate-800">{latestReport.subject}</p>
            </div>

            {/* Highlights */}
            {latestReport.highlights.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Highlights</p>
                <div className="space-y-1">
                  {latestReport.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="text-slate-700">{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Report body */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Full Report</p>
              <div className="bg-white border border-slate-100 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-line leading-relaxed font-mono text-xs">
                {latestReport.body}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report History */}
      {reports.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              Report History
            </h2>
            <span className="tag">{reports.length} reports</span>
          </div>
          <div className="divide-y divide-slate-50">
            {reports.slice(0, 14).map((report) => (
              <div
                key={report.id}
                id={`report-${report.id}`}
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{formatDate(report.date)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {report.emailsSent} sent · {report.replies} replies · {report.interviews} interviews
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {report.interviews > 0 && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      🎉 {report.interviews} interview{report.interviews > 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="text-xs font-mono text-slate-400">
                    {new Date(report.generatedAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reports.length === 0 && !latestReport && (
        <div className="card">
          <div className="card-body text-center py-10">
            <BarChart3 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No reports yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Generate your first report to get an AI-written daily summary
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
