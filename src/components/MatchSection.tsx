/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, Clipboard, CheckSquare, AlertTriangle, Lightbulb, Target, RefreshCw, Globe, Plus, Briefcase, MapPin } from "lucide-react";
import { ResumeProfile, Contact } from "../types";

interface MatchSectionProps {
  resumes: ResumeProfile[];
  contacts: Contact[];
  selectedResumeId: string;
  onMatchComplete: (result: {
    score: number;
    matchingSkills: string[];
    missingSkills: string[];
    recommendations: string[];
    jobDescriptionRaw: string;
    targetRole: string;
    selectedLeadId: string;
  }) => void;
  onAddContact?: (c: Contact) => void;
}



export default function MatchSection({
  resumes,
  contacts,
  selectedResumeId,
  onMatchComplete,
  onAddContact,
}: MatchSectionProps) {
  const [jobText, setJobText] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Scraping states
  const [jobUrl, setJobUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedLeadInfo, setScrapedLeadInfo] = useState<{
    companyName: string;
    role: string;
    location: string;
    recruiterName: string;
  } | null>(null);

  const handleScrapeUrl = async () => {
    if (!jobUrl.trim() || !jobUrl.startsWith("http")) {
      setFeedback("Please enter a valid career page or job listing web link.");
      return;
    }

    setIsScraping(true);
    setFeedback("Scraping career page and extracting structured job specs...");
    setScrapedLeadInfo(null);

    try {
      const resp = await fetch("/api/scrape/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl.trim() })
      });

      if (!resp.ok) {
        throw new Error("Target server returned error parsing link details.");
      }

      const info = await resp.json();
      setJobText(info.description || "");
      
      // Look if there's an existing contact matching this company name
      const matched = contacts.find(
        (c) => c.companyName.toLowerCase() === info.companyName.toLowerCase()
      );

      if (matched) {
        setSelectedLeadId(matched.id);
        setFeedback(`Job post imported! Linked automatically with existing lead "${matched.recruiterName}" at ${info.companyName}.`);
      } else {
        setScrapedLeadInfo({
          companyName: info.companyName,
          role: info.role,
          location: info.location,
          recruiterName: info.recruiterName
        });
        setFeedback(`Job imported! We couldn't find a recruiter for "${info.companyName}" in your directory. You can create one below.`);
      }

    } catch (err: any) {
      console.error(err);
      setFeedback("Scraper failed to pull info: " + (err.message || "Bypass blocked."));
    } finally {
      setIsScraping(false);
    }
  };

  const handleAddNewScrapedContact = () => {
    if (!scrapedLeadInfo) return;
    const newId = "cont_" + Math.random().toString(36).substring(7);
    const tempContact: Contact = {
      id: newId,
      companyName: scrapedLeadInfo.companyName,
      recruiterName: scrapedLeadInfo.recruiterName || "Hiring Team",
      email: `recruitment@${scrapedLeadInfo.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      phone: "N/A",
      role: scrapedLeadInfo.role,
      location: scrapedLeadInfo.location,
      source: "Web Scraped Job Listing",
      priority: "Medium",
      createdAt: new Date().toISOString()
    };
    
    if (onAddContact) {
      onAddContact(tempContact);
      setSelectedLeadId(newId);
      setFeedback(`Successfully created and linked recruiter contact for ${scrapedLeadInfo.companyName}!`);
    }
    setScrapedLeadInfo(null);
  };

  const activeResume = resumes.find((r) => r.id === selectedResumeId);



  const handleRunMatch = async () => {
    if (!activeResume) {
      setFeedback("Please select an active Resume Profile first in the section above.");
      return;
    }
    if (!jobText.trim()) {
      setFeedback("Please paste the target Job Description or select a template spec.");
      return;
    }
    if (!selectedLeadId) {
      setFeedback("Please link this match to a Recruiter Lead from your directory.");
      return;
    }

    setIsMatching(true);
    setFeedback("Invoking Gemini 3.5 Flash server-side matcher...");

    try {
      const response = await fetch("/api/job/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: activeResume.textContent,
          jobDescription: jobText,
        }),
      });

      if (!response.ok) {
        throw new Error("Alignment verification failed.");
      }

      const matchData = await response.json();

      const selectedLead = contacts.find(c => c.id === selectedLeadId);

      onMatchComplete({
        score: matchData.score || 0,
        matchingSkills: matchData.matchingSkills || [],
        missingSkills: matchData.missingSkills || [],
        recommendations: matchData.recommendations || [],
        jobDescriptionRaw: jobText,
        targetRole: selectedLead?.role || "Target Role",
        selectedLeadId,
      });

      setFeedback("Matching metrics generated and loaded into draft box!");
    } catch (error: any) {
      console.error(error);
      setFeedback("Alignment analysis failed: " + (error?.message || "Limit exceeded."));
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6" id="match-section-card">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            AI Job Match Engine
          </h2>
          <p className="text-sm text-slate-500 mt-1">Verify ATS compliance scores, evaluate skill alignments, and get profile recommendations</p>
        </div>
        <span className="bg-emerald-50 text-emerald-700 font-mono text-xs px-2.5 py-1 rounded-full border border-emerald-100">
          AI Enabled
        </span>
      </div>

      {feedback && (
        <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2 flex items-center gap-1.5 font-mono">
          <Clipboard className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          {feedback}
        </p>
      )}



      {/* Smart URL Scraper Input Group */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-indigo-600" />
            Supercharge: Autofill Specifications from Job Link
          </label>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono px-2 py-0.5 rounded border border-indigo-100">
            Powered by Web Scraper
          </span>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="Paste any careers page URL (e.g., https://careers.google.com/jobs/results/...)"
            className="flex-grow text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={handleScrapeUrl}
            disabled={isScraping || !jobUrl.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition shrink-0 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isScraping ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Scraping Web Details...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Scrape & Import
              </>
            )}
          </button>
        </div>

        {scrapedLeadInfo && (
          <div className="mt-3 bg-indigo-50/50 border border-indigo-100/80 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="space-y-1">
              <p className="font-semibold text-indigo-900 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                Found Job: {scrapedLeadInfo.role} at <span className="font-bold underline">{scrapedLeadInfo.companyName}</span>
              </p>
              <p className="text-indigo-700/80 font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                Location: {scrapedLeadInfo.location || "Unspecified"} | Contact Name: {scrapedLeadInfo.recruiterName || "Hiring Team"}
              </p>
            </div>
            {onAddContact ? (
              <button
                onClick={handleAddNewScrapedContact}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-md transition shadow-xs shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add & Link as Recruiter Lead
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Selecting and Paste Block */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Active Selected Resume</label>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800 truncate max-w-[200px]">
                  {activeResume ? activeResume.fileName : "No resume selected (Please select above)"}
                </span>
                {activeResume && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono">Selected</span>}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Link to Recruiter Lead *</label>
              <select
                id="select-lead-matcher"
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-3 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Connect with Recruiter Lead --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.recruiterName} ({c.companyName} - {c.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Target Job Specifications / Description</label>
            <textarea
              id="job-desc-textarea"
              rows={6}
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
              placeholder="Paste target job descriptions, qualifications requirements, or core projects guidelines here..."
            />
          </div>

          <button
            id="align-match-engine-btn"
            onClick={handleRunMatch}
            disabled={isMatching || !jobText.trim() || !selectedResumeId || !selectedLeadId}
            className="w-full bg-slate-800 hover:bg-slate-900 font-medium text-white text-sm px-5 py-3 rounded-lg transition shadow-sm flex items-center justify-center gap-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            {isMatching ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                Analyzing ATS Core Vectors...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                Analyze Alignment Score with Gemini
              </>
            )}
          </button>
        </div>

        {/* Informational Guidelines Panel */}
        <div className="lg:col-span-1 bg-slate-50 rounded-xl p-5 border border-slate-100 hover:border-slate-200 transition-all space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Target className="w-4 h-4 text-indigo-600" />
            ATS Optimization Tips
          </h3>
          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <p>**Keyword Injection**: Standardize technology arrays to match specifications closely.</p>
            </div>
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <p>**Structured Categories**: Parse bullet lists to isolate work milestones under active verb descriptors.</p>
            </div>
            <div className="flex gap-2">
              <Lightbulb className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <p>**Target Score**: Aim for score outcomes above 80% to bypass gatekeeping tracking systems cleanly.</p>
            </div>
          </div>
          <div className="pt-2">
            <p className="text-[10px] text-slate-400 leading-normal font-mono">Powered by Gemini 3.5 Flash via secure server-side API calls.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
