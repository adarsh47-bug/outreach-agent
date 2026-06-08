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
import { auth } from "../lib/firebase";
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
        // ── TRIGGER BACKEND LAUNCH ────────────────────────────────────────────────
        setStep(1, "Starting background launch...", 10);
        
        const res = await fetch("/api/campaign/launch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: auth.currentUser?.uid,
            campaign,
            resume,
            contacts,
            settings,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to start campaign launch on server");
        }

        // We return here because the backend handles the rest, 
        // and the UI will sync via Firestore.
        return;
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
