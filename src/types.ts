/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * V3 Type Definitions — Personal AI Outreach Agent
 */

// ─── Auth / User ──────────────────────────────────────────────────────────────

export interface UserProfile {
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
}

// ─── Resume ───────────────────────────────────────────────────────────────────

export interface ResumeProfile {
  id: string;
  fileName: string;
  uploadedAt: string;
  textContent: string;
  summary: string;
  skills: string[];
  driveLink?: string;
  // Extended fields from Gemini analysis
  projects?: string[];
  experience?: string[];
  achievements?: string[];
  cloudExperience?: string[];
  aiExperience?: string[];
}

// ─── Contact ──────────────────────────────────────────────────────────────────

export type ContactPriority = "High" | "Medium" | "Low";

export interface Contact {
  id: string;
  // Required fields
  companyName: string;
  email: string;
  role: string;
  location: string;
  priority: ContactPriority;
  createdAt: string;

  // Recommended fields
  website?: string;
  personName?: string;
  designation?: string;
  linkedin?: string;
  industry?: string;
  companySize?: string;
  careersUrl?: string;
  reasonForOutreach?: string;
  recentNews?: string;
  techStack?: string;

  // Advanced personalization fields
  recentHiringActivity?: string;
  engineeringBlog?: string;
  founderName?: string;
  companyStage?: string;
  fundingStatus?: string;
  jobUrl?: string;
  personalNotes?: string;

  // Legacy / compat
  recruiterName?: string;
  phone?: string;
  source?: string;

  // Enrichment status
  enriched?: boolean;
  outreachScore?: number;
}

// ─── Company Research ─────────────────────────────────────────────────────────

export interface CompanyResearch {
  id: string;
  contactId: string;
  companyName: string;
  summary: string;
  techStack: string[];
  hiringSignals: string[];
  productInfo: string;
  fundingInfo: string;
  engineeringFocus: string;
  enrichedAt: string;
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export type CampaignStatus = "Draft" | "Running" | "Paused" | "Complete";

export type SendingDays = "full_week" | "weekdays" | "weekends";

/** Per-campaign scheduler overrides — optional, falls back to global settings if omitted. */
export interface CampaignSchedulerSettings {
  sendingWindowStart: string; // "HH:MM"
  sendingWindowEnd: string;   // "HH:MM"
  minDelayMinutes: number;
  maxDelayMinutes: number;
  sendingDays: SendingDays;
}

export interface Campaign {
  id: string;
  name: string;
  resumeId: string;
  status: CampaignStatus;
  dailyLimit: number;
  followUpEnabled: boolean;
  contactIds: string[];
  createdAt: string;
  updatedAt: string;
  stats: {
    total: number;
    queued: number;
    sent: number;
    replies: number;
    interviews: number;
    followUpsSent: number;
  };
  /** Optional per-campaign scheduler overrides */
  schedulerSettings?: CampaignSchedulerSettings;
  // Step progress during launch
  launchProgress?: {
    step: number; // 1-5
    label: string;
    progress: number;
    complete: boolean;
    error?: string | null;
    detail?: string;
  };
}

// ─── Email Queue ──────────────────────────────────────────────────────────────

export type EmailQueueStatus =
  | "Pending"
  | "Sent"
  | "Failed"
  | "Cancelled";

export interface EmailQueueItem {
  id: string;
  campaignId: string;
  contactId: string;
  companyName: string;
  recipientEmail: string;
  scheduledAt: string; // ISO datetime
  sentAt?: string;
  status: EmailQueueStatus;
  subject: string;
  body: string;
  attemptNumber: number; // 1 = initial, 2 = follow-up 1, 3 = follow-up 2
  gmailMessageId?: string;
  createdAt: string;
}

// ─── Generated Email ──────────────────────────────────────────────────────────

export interface GeneratedEmail {
  id: string;
  contactId: string;
  campaignId: string;
  subject: string;
  body: string;
  generatedAt: string;
  outreachScore: number;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export type OutreachStage =
  | "Unreached"
  | "Queued"
  | "Sent"
  | "Follow Up 1"
  | "Follow Up 2"
  | "Replied"
  | "Interview"
  | "Rejected"
  | "Archived";

export interface Application {
  id: string;
  contactId: string;
  campaignId?: string;
  companyName: string;
  recruiterName: string;
  role: string;
  status: OutreachStage | "Not Contacted" | "Draft Generated" | "Follow-Up Sent" | "Interview Scheduled" | "Offer Received";
  matchScore: number;
  outreachScore?: number;
  matchingSkills: string[];
  missingSkills: string[];
  recommendations: string[];
  generatedSubject: string;
  generatedBody: string;
  createdAt: string;
  updatedAt: string;
  lastEmailSentAt?: string;
  followUp1SentAt?: string;
  followUp2SentAt?: string;
  gmailMessageId?: string;
  timeline: {
    status: string;
    timestamp: string;
    note: string;
  }[];
}

// ─── Daily Report ─────────────────────────────────────────────────────────────

export interface DailyReport {
  id: string;
  date: string; // YYYY-MM-DD
  emailsSent: number;
  replies: number;
  interviews: number;
  followUpsSent: number;
  pendingCompanies: number;
  topOpportunities: {
    companyName: string;
    role: string;
    score: number;
    status: string;
  }[];
  generatedAt: string;
  sentToGmail: boolean;
}

// ─── User Settings ────────────────────────────────────────────────────────────

export interface UserSettings {
  dailyLimit: number;
  emailsSentToday: number;
  lastResetDate: string;
  addFollowUpReminders: boolean;
  defaultFollowUpDays: number; // default 5
  followUp2Days: number; // default 7
  archiveDays: number; // default 14
  updatedAt: string;
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export interface ScheduledSlot {
  scheduledAt: string; // ISO datetime
  contactId: string;
  attemptNumber: number;
}
