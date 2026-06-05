/**
 * Pipeline Section — V3.
 * Kanban-style view of all outreach contacts across 9 pipeline stages.
 */

import { useMemo, useState } from "react";
import {
  GitBranch,
  ChevronDown,
  Mail,
  Calendar,
  MessageSquare,
  Archive,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  Send,
} from "lucide-react";
import { Application } from "../types";

interface PipelineSectionProps {
  applications: Application[];
  onUpdateStatus: (appId: string, status: Application["status"], note: string) => Promise<void>;
  onDeleteApplication: (id: string) => Promise<void>;
}

type PipelineStage = {
  id: string;
  label: string;
  color: string;
  textColor: string;
  icon: React.ElementType;
  description: string;
};

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "Unreached",
    label: "Unreached",
    color: "#f1f5f9",
    textColor: "#64748b",
    icon: Clock,
    description: "Not yet contacted",
  },
  {
    id: "Queued",
    label: "Queued",
    color: "#eff6ff",
    textColor: "#2563eb",
    icon: Mail,
    description: "Scheduled to send",
  },
  {
    id: "Sent",
    label: "Sent",
    color: "#eef2ff",
    textColor: "#4f46e5",
    icon: Send,
    description: "Initial email sent",
  },
  {
    id: "Follow Up 1",
    label: "Follow Up 1",
    color: "#f5f3ff",
    textColor: "#7c3aed",
    icon: Mail,
    description: "Follow-up #1 sent",
  },
  {
    id: "Follow Up 2",
    label: "Follow Up 2",
    color: "#faf5ff",
    textColor: "#9333ea",
    icon: Mail,
    description: "Follow-up #2 sent",
  },
  {
    id: "Replied",
    label: "Replied",
    color: "#ecfdf5",
    textColor: "#059669",
    icon: MessageSquare,
    description: "Reply received",
  },
  {
    id: "Interview",
    label: "Interview 🎉",
    color: "#fefce8",
    textColor: "#d97706",
    icon: Calendar,
    description: "Interview secured!",
  },
  {
    id: "Rejected",
    label: "Rejected",
    color: "#fef2f2",
    textColor: "#dc2626",
    icon: XCircle,
    description: "Not moving forward",
  },
  {
    id: "Archived",
    label: "Archived",
    color: "#f8fafc",
    textColor: "#94a3b8",
    icon: Archive,
    description: "No response / archived",
  },
];

// Map legacy statuses to V3 stages
function normalizeStatus(status: string): string {
  const MAP: Record<string, string> = {
    "Not Contacted": "Unreached",
    "Draft Generated": "Queued",
    "Follow-Up Sent": "Follow Up 1",
    "Interview Scheduled": "Interview",
    "Offer Received": "Interview",
  };
  return MAP[status] || status;
}

const NEXT_STAGES: Record<string, string[]> = {
  Unreached: ["Queued", "Archived"],
  Queued: ["Sent", "Archived"],
  Sent: ["Follow Up 1", "Replied", "Rejected", "Archived"],
  "Follow Up 1": ["Follow Up 2", "Replied", "Rejected", "Archived"],
  "Follow Up 2": ["Replied", "Rejected", "Archived"],
  Replied: ["Interview", "Rejected"],
  Interview: ["Archived"],
  Rejected: ["Archived"],
  Archived: [],
};

