import { useState } from "react";
import { ChevronLeft, CheckCircle2, Loader2, Send, Clock, User as UserIcon, XCircle, AlertCircle, Edit2, Save, X } from "lucide-react";
import { Campaign, EmailQueueItem, Contact, ResumeProfile } from "../types";
import { formatISTDate, formatISTTime } from "../utils/date";

interface CampaignDetailViewProps {
  campaign: Campaign;
  emailQueue: EmailQueueItem[];
  contacts: Contact[];
  resumes: ResumeProfile[];
  onUpdateEmailQueueItem: (id: string, updates: Partial<EmailQueueItem>) => Promise<void>;
  onBack: () => void;
}

export default function CampaignDetailView({
  campaign,
  emailQueue,
  contacts,
  resumes,
  onUpdateEmailQueueItem,
  onBack,
}: CampaignDetailViewProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleEditClick = (item: EmailQueueItem) => {
    setEditingItemId(item.id);
    setEditSubject(item.subject);
    setEditBody(item.body);
  };

  const handleSaveEdit = async (id: string) => {
    setSavingId(id);
    try {
      await onUpdateEmailQueueItem(id, { subject: editSubject, body: editBody });
      setEditingItemId(null);
    } catch (err) {
      console.error("Failed to update email:", err);
    } finally {
      setSavingId(null);
    }
  };

  const queueItems = emailQueue
    .filter((q) => q.campaignId === campaign.id)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const resumeName = resumes.find((r) => r.id === campaign.resumeId)?.fileName || "Resume";

  const getStatusIcon = (status: EmailQueueItem["status"]) => {
    switch (status) {
      case "Pending":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "Sent":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "Failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "Cancelled":
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: EmailQueueItem["status"]) => {
    switch (status) {
      case "Pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Sent":
        return "bg-green-50 text-green-700 border-green-200";
      case "Failed":
        return "bg-red-50 text-red-700 border-red-200";
      case "Cancelled":
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Campaigns
        </button>
        <h1 className="text-2xl font-bold text-slate-900 font-display">{campaign.name}</h1>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">Status: {campaign.status}</span>
          <span>•</span>
          <span>Limit: {campaign.dailyLimit} / day</span>
          <span>•</span>
          <span>Total Contacts: {campaign.stats.total}</span>
          <span>•</span>
          <span>Resume: {resumeName}</span>
        </div>
      </div>

      {/* Queue Items */}
      <div className="card">
        <div className="card-header border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-600" />
            Queued Emails ({queueItems.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {queueItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No items in the queue for this campaign.
            </div>
          ) : (
            queueItems.map((item) => (
              <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800 text-sm">{item.companyName}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">{item.recipientEmail}</span>
                    </div>
                    {editingItemId === item.id ? (
                      <div className="mt-2 space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 w-full max-w-2xl">
                        <div>
                          <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-1 block">Subject</label>
                          <input
                            type="text"
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            className="input-field text-sm font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-1 block">Body</label>
                          <textarea
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            rows={6}
                            className="input-field text-xs font-mono resize-y"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={savingId === item.id}
                            className="btn-primary text-xs py-1.5 px-3"
                          >
                            {savingId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            Save
                          </button>
                          <button
                            onClick={() => setEditingItemId(null)}
                            disabled={savingId === item.id}
                            className="btn-secondary text-xs py-1.5 px-3"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <details className="group mt-1" open={item.status === "Pending"}>
                        <summary className="text-sm font-medium text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors list-none flex items-center gap-2">
                          <span className="line-clamp-1">{item.subject}</span>
                          <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                          {item.status === "Pending" && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleEditClick(item);
                              }}
                              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600"
                              title="Edit email"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </summary>
                        <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 whitespace-pre-wrap font-mono">
                          {item.body}
                        </div>
                      </details>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(item.status)}`}>
                        {getStatusIcon(item.status)}
                        {item.status}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Attempt {item.attemptNumber}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-semibold text-slate-700">
                      {formatISTDate(item.scheduledAt)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {formatISTTime(item.scheduledAt)}
                    </div>
                    {item.sentAt && (
                      <div className="text-[10px] text-green-600 mt-1 font-semibold">
                        Sent {formatISTTime(item.sentAt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
