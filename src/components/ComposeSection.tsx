/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Mail, 
  Send, 
  FileCode, 
  CheckCircle, 
  Shield, 
  RefreshCw, 
  Paperclip, 
  Trash2, 
  Calendar, 
  Check, 
} from "lucide-react";
import { Contact, ResumeProfile, Application } from "../types";
import { getISTDateString } from "../utils/date";

interface ComposeSectionProps {
  contacts: Contact[];
  resumes: ResumeProfile[];
  applications: Application[];
  selectedLeadId: string;
  selectedResumeId: string;
  initialSubject: string;
  initialBody: string;
  matchScore: number;
  googleToken: string;
  onConnectGoogle: () => void;
  onSetGoogleToken: (token: string) => void;
  onSendSuccess: (status: string, subject: string, body: string, selectedLeadId: string) => void;
}

export default function ComposeSection({
  contacts,
  resumes,
  applications,
  selectedLeadId,
  selectedResumeId,
  initialSubject,
  initialBody,
  matchScore,
  googleToken,
  onConnectGoogle,
  onSetGoogleToken,
  onSendSuccess,
}: ComposeSectionProps) {
  const [emailType, setEmailType] = useState<"application" | "recruiter_outreach" | "follow_up">("application");
  const [candidateName, setCandidateName] = useState("Adarsh Kadam");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Attachment and Google Drive state
  const [attachmentFile, setAttachmentFile] = useState<{ name: string; base64: string; mimeType: string } | null>(null);
  const [uploadToDrive, setUploadToDrive] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Google Calendar scheduling state
  const [showCalendarForm, setShowCalendarForm] = useState(false);
  const [calendarTitle, setCalendarTitle] = useState("");
  const [calendarDate, setCalendarDate] = useState("");
  const [calendarDescription, setCalendarDescription] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [calendarEventLink, setCalendarEventLink] = useState("");

  // Safety controls state
  const [dailySentCount, setDailySentCount] = useState(8);
  const [dailyLimit, setDailyLimit] = useState(20);
  const [jitterDelay, setJitterDelay] = useState(5); // seconds

  // Update subject and body if props change
  useEffect(() => {
    if (initialSubject) setSubject(initialSubject);
    if (initialBody) setBody(initialBody);
  }, [initialSubject, initialBody]);

  const activeLead = contacts.find((c) => c.id === selectedLeadId);
  const activeResume = resumes.find((r) => r.id === selectedResumeId);
  const activeApp = applications.find((a) => a.contactId === selectedLeadId);


  const handleComposeWithGemini = async () => {
    if (!activeResume || !activeLead) {
      setFeedback("Please configure and link both a Resume Profile and a Recruiter Lead first.");
      return;
    }

    setIsGenerating(true);
    setFeedback("Generating personalized draft proposals using Gemini 3.5 Flash...");

    try {
      const response = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeSummary: activeResume.summary,
          jobDetails: `${activeLead.role} position at ${activeLead.companyName}`,
          recruiterName: activeLead.recruiterName,
          emailType,
          candidateName,
          matchingSkills: activeApp?.matchingSkills || []
        }),
      });

      if (!response.ok) {
        throw new Error("Outreach composer script failed.");
      }

      const draftResult = await response.json();

      setSubject(draftResult.subject || "");
      setBody(draftResult.body || "");
      setFeedback("BESPOKE proposal written successfully! Review and edit text below.");
    } catch (error: any) {
      console.error(error);
      setFeedback("Failed to write proposal: " + (error?.message || "Check server boundaries."));
    } finally {
      setIsGenerating(false);
    }
  };

  // Google Drive multipart uploader with direct view privileges for recruiter
  const handleDriveUploadAndLink = async (): Promise<string | null> => {
    if (!googleToken) return null;
    if (!attachmentFile) return null;

    setIsUploadingToDrive(true);
    setFeedback("Sending PDF payload to Google Drive backup storage...");
    
    try {
      const byteCharacters = atob(attachmentFile.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachmentFile.mimeType });

      const metadata = {
        name: attachmentFile.name,
        mimeType: attachmentFile.mimeType,
      };

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", blob);

      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
        },
        body: form,
      });

      if (!res.ok) {
        throw new Error("Google Drive refused file storage parameters.");
      }

      const fileData = await res.json();
      const fileId = fileData.id;

      setFeedback("Uploading completed! Setting general Google Drive link permissions...");

      // Make the uploaded asset readable to anyone with the link
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone",
        }),
      });

      // Get viewable link
      const detailsRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
        headers: {
          Authorization: `Bearer ${googleToken}`,
        },
      });
      
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        return detailsData.webViewLink;
      }
      return `https://drive.google.com/file/d/${fileId}/view`;
    } catch (err: any) {
      console.error(err);
      setFeedback("Failed Google Drive sync: " + err.message);
      return null;
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const executeDispatch = async (draftOnly: boolean) => {
    if (!subject.trim() || !body.trim()) {
      setFeedback("Draft properties empty. Compose or select preset drafts first.");
      return;
    }
    if (!activeLead) {
      setFeedback("Configure a linked lead contact first.");
      return;
    }

    if (dailySentCount >= dailyLimit) {
      setFeedback("Sending blocked: Daily outreach constraint reached (Maximum 20/day safety).");
      return;
    }

    // Proceed directly without thread-blocking window.confirm to bypass iframe constraints
    setIsSending(true);
    setFeedback(draftOnly ? "Creating secure draft inside Gmail..." : `Staggering queue... (Simulating ${jitterDelay}s safety jitter)`);

    const waitTime = draftOnly ? 200 : jitterDelay * 1000;
    
    setTimeout(async () => {
      try {
        let finalBody = body;
        let driveUrl = "";

        if (uploadToDrive && attachmentFile) {
          const uploadedLink = await handleDriveUploadAndLink();
          if (uploadedLink) {
            driveUrl = uploadedLink;
            finalBody = `${body}\n\n---\n📎 Attached Secure CV Copy (Google Drive):\n${uploadedLink}`;
            setBody(finalBody);
          }
        }

        const response = await fetch("/api/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: googleToken,
            to: activeLead.email,
            subject,
            body: finalBody,
            draftOnly,
            attachment: attachmentFile ? {
              base64: attachmentFile.base64,
              name: attachmentFile.name,
              mimeType: attachmentFile.mimeType
            } : undefined
          }),
        });

        if (!response.ok) {
          throw new Error("Gmail REST API dispatch failed.");
        }

        const data = await response.json();

        if (!draftOnly) {
          setDailySentCount((prev) => prev + 1);
        }

        onSendSuccess(
          data.status, 
          subject,
          finalBody,
          selectedLeadId
        );

        if (data._oauthError) {
          let errorDetails = "";
          if (data._rawError) {
            try {
              const parsed = JSON.parse(data._rawError);
              errorDetails = parsed.error?.message || data._rawError;
            } catch (e) {
              errorDetails = data._rawError;
            }
          }

          if (errorDetails) {
            setFeedback(`Google API Error: ${errorDetails}. Please ensure Gmail API is enabled in your Google Cloud Project console.`);
          } else {
            setFeedback(draftOnly ? "Simulated Draft created! (Connect Google account for actual workspace dispatch)" : `Simulated outreach dispatched to ${activeLead.email}! (Connect Google account for real send)`);
          }
        } else {
          setFeedback(draftOnly ? "Gmail Draft composed and synced!" : `Outreach dispatched safely to ${activeLead.email}!`);
          // Show calendar form immediately after successful send to prompt follower
          setShowCalendarForm(true);
          setCalendarTitle(`Follow up with ${activeLead.recruiterName} (${activeLead.companyName})`);
          setCalendarDescription(`Review application for the ${activeLead.role} role. Outreach was dispatched to ${activeLead.email} on ${new Date().toLocaleDateString()}.`);
          const oneWeek = new Date();
          oneWeek.setDate(oneWeek.getDate() + 7);
          oneWeek.setHours(10, 0, 0, 0);
          setCalendarDate(getISTDateString(oneWeek).substring(0, 16));
        }
      } catch (error: any) {
        console.error(error);
        setFeedback("Failed to dispatch raw request: " + (error?.message || "API token issues."));
      } finally {
        setIsSending(false);
      }
    }, waitTime);
  };

  const handleCreateCalendarEvent = async () => {
    if (!googleToken) {
      setFeedback("Connect your Google account first to enable Calendar Scheduling.");
      return;
    }
    setIsScheduling(true);
    setFeedback("Connecting and validating scheduled event with Google Calendar...");
    try {
      const startDateTime = new Date(calendarDate);
      const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000); // 30 mins

      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: calendarTitle,
          description: calendarDescription,
          start: {
            dateTime: getISTDateString(startDateTime),
          },
          end: {
            dateTime: getISTDateString(endDateTime),
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Google Calendar API returned error status.");
      }

      const eventData = await res.json();
      setFeedback(`📅 Outreach Follow-up successfully configured on your Google Calendar!`);
      if (eventData.htmlLink) {
        setCalendarEventLink(eventData.htmlLink);
      }
    } catch (err: any) {
      console.error(err);
      setFeedback("Could not schedule event: " + err.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleAttachmentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const resultStr = event.target.result as string;
          const base64 = resultStr.split(",")[1];
          setAttachmentFile({
            name: file.name,
            mimeType: file.type || "application/pdf",
            base64
          });
          setFeedback(`📎 Loaded ${file.name} as an outreach attachment.`);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6" id="composer-card">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            Bespoke Email Composer
          </h2>
          <p className="text-sm text-slate-500 mt-1">Address recruiters with optimized, customized, humanized text copy</p>
        </div>
        
        {/* Dynamic G Suite / Workspace Authentication State */}
        <div className="flex items-center gap-2">
          {googleToken ? (
            <span className="bg-emerald-50 text-emerald-700 font-mono text-xs px-2.5 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" /> Google Ecosystem Connected
            </span>
          ) : (
            <button
              id="google-oauth-btn"
              onClick={onConnectGoogle}
              className="bg-indigo-600 hover:bg-indigo-750 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-indigo-200" /> Connect Google Account
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <p className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 rounded p-3 flex items-center gap-1.5 font-mono">
          <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
          {feedback}
        </p>
      )}

      {/* Embedded attachments widget */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">📎 Outreach Attachment (Resume PDF / Copy)</label>
          {attachmentFile && (
            <button
              onClick={() => setAttachmentFile(null)}
              className="text-[11px] text-red-600 hover:text-red-700 flex items-center gap-0.5 cursor-pointer font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove Attachment
            </button>
          )}
        </div>

        {attachmentFile ? (
          <div className="bg-white border border-indigo-100 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 border border-indigo-100 rounded">
                <FileCode className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-800 truncate max-w-[250px]">{attachmentFile.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{attachmentFile.mimeType}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadToDrive}
                  onChange={(e) => setUploadToDrive(e.target.checked)}
                  className="accent-indigo-600"
                />
                <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                  ☁️ Share with Google Drive Link
                </span>
              </label>
            </div>
          </div>
        ) : (
          <div
            onClick={() => attachmentInputRef.current?.click()}
            className="bg-white border border-dashed border-slate-200 hover:border-indigo-400 rounded-lg p-4 cursor-pointer text-center group transition"
          >
            <input
              type="file"
              ref={attachmentInputRef}
              onChange={handleAttachmentFileChange}
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
            />
            <Paperclip className="w-4 h-4 text-slate-400 mx-auto group-hover:text-indigo-600 mb-1" />
            <p className="text-[11px] font-semibold text-slate-600 group-hover:text-indigo-600 transition">
              Click to select or drop a Resume PDF/DOC/TXT to attach
            </p>
          </div>
        )}
      </div>

      {/* Safety compliance controls dashboard */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-600 uppercase mb-1.5">
            <span>Outreach Sent Today</span>
            <span>{dailySentCount} / {dailyLimit} limit</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${dailySentCount >= dailyLimit - 2 ? "bg-amber-500" : "bg-indigo-600"}`}
              style={{ width: `${(dailySentCount / dailyLimit) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 font-mono">Maximum safety compliance budget limit</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Random Delay Queue Jitter (Delay)</label>
          <div className="flex items-center gap-3">
            <input
              id="jitter-delay-slider"
              type="range"
              min="1"
              max="15"
              value={jitterDelay}
              onChange={(e) => setJitterDelay(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <span className="text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded">
              {jitterDelay}s
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">Prevents spam classifications and triggers</p>
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-600 uppercase mb-1">
            <span>ATS Outreach Viability</span>
            <span className="font-bold text-emerald-600">{matchScore}% Score</span>
          </div>
          <div className="text-[10px] text-slate-500 leading-normal">
            {matchScore >= 80 ? (
              <span className="text-emerald-700 font-semibold">● Excellent candidate alignment match</span>
            ) : matchScore >= 60 ? (
              <span className="text-amber-700 font-semibold">▲ Moderate alignment. Tailoring is recommended</span>
            ) : (
              <span className="text-red-700 font-semibold">■ Insufficient qualifications matches</span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-1 font-semibold">Calculated using server-side Gemini keywords check</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs parameters column */}
        <div className="lg:col-span-1 space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Applicant Name Signature</label>
            <input
              id="candidate-name-input"
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded p-2 bg-white focus:outline-none focus:border-indigo-500"
              placeholder="Adarsh Kadam"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Outreach Objective</label>
            <div className="space-y-1.5">
              {[
                { id: "application", name: "Job Application Proposal" },
                { id: "recruiter_outreach", name: "Recruiter Networking Pitch" },
                { id: "follow_up", name: "Staggered Follow-Up Note" },
              ].map((obj) => (
                <label key={obj.id} className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200/60 cursor-pointer hover:bg-slate-100/30">
                  <input
                    id={`obj-radio-${obj.id}`}
                    type="radio"
                    name="outreach_type"
                    value={obj.id}
                    checked={emailType === obj.id}
                    onChange={() => setEmailType(obj.id as any)}
                    className="accent-indigo-600"
                  />
                  <span className="text-xs text-slate-700 font-medium">{obj.name}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            id="generate-compose-btn"
            onClick={handleComposeWithGemini}
            disabled={isGenerating || !selectedLeadId || !selectedResumeId}
            className="w-full bg-indigo-600 hover:bg-indigo-750 font-medium text-white text-xs px-3.5 py-3 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                Synthesizing tailored copy...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-white" />
                Create Proposal Copy with Gemini
              </>
            )}
          </button>
        </div>

        {/* Text Editors Panel */}
        <div className="lg:col-span-2 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Subject</label>
            <input
              id="subject-preview"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-sm font-semibold border border-slate-200 rounded p-2.5 bg-slate-55 focus:outline-none focus:border-indigo-500"
              placeholder="Email subject line..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Body Context</label>
            <textarea
              id="body-preview"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full text-xs font-mono border border-slate-200 rounded-lg p-3 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Dear Hiring Manager..."
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              id="draft-gmail-btn"
              onClick={() => executeDispatch(true)}
              disabled={isSending || isUploadingToDrive || !subject || !body}
              className="bg-white text-slate-700 border border-slate-200 font-medium text-xs px-4 py-2.5 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              Compose Google Draft
            </button>

            <button
              id="send-gmail-btn"
              onClick={() => executeDispatch(false)}
              disabled={isSending || isUploadingToDrive || !subject || !body}
              className="bg-indigo-600 hover:bg-indigo-750 text-white font-medium text-xs px-4 py-2.5 rounded-lg transition flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Send className="w-3 h-3 text-white" />
              Dispatch outreach letter
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Google Calendar Integration Card */}
      {googleToken && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Google Calendar outreach scheduler
            </h4>
            <button
              onClick={() => {
                setShowCalendarForm(!showCalendarForm);
                if (activeLead && !calendarTitle) {
                  setCalendarTitle(`Follow up: ${activeLead.recruiterName} (${activeLead.companyName})`);
                  setCalendarDescription(`Follow up regarding ${activeLead.role} position at ${activeLead.companyName}.\nRecruiter contact: ${activeLead.email}`);
                  const oneWeek = new Date();
                  oneWeek.setDate(oneWeek.getDate() + 7);
                  oneWeek.setHours(10, 0, 0, 0);
                  setCalendarDate(getISTDateString(oneWeek).substring(0, 16));
                }
              }}
              className="text-[11px] text-indigo-700 font-semibold hover:text-indigo-850 underline cursor-pointer"
            >
              {showCalendarForm ? "Hide Planner" : "Configure Follow-up Event"}
            </button>
          </div>

          {showCalendarForm && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5 shadow-sm animate-fade-in text-[12px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Event Summary Title</label>
                  <input
                    type="text"
                    value={calendarTitle}
                    onChange={(e) => setCalendarTitle(e.target.value)}
                    className="w-full text-xs font-sans border border-slate-200 rounded p-2 focus:outline-none focus:border-indigo-500 bg-white"
                    placeholder="Event Name"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Follow-Up date & time</label>
                  <input
                    type="datetime-local"
                    value={calendarDate}
                    onChange={(e) => setCalendarDate(e.target.value)}
                    className="w-full text-xs font-sans border border-slate-200 rounded p-2 focus:outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Agenda Description</label>
                <textarea
                  rows={2}
                  value={calendarDescription}
                  onChange={(e) => setCalendarDescription(e.target.value)}
                  className="w-full text-xs font-sans border border-slate-200 rounded p-2 focus:outline-none focus:border-indigo-500 bg-white"
                  placeholder="Details..."
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                {calendarEventLink ? (
                  <a
                    href={calendarEventLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> View Scheduled Event on Google Calendar →
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-400">Syncs directly with primary GCal account</span>
                )}

                <button
                  onClick={handleCreateCalendarEvent}
                  disabled={isScheduling || !calendarDate || !calendarTitle}
                  className="bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isScheduling ? "Creating event..." : "Add to Google Calendar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
