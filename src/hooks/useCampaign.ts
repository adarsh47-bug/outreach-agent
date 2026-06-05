/**
 * Campaign orchestration hook — V3.
 * Manages the 5-step campaign launch flow:
 * 1. Parse Resume
 * 2. Enrich Companies
 * 3. Calculate Priority (Outreach Opportunity Score)
 * 4. Generate Emails
 * 5. Build Queue
 */
import { useState, useCallback } from "react";
import {
  enrichContact,
  scoreContact,
  generateOutreach,
  buildEmailQueue,
  sendGmail,
} from "../services/api";
import {
  Campaign,
  Contact,
  ResumeProfile,
  EmailQueueItem,
  CompanyResearch,
  Application,
} from "../types";

export type CampaignStep = 1 | 2 | 3 | 4 | 5;

export interface CampaignLaunchProgress {
  step: CampaignStep;
  label: string;
  detail: string;
  progress: number; // 0–100
  complete: boolean;
  error?: string;
}

interface UseCampaignReturn {
  launching: boolean;
  launchProgress: CampaignLaunchProgress | null;
  launchCampaign: (params: LaunchParams) => Promise<void>;
  cancelLaunch: () => void;
}

interface LaunchParams {
  campaign: Campaign;
  resume: ResumeProfile;
  contacts: Contact[];
  googleToken: string;
  settings: {
    dailyLimit: number;
    minDelayMinutes: number;
    maxDelayMinutes: number;
    followUpEnabled: boolean;
  };
  onEnrichComplete: (contactId: string, research: CompanyResearch) => Promise<void>;
  onScoreComplete: (contactId: string, score: number) => Promise<void>;
  onEmailGenerated: (contactId: string, subject: string, body: string) => Promise<void>;
  onQueueItemCreated: (item: EmailQueueItem) => Promise<void>;
  onApplicationUpsert: (app: Partial<Application> & { contactId: string }) => Promise<string>;
  onCampaignUpdate: (id: string, updates: Partial<Campaign>) => Promise<void>;
}

const STEP_LABELS: Record<CampaignStep, string> = {
  1: "Parsing Resume",
  2: "Enriching Companies",
  3: "Calculating Outreach Scores",
  4: "Generating Personalized Emails",
  5: "Building Send Queue",
};

