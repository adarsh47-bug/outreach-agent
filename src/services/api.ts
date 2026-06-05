/**
 * Centralized API client for backend communication — V3.
 * Covers all backend routes including campaign, scheduler, and reports.
 */

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: response.statusText };
    }
    throw new ApiError(
      errorData?.error || `Request failed with status ${response.status}`,
      response.status,
      errorData
    );
  }

  return response.json();
}

// ─── Resume APIs ──────────────────────────────────────────────────────────────

export async function analyzeResume(text: string) {
  return request<{
    summary: string;
    skills: string[];
    projects?: string[];
    experience?: string[];
    achievements?: string[];
    _fallbackActive?: boolean;
  }>("/api/resume/analyze", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function parseDocument(base64: string, fileName: string, mimeType: string) {
  return request<{ text: string }>("/api/resume/parse-document", {
    method: "POST",
    body: JSON.stringify({ base64, fileName, mimeType }),
  });
}

// ─── Job Matching API ─────────────────────────────────────────────────────────

export async function matchJob(resumeText: string, jobDescription: string) {
  return request<{
    score: number;
    matchingSkills: string[];
    missingSkills: string[];
    recommendations: string[];
    _fallbackActive?: boolean;
  }>("/api/job/match", {
    method: "POST",
    body: JSON.stringify({ resumeText, jobDescription }),
  });
}

// ─── Outreach Generation API ──────────────────────────────────────────────────

export async function generateOutreach(params: {
  resumeSummary: string;
  jobDetails: string;
  recruiterName: string;
  emailType: string;
  candidateName?: string;
  matchingSkills?: string[];
  // V3 enrichment fields
  companyName?: string;
  techStack?: string;
  recentNews?: string;
  reasonForOutreach?: string;
  founderName?: string;
  companyStage?: string;
  recentHiringActivity?: string;
  engineeringFocus?: string;
  talkingPoints?: string[];
  personalNotes?: string;
  outreachScore?: number;
}) {
  return request<{
    subject: string;
    body: string;
    _fallbackActive?: boolean;
  }>("/api/outreach/generate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ─── Scraper API ──────────────────────────────────────────────────────────────

export async function scrapeUrl(url: string) {
  return request<{
    companyName: string;
    role: string;
    location: string;
    description: string;
    recruiterName: string;
    _fallbackActive?: boolean;
  }>("/api/scrape/url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

// ─── Gmail API ────────────────────────────────────────────────────────────────

export async function sendGmail(params: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  draftOnly?: boolean;
  attachment?: { base64: string; name: string; mimeType: string };
}) {
  return request<{
    success: boolean;
    messageId: string;
    status: string;
    _fallbackActive?: boolean;
    _oauthError?: boolean;
    _rawError?: string;
  }>("/api/gmail/send", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ─── Campaign APIs ────────────────────────────────────────────────────────────

export async function createCampaign(params: {
  name: string;
  resumeId: string;
  contactIds: string[];
  dailyLimit: number;
  followUpEnabled: boolean;
}) {
  return request<{
    success: boolean;
    campaignId: string;
    name: string;
    status: string;
    stats: Record<string, number>;
  }>("/api/campaign/create", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function scoreContact(contact: any, resumeSkills: string[]) {
  return request<{
    success: boolean;
    score: number;
    reasons: string[];
    breakdown: Record<string, number>;
  }>("/api/campaign/score-contact", {
    method: "POST",
    body: JSON.stringify({ contact, resumeSkills }),
  });
}

export async function enrichContact(contact: any) {
  return request<{
    success: boolean;
    research: {
      summary: string;
      techStack: string[];
      hiringSignals: string[];
      talkingPoints: string[];
      engineeringFocus: string;
    };
    enrichedAt: string;
    _fallbackActive?: boolean;
  }>("/api/campaign/enrich-contact", {
    method: "POST",
    body: JSON.stringify({ contact }),
  });
}

export async function buildEmailQueue(params: {
  contactCount: number;
  dailyLimit: number;
  startDate?: string;
  minDelay?: number;
  maxDelay?: number;
}) {
  return request<{
    success: boolean;
    slots: string[];
    totalSlots: number;
    estimatedDays: number;
  }>("/api/campaign/build-queue", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ─── Reports APIs ─────────────────────────────────────────────────────────────

export async function generateDailyReport(params: {
  date?: string;
  emailsSent: number;
  replies: number;
  interviews: number;
  followUpsSent: number;
  pendingCompanies: number;
  topOpportunities: any[];
  recentActivity?: any[];
}) {
  return request<{
    success: boolean;
    date: string;
    report: {
      subject: string;
      body: string;
      highlights: string[];
      tomorrowFocus?: string[];
    };
    metrics: Record<string, number>;
    _fallbackActive?: boolean;
  }>("/api/reports/generate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function classifyReply(emailBody: string, subject?: string) {
  return request<{
    success: boolean;
    classification: string;
    confidence: number;
    suggestedAction: string;
    summary: string;
  }>("/api/reports/classify-reply", {
    method: "POST",
    body: JSON.stringify({ emailBody, subject }),
  });
}
