/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ListTodo, Milestone, ChevronRight } from "lucide-react";
import { Application } from "../types";

interface TrackerSectionProps {
  applications: Application[];
  onUpdateStatus: (id: string, newStatus: Application["status"], note: string) => void;
  onDeleteApplication: (id: string) => void;
}

const LIFECYCLE_STATUS_OPTIONS: Application["status"][] = [
  "Not Contacted",
  "Draft Generated",
  "Sent",
  "Follow-Up Sent",
  "Replied",
  "Interview Scheduled",
  "Rejected",
  "Offer Received",
];

export default function TrackerSection({
  applications,
  onUpdateStatus,
  onDeleteApplication,
}: TrackerSectionProps) {
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [timelineNote, setTimelineNote] = useState("");

  const activeApp = applications.find((a) => a.id === activeApplicationId);

  const handleStatusChange = (appId: string, status: Application["status"]) => {
    onUpdateStatus(appId, status, `Manual update: Status changed to ${status}`);
  };

  const handleAddCustomTimelineNote = () => {
    if (!activeApplicationId || !timelineNote.trim()) return;
    onUpdateStatus(activeApplicationId, activeApp!.status, timelineNote);
    setTimelineNote("");
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6" id="tracker-card">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-800 flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-indigo-600" />
            Job Outreach CRM & Progress Tracking
          </h2>
          <p className="text-sm text-slate-500 mt-1">Track company submissions, schedule milestones, and log replies securely</p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-mono text-xs px-2.5 py-1 rounded-full border border-indigo-100">
          Tracking {applications.length} leads
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CRM Listings Board */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 block mb-2">Primary Outreach Pipelines</h3>

          {applications.length === 0 ? (
            <div className="h-[250px] border border-slate-100 rounded-xl flex flex-col items-center justify-center p-6 text-center bg-slate-50/20">
              <ListTodo className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-500">No pipelines tracking yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">Link recruiters to job scores in the matcher above to initiate pipelines tracking.</p>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-[420px] pr-1">
              {applications.map((app) => {
                const isActive = activeApplicationId === app.id;
                return (
                  <div
                    id={`app-row-${app.id}`}
                    key={app.id}
                    onClick={() => {
                      setActiveApplicationId(app.id);
                      setTimelineNote("");
                    }}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isActive
                        ? "border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-500"
                        : "border-slate-150 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="space-y-1.5 flex-grow min-w-0 max-w-full">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm truncate">{app.companyName}</span>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500 truncate">{app.recruiterName}</span>
                      </div>
                      <p className="text-xs font-semibold text-indigo-700 truncate">{app.role}</p>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded border border-slate-200">
                          Match: {app.matchScore}%
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Updated {new Date(app.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Status Selectors list */}
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        id={`status-dropdown-${app.id}`}
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value as any)}
                        className="text-xs font-semibold border border-slate-200 rounded px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:border-indigo-500"
                      >
                        {LIFECYCLE_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>

                      <button
                        id={`delete-app-${app.id}`}
                        onClick={() => {
                          onDeleteApplication(app.id);
                          if (isActive) setActiveApplicationId(null);
                        }}
                        className="text-xs text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Applications Detailed Audit Timeline */}
        <div className="lg:col-span-1 bg-slate-50 rounded-xl p-5 border border-slate-150/80 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
            <Milestone className="w-4 h-4 text-indigo-600" />
            Audit Milestones Logs
          </h3>

          {!activeApp ? (
            <div className="h-[200px] flex flex-col items-center justify-center p-4 text-center text-slate-400">
              <Milestone className="w-7 h-7 text-slate-300 mb-1.5" />
              <p className="text-xs">Click on any pipeline record to audit detailed event milestones logs.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700">{activeApp.companyName} Outreach Status</h4>
                <p className="text-[11px] text-indigo-700 font-semibold">{activeApp.status}</p>
              </div>

              {/* Add Custom note trigger */}
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Add Activity Log Note</label>
                <div className="flex gap-2">
                  <input
                    id="milestone-note-input"
                    type="text"
                    value={timelineNote}
                    onChange={(e) => setTimelineNote(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 bg-white focus:outline-none"
                    placeholder="E.g., Recruiter replied via Gmail..."
                  />
                  <button
                    id="submit-milestone-note"
                    onClick={handleAddCustomTimelineNote}
                    className="bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded font-medium hover:bg-slate-900"
                  >
                    Log
                  </button>
                </div>
              </div>

              {/* Timeline feed representation */}
              <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4 overflow-y-auto max-h-[220px] pr-1.5 pt-1.5">
                {activeApp.timeline.map((log, idx) => (
                  <div key={idx} className="relative">
                    {/* Ring dot indicator */}
                    <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-600 border border-white" />
                    
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-400 font-mono block">
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      <p className="text-xs font-medium text-slate-800 leading-normal">{log.note}</p>
                      <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100/50 rounded-full px-2 py-0.5 inline-block mt-1">
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