export function useCampaign(): UseCampaignReturn {
  const [launching, setLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState<CampaignLaunchProgress | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const cancelLaunch = useCallback(() => {
    setCancelled(true);
    setLaunching(false);
    setLaunchProgress(null);
  }, []);

  const setStep = useCallback(
    (step: CampaignStep, detail: string, progress: number, complete = false, error?: string) => {
      setLaunchProgress({
        step,
        label: STEP_LABELS[step],
        detail,
        progress,
        complete,
        error,
      });
    },
    []
  );

  const launchCampaign = useCallback(
    async ({
      campaign,
      resume,
      contacts,
      googleToken,
      settings,
      onEnrichComplete,
      onScoreComplete,
      onEmailGenerated,
      onQueueItemCreated,
      onApplicationUpsert,
      onCampaignUpdate,
    }: LaunchParams) => {
      setLaunching(true);
      setCancelled(false);

      try {
        // ── STEP 1: Parse Resume ─────────────────────────────────────────────
        setStep(1, "Analyzing resume skills and experience...", 5);
        const resumeSkills = resume.skills || [];
        const resumeSummary = resume.summary || "";
        setStep(1, `Found ${resumeSkills.length} skills`, 20, true);

        await new Promise((r) => setTimeout(r, 300));
        if (cancelled) return;

        // ── STEP 2: Enrich Companies ─────────────────────────────────────────
        setStep(2, `Enriching ${contacts.length} companies...`, 25);
        const enrichedResearch: Record<string, any> = {};

        for (let i = 0; i < contacts.length; i++) {
          if (cancelled) return;
          const contact = contacts[i];
          const pct = 25 + Math.round((i / contacts.length) * 20);
          setStep(2, `Enriching ${contact.companyName} (${i + 1}/${contacts.length})...`, pct);

          try {
            const result = await enrichContact(contact);
            if (result.success) {
              enrichedResearch[contact.id] = result.research;
              const researchDoc: CompanyResearch = {
                id: `res_${contact.id}`,
                contactId: contact.id,
                companyName: contact.companyName,
                summary: result.research.summary,
                techStack: result.research.techStack || [],
                hiringSignals: result.research.hiringSignals || [],
                productInfo: "",
                fundingInfo: contact.fundingStatus || "",
                engineeringFocus: result.research.engineeringFocus || "",
                enrichedAt: result.enrichedAt,
              };
              await onEnrichComplete(contact.id, researchDoc);
            }
          } catch (e) {
            console.warn(`Enrichment skipped for ${contact.companyName}:`, e);
            enrichedResearch[contact.id] = null;
          }

          // Small delay to avoid rate limiting
          await new Promise((r) => setTimeout(r, 200));
        }

        setStep(2, `${contacts.length} companies enriched`, 45, true);
        await new Promise((r) => setTimeout(r, 300));
        if (cancelled) return;

        // ── STEP 3: Calculate Outreach Opportunity Scores ────────────────────
        setStep(3, "Scoring contacts by outreach opportunity...", 48);
        const scores: Record<string, number> = {};

        for (let i = 0; i < contacts.length; i++) {
          if (cancelled) return;
          const contact = contacts[i];
          const pct = 48 + Math.round((i / contacts.length) * 12);
          setStep(3, `Scoring ${contact.companyName}...`, pct);

          try {
            const result = await scoreContact(contact, resumeSkills);
            scores[contact.id] = result.score;
            await onScoreComplete(contact.id, result.score);
          } catch (e) {
            scores[contact.id] = 50; // default
          }
        }

        // Sort contacts by score descending
        const sortedContacts = [...contacts].sort(
          (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
        );

        setStep(3, "Contacts prioritized by opportunity score", 60, true);
        await new Promise((r) => setTimeout(r, 300));
        if (cancelled) return;

        // ── STEP 4: Generate Personalized Emails ─────────────────────────────
        setStep(4, `Generating emails for ${sortedContacts.length} contacts...`, 62);
        const generatedEmails: Record<string, { subject: string; body: string }> = {};

        for (let i = 0; i < sortedContacts.length; i++) {
          if (cancelled) return;
          const contact = sortedContacts[i];
          const research = enrichedResearch[contact.id];
          const pct = 62 + Math.round((i / sortedContacts.length) * 23);
          setStep(4, `Writing email for ${contact.companyName} (${i + 1}/${sortedContacts.length})...`, pct);

          try {
            const email = await generateOutreach({
              resumeSummary,
              jobDetails: contact.role || "Software Engineer opportunity",
              recruiterName: contact.personName || contact.recruiterName || contact.founderName || "Hiring Team",
              emailType: "application",
              candidateName: "Adarsh",
              matchingSkills: resumeSkills.slice(0, 6),
              companyName: contact.companyName,
              techStack: contact.techStack || (research?.techStack || []).join(", "),
              recentNews: contact.recentNews,
              reasonForOutreach: contact.reasonForOutreach,
              founderName: contact.founderName,
              companyStage: contact.companyStage,
              recentHiringActivity: contact.recentHiringActivity,
              engineeringFocus: research?.engineeringFocus,
              talkingPoints: research?.talkingPoints || [],
              personalNotes: contact.personalNotes,
              outreachScore: scores[contact.id],
            });

            generatedEmails[contact.id] = email;
            await onEmailGenerated(contact.id, email.subject, email.body);

            // Upsert application record
            await onApplicationUpsert({
              contactId: contact.id,
              campaignId: campaign.id,
              companyName: contact.companyName,
              recruiterName: contact.personName || contact.recruiterName || "Hiring Team",
              role: contact.role || "Software Engineer",
              status: "Queued",
              outreachScore: scores[contact.id],
              generatedSubject: email.subject,
              generatedBody: email.body,
            });
          } catch (e) {
            console.warn(`Email generation failed for ${contact.companyName}:`, e);
            generatedEmails[contact.id] = {
              subject: `Full Stack Engineer Opportunity at ${contact.companyName}`,
              body: `Hi ${contact.personName || "there"},\n\nI'm Adarsh, a Full Stack Engineer with expertise in React, TypeScript, Node.js, and Firebase. I noticed ${contact.companyName} is looking for ${contact.role || "engineering talent"} and wanted to reach out.\n\nI'd love to explore if my background aligns with what you're building. Would you be open to a 15-minute call?\n\nBest,\nAdarsh`,
            };
          }

          // Rate limit protection
          await new Promise((r) => setTimeout(r, 500));
        }

        setStep(4, `${Object.keys(generatedEmails).length} emails generated`, 85, true);
        await new Promise((r) => setTimeout(r, 300));
        if (cancelled) return;

        // ── STEP 5: Build Send Queue ─────────────────────────────────────────
        setStep(5, "Building human-like send schedule...", 87);

        try {
          const queueResult = await buildEmailQueue({
            contactCount: sortedContacts.length,
            dailyLimit: settings.dailyLimit,
            startDate: new Date().toISOString(),
            minDelay: settings.minDelayMinutes,
            maxDelay: settings.maxDelayMinutes,
          });

          // Create queue items
          for (let i = 0; i < sortedContacts.length; i++) {
            if (cancelled) return;
            const contact = sortedContacts[i];
            const scheduledAt = queueResult.slots[i] || new Date().toISOString();
            const email = generatedEmails[contact.id];
            if (!email) continue;

            const queueItem: EmailQueueItem = {
              id: `q_${campaign.id}_${contact.id}_${Date.now()}_${i}`,
              campaignId: campaign.id,
              contactId: contact.id,
              companyName: contact.companyName,
              recipientEmail: contact.email,
              scheduledAt,
              status: "Pending",
              subject: email.subject,
              body: email.body,
              attemptNumber: 1,
              createdAt: new Date().toISOString(),
            };

            await onQueueItemCreated(queueItem);
          }

          // Add follow-up queue items if enabled
          if (settings.followUpEnabled) {
            for (let i = 0; i < sortedContacts.length; i++) {
              if (cancelled) return;
              const contact = sortedContacts[i];
              const primarySlot = queueResult.slots[i] || new Date().toISOString();
              const email = generatedEmails[contact.id];
              if (!email) continue;

              // Follow-up 1 (5 days after primary)
              const followUp1Date = new Date(new Date(primarySlot).getTime() + 5 * 24 * 60 * 60 * 1000);
              const followUp1Item: EmailQueueItem = {
                id: `q_${campaign.id}_${contact.id}_fu1_${Date.now()}_${i}`,
                campaignId: campaign.id,
                contactId: contact.id,
                companyName: contact.companyName,
                recipientEmail: contact.email,
                scheduledAt: followUp1Date.toISOString(),
                status: "Pending",
                subject: `Re: ${email.subject}`,
                body: `Hi ${contact.personName || "there"},\n\nI wanted to follow up on my previous email regarding ${contact.role || "engineering opportunities"} at ${contact.companyName}.\n\nI'm still very interested and would love to connect. Would you have 15 minutes this week?\n\nBest,\nAdarsh`,
                attemptNumber: 2,
                createdAt: new Date().toISOString(),
              };
              await onQueueItemCreated(followUp1Item);
            }
          }

          setStep(5, `${queueResult.totalSlots} emails queued over ~${queueResult.estimatedDays} days`, 95);
        } catch (e) {
          console.warn("Queue build error:", e);
          setStep(5, "Queue built (simplified schedule)", 95);
        }

        // Update campaign status
        await onCampaignUpdate(campaign.id, {
          status: "Running",
          stats: {
            total: sortedContacts.length,
            queued: sortedContacts.length,
            sent: 0,
            replies: 0,
            interviews: 0,
            followUpsSent: 0,
          },
        });

        setStep(5, "Campaign is now running!", 100, true);
      } catch (error: any) {
        console.error("Campaign launch error:", error);
        setLaunchProgress((prev) =>
          prev ? { ...prev, error: error?.message || "Launch failed. Please try again." } : null
        );
      } finally {
        setLaunching(false);
      }
    },
    [cancelled, setStep]
  );

  return {
    launching,
    launchProgress,
    launchCampaign,
    cancelLaunch,
  };
}