export default function PipelineSection({
  applications,
  onUpdateStatus,
  onDeleteApplication,
}: PipelineSectionProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  // Group applications by normalized stage
  const byStage = useMemo(() => {
    const map: Record<string, Application[]> = {};
    PIPELINE_STAGES.forEach((s) => { map[s.id] = []; });

    for (const app of applications) {
      const normalized = normalizeStatus(app.status);
      if (map[normalized]) {
        map[normalized].push(app);
      } else {
        map["Unreached"].push(app);
      }
    }
    return map;
  }, [applications]);

  const totalApps = applications.length;
  const interviewCount = (byStage["Interview"] || []).length;
  const repliedCount = (byStage["Replied"] || []).length;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  };

  const getScoreClass = (score: number) => {
    if (score >= 80) return "very-high";
    if (score >= 60) return "high";
    if (score >= 40) return "medium";
    return "low";
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-10 bg-indigo-50" style={{ borderRadius: "10px" }}>
            <GitBranch className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-display">Pipeline</h1>
            <p className="text-sm text-slate-500">
              {totalApps} contacts · {interviewCount} interviews · {repliedCount} replied
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("kanban")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              view === "kanban" ? "bg-slate-900 text-white" : "btn-secondary py-1.5"
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              view === "list" ? "bg-slate-900 text-white" : "btn-secondary py-1.5"
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Empty state */}
      {totalApps === 0 && (
        <div className="card">
          <div className="card-body text-center py-12">
            <GitBranch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No contacts in pipeline yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Launch a campaign to populate the pipeline
            </p>
          </div>
        </div>
      )}

      {/* Kanban View */}
      {view === "kanban" && totalApps > 0 && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {PIPELINE_STAGES.map((stage) => {
              const apps = byStage[stage.id] || [];
              const Icon = stage.icon;
              return (
                <div
                  key={stage.id}
                  className="pipeline-col"
                  style={{ minWidth: 200, maxWidth: 220 }}
                  id={`pipeline-col-${stage.id.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {/* Column header */}
                  <div className="pipeline-col-header">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" style={{ color: stage.textColor }} />
                      <span style={{ color: stage.textColor, fontSize: 11 }}>{stage.label}</span>
                    </div>
                    <span
                      className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full"
                      style={{ background: stage.color, color: stage.textColor }}
                    >
                      {apps.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2">
                    {apps.map((app) => {
                      const isExpanded = expandedCard === app.id;
                      const nextMoves = NEXT_STAGES[normalizeStatus(app.status)] || [];

                      return (
                        <div
                          key={app.id}
                          id={`pipeline-card-${app.id}`}
                          className="pipeline-card"
                        >
                          {/* Card top */}
                          <div
                            className="cursor-pointer"
                            onClick={() => setExpandedCard(isExpanded ? null : app.id)}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <p className="text-xs font-bold text-slate-800 leading-tight line-clamp-1">
                                {app.companyName}
                              </p>
                              {(app.outreachScore || app.matchScore) ? (
                                <div
                                  className={`score-ring flex-shrink-0`}
                                  style={{
                                    width: 28,
                                    height: 28,
                                    fontSize: 9,
                                    background:
                                      (app.outreachScore || 0) >= 70 ? "#eff6ff" : "#f1f5f9",
                                    color:
                                      (app.outreachScore || 0) >= 70 ? "#2563eb" : "#64748b",
                                    border: `1.5px solid ${(app.outreachScore || 0) >= 70 ? "#93c5fd" : "#e2e8f0"}`,
                                  }}
                                >
                                  {app.outreachScore || app.matchScore}
                                </div>
                              ) : null}
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">{app.role}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {formatDate(app.updatedAt)}
                            </p>
                          </div>

                          {/* Expanded actions */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 animate-fade-in">
                              {nextMoves.length > 0 && (
                                <div>
                                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Move to</p>
                                  <div className="flex flex-wrap gap-1">
                                    {nextMoves.map((next) => (
                                      <button
                                        key={next}
                                        onClick={() => {
                                          onUpdateStatus(app.id, next as Application["status"], `Moved to ${next}`);
                                          setExpandedCard(null);
                                        }}
                                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition"
                                      >
                                        {next} <ArrowRight className="w-2 h-2 inline" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {app.recruiterName && (
                                <p className="text-[10px] text-slate-500 truncate">📧 {app.recruiterName}</p>
                              )}
                              <button
                                onClick={() => onDeleteApplication(app.id)}
                                className="text-[10px] text-red-400 hover:text-red-600 mt-1"
                              >
                                Remove from pipeline
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {view === "list" && totalApps > 0 && (
        <div className="card">
          <div className="divide-y divide-slate-50">
            {applications.map((app) => {
              const normalized = normalizeStatus(app.status);
              const stage = PIPELINE_STAGES.find((s) => s.id === normalized) || PIPELINE_STAGES[0];
              const Icon = stage.icon;
              const nextMoves = NEXT_STAGES[normalized] || [];

              return (
                <div
                  key={app.id}
                  id={`pipeline-list-${app.id}`}
                  className="px-5 py-4 hover:bg-slate-50/50 transition"
                >
                  <div className="flex items-center gap-4">
                    {/* Score */}
                    {app.outreachScore || app.matchScore ? (
                      <div
                        className={`score-ring flex-shrink-0 ${getScoreClass(app.outreachScore || app.matchScore)}`}
                        title="Outreach Score"
                      >
                        {app.outreachScore || app.matchScore}
                      </div>
                    ) : (
                      <div className="w-12 h-12 flex-shrink-0" />
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{app.companyName}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: stage.color, color: stage.textColor }}
                        >
                          <Icon className="w-2.5 h-2.5" />
                          {stage.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{app.role} · Updated {formatDate(app.updatedAt)}</p>
                      {app.generatedSubject && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate italic">"{app.generatedSubject}"</p>
                      )}
                    </div>

                    {/* Quick move */}
                    {nextMoves.length > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {nextMoves.slice(0, 2).map((next) => (
                          <button
                            key={next}
                            onClick={() => onUpdateStatus(app.id, next as Application["status"], `Moved to ${next}`)}
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition"
                          >
                            → {next}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
