/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BarChart3, TrendingUp, Compass, Award, MessageSquare } from "lucide-react";
import { Application } from "../types";

interface AnalyticsSectionProps {
  applications: Application[];
}

export default function AnalyticsSection({ applications }: AnalyticsSectionProps) {
  const totalCount = applications.length;
  
  const sentCount = applications.filter(a => ["Sent", "Follow-Up Sent", "Replied", "Interview Scheduled", "Offer Received"].includes(a.status)).length;
  const repliedCount = applications.filter(a => ["Replied", "Interview Scheduled", "Offer Received"].includes(a.status)).length;
  const interviewCount = applications.filter(a => ["Interview Scheduled", "Offer Received"].includes(a.status)).length;
  const offerCount = applications.filter(a => a.status === "Offer Received").length;

  const responseRate = sentCount > 0 ? Math.round((repliedCount / sentCount) * 100) : 0;
  const interviewRate = sentCount > 0 ? Math.round((interviewCount / sentCount) * 100) : 0;
  const offerRate = sentCount > 0 ? Math.round((offerCount / sentCount) * 100) : 0;

  // Render dummy trend bars based on status distribution to show a clean SVG graph
  const statusCounts = {
    "Draft": applications.filter(a => a.status === "Draft Generated" || a.status === "Not Contacted").length,
    "Sent": applications.filter(a => a.status === "Sent" || a.status === "Follow-Up Sent").length,
    "Replies": repliedCount,
    "Interviews": interviewCount,
    "Offers": offerCount
  };

  const maxVal = Math.max(...Object.values(statusCounts), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6" id="analytics-card">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Outreach Funnel & Conversion Analytics
          </h2>
          <p className="text-sm text-slate-500 mt-1">Real-time stats tracking response margins, pipeline stages, and conversion results</p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-mono text-xs px-2.5 py-1 rounded-full border border-indigo-100">
          Updated Today
        </span>
      </div>

      {/* Grid Indicators Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3">
          <div className="bg-indigo-100 p-2 text-indigo-700 rounded-lg shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Leads</span>
            <p className="text-2xl font-black text-slate-800 font-mono leading-none mt-1">{totalCount}</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3">
          <div className="bg-sky-100 p-2 text-sky-700 rounded-lg shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Response Rate</span>
            <p className="text-2xl font-black text-slate-800 font-mono leading-none mt-1">{responseRate}%</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3">
          <div className="bg-amber-100 p-2 text-amber-700 rounded-lg shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Interview Rate</span>
            <p className="text-2xl font-black text-slate-800 font-mono leading-none mt-1">{interviewRate}%</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3">
          <div className="bg-emerald-100 p-2 text-emerald-700 rounded-lg shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Offer Success</span>
            <p className="text-2xl font-black text-slate-800 font-mono leading-none mt-1">{offerRate}%</p>
          </div>
        </div>
      </div>

      {/* Visual Chart Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Dynamic SVG Bar Chart */}
        <div className="lg:col-span-2 bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-4">
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest block mb-1">Conversion Funnel Distribution</h3>

          <div className="pt-2 flex items-end justify-between h-[180px] border-b border-slate-200 pb-1 px-4">
            {Object.entries(statusCounts).map(([label, val]) => {
              const barHeight = val > 0 ? (val / maxVal) * 100 : 8; // min visible block
              return (
                <div key={label} className="flex flex-col items-center w-12 group space-y-2">
                  <span className="text-xs font-mono font-bold text-slate-700 bg-white border border-slate-100 px-1 py-0.5 rounded shadow-sm opacity-80 group-hover:opacity-100">
                    {val}
                  </span>
                  <div
                    className="w-8 rounded-t bg-gradient-to-t from-indigo-500 to-indigo-600 group-hover:from-indigo-600 group-hover:to-indigo-700 transition-all shadow-sm"
                    style={{ height: `${barHeight}px` }}
                  />
                  <span className="text-[10px] font-semibold text-slate-500 font-mono rotate-12 pt-1">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Funnel Conversions Drop-off Summary */}
        <div className="lg:col-span-1 bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Pipeline Conversion Logs</h3>
            <div className="space-y-3 font-mono text-[11px] text-slate-600">
              <div className="flex justify-between border-b border-slate-150 pb-1">
                <span>Created Applications:</span>
                <span className="font-bold text-slate-800">{totalCount}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150 pb-1">
                <span>Dispatched Letters:</span>
                <span className="font-bold text-slate-800">{sentCount}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150 pb-1">
                <span>Recruiter Responses:</span>
                <span className="font-bold text-slate-800">{repliedCount}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150 pb-1">
                <span>Scheduled Interviews:</span>
                <span className="font-bold text-slate-800">{interviewCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Acquired Offers:</span>
                <span className="font-bold text-slate-800">{offerCount}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-3 text-[10px] text-slate-400 leading-normal pl-4 border-l-4 border-l-indigo-600">
            **Data Summary**: Funnel analytics react instantly to pipeline changes adjusted on the CRM Board trackers above. Use Gmail send triggers and log custom recruiter feedback.
          </div>
        </div>
      </div>
    </div>
  );
}
