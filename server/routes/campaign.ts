/**
 * Campaign management routes.
 * Handles campaign creation, launch orchestration, and status polling.
 */
import { Router } from "express";
import { Type } from "@google/genai";
import { getAI } from "../services/gemini.js";
import { getAdminDb, getAdminFieldValue } from "../services/firebaseAdmin.js";
import { config } from "../config.js";
import { getISTDateString, getISTDate, setISTTime, addDays, nowMs } from "../utils/date.js";

const router = Router();

/**
 * POST /api/campaign/create
 * Create a new campaign record (stored client-side in Firestore, this endpoint validates + enriches).
 */
router.post("/api/campaign/create", async (req, res) => {
  try {
    const { name, resumeId, contactIds, dailyLimit, followUpEnabled } = req.body;

    if (!name || !resumeId || !contactIds || !Array.isArray(contactIds)) {
      res.status(400).json({ error: "Missing required campaign fields: name, resumeId, contactIds." });
      return;
    }

    const campaignId = "camp_" + Math.random().toString(36).substring(2, 10);

    res.json({
      success: true,
      campaignId,
      name,
      resumeId,
      contactIds,
      dailyLimit: dailyLimit || 10,
      followUpEnabled: followUpEnabled !== false,
      status: "Draft",
      stats: {
        total: contactIds.length,
        queued: 0,
        sent: 0,
        replies: 0,
        interviews: 0,
        followUpsSent: 0,
      },
    });
  } catch (error: any) {
    console.error("Campaign create error:", error);
    res.status(500).json({ error: error?.message || "Failed to create campaign." });
  }
});

/**
 * POST /api/campaign/score-contact
 * Calculate Outreach Opportunity Score (0–100) for a contact vs resume.
 * Rule-based — no AI needed.
 */
router.post("/api/campaign/score-contact", async (req, res) => {
  try {
    const { contact, resumeSkills = [] } = req.body;

    if (!contact) {
      res.status(400).json({ error: "Missing contact payload." });
      return;
    }

    let score = 0;
    const reasons: string[] = [];

    // Technology Match (0–35 pts)
    const contactTechStack = (contact.techStack || "").toLowerCase();
    const fullStackSkills = ["react", "typescript", "javascript", "node.js", "node", "express", "rest api", "nextjs", "next.js"];
    const cloudSkills = ["firebase", "google cloud", "gcp", "firestore", "cloud run"];
    const aiSkills = ["gemini", "openai", "rag", "llm", "ai", "machine learning"];

    let techMatchCount = 0;
    const allTargetSkills = [...fullStackSkills, ...cloudSkills, ...aiSkills];
    for (const skill of allTargetSkills) {
      if (contactTechStack.includes(skill)) techMatchCount++;
    }
    // Also check resume skills
    for (const resumeSkill of resumeSkills) {
      if (contactTechStack.includes(resumeSkill.toLowerCase())) techMatchCount++;
    }
    const techScore = Math.min(35, techMatchCount * 5);
    score += techScore;
    if (techScore > 0) reasons.push(`Tech stack alignment (+${techScore})`);

    // Role Match (0–25 pts)
    const role = (contact.role || "").toLowerCase();
    const fullStackRoles = ["full stack", "fullstack", "software engineer", "backend", "frontend", "web developer", "node", "react"];
    let roleMatch = false;
    for (const r of fullStackRoles) {
      if (role.includes(r)) { roleMatch = true; break; }
    }
    if (roleMatch) {
      score += 25;
      reasons.push("Role alignment (+25)");
    }

    // Priority (0–15 pts)
    const priority = (contact.priority || "Medium").toLowerCase();
    if (priority === "high") { score += 15; reasons.push("High priority (+15)"); }
    else if (priority === "medium") { score += 8; reasons.push("Medium priority (+8)"); }
    else { score += 3; reasons.push("Low priority (+3)"); }

    // Hiring Signals (0–15 pts)
    const hiringActivity = (contact.recentHiringActivity || contact.reasonForOutreach || "").toLowerCase();
    if (hiringActivity.includes("hiring") || hiringActivity.includes("expanding") || hiringActivity.includes("engineer")) {
      score += 15;
      reasons.push("Active hiring signals (+15)");
    } else if (hiringActivity.length > 0) {
      score += 5;
      reasons.push("Hiring context provided (+5)");
    }

    // Company Growth / Stage (0–10 pts)
    const stage = (contact.companyStage || contact.fundingStatus || "").toLowerCase();
    if (stage.includes("series") || stage.includes("startup") || stage.includes("growth") || stage.includes("seed")) {
      score += 10;
      reasons.push("Growth stage company (+10)");
    } else if (stage.length > 0) {
      score += 5;
    }

    // Response Potential — has person name / linkedin (0–15 pts)
    if (contact.personName || contact.linkedin) {
      score += 10;
      reasons.push("Personalization data available (+10)");
    }
    if (contact.email && contact.email.includes("@")) {
      score += 5;
    }

    const finalScore = Math.min(100, Math.round(score));

    res.json({
      success: true,
      score: finalScore,
      reasons,
      breakdown: {
        techMatch: techScore,
        roleMatch: roleMatch ? 25 : 0,
        priority: priority === "high" ? 15 : priority === "medium" ? 8 : 3,
        hiringSignals: hiringActivity.length > 5 ? 10 : 0,
        companyGrowth: stage.length > 0 ? 5 : 0,
      },
    });
  } catch (error: any) {
    console.error("Score contact error:", error);
    res.status(500).json({ error: error?.message || "Failed to score contact." });
  }
});

/**
 * POST /api/campaign/enrich-contact
 * Use Gemini to generate company research summary from available context.
 */
router.post("/api/campaign/enrich-contact", async (req, res) => {
  try {
    const { contact } = req.body;

    if (!contact || !contact.companyName) {
      res.status(400).json({ error: "Missing contact or company name." });
      return;
    }

    const ai = getAI();

    const contextParts = [
      contact.companyName && `Company: ${contact.companyName}`,
      contact.website && `Website: ${contact.website}`,
      contact.industry && `Industry: ${contact.industry}`,
      contact.techStack && `Tech Stack: ${contact.techStack}`,
      contact.recentNews && `Recent News: ${contact.recentNews}`,
      contact.recentHiringActivity && `Hiring Activity: ${contact.recentHiringActivity}`,
      contact.companyStage && `Stage: ${contact.companyStage}`,
      contact.fundingStatus && `Funding: ${contact.fundingStatus}`,
      contact.founderName && `Founder: ${contact.founderName}`,
      contact.reasonForOutreach && `Reason for Outreach: ${contact.reasonForOutreach}`,
      contact.role && `Target Role: ${contact.role}`,
      contact.location && `Location: ${contact.location}`,
    ].filter(Boolean).join("\n");

    const prompt = `You are a recruitment intelligence analyst. Based on the following company context, generate a concise research summary optimized for personalized outreach from a Full Stack engineer (React, TypeScript, Node.js, Firebase, Google Cloud, Gemini AI).

Company Context:
${contextParts}

Generate a research summary that highlights:
1. What makes this company interesting to a Full Stack engineer
2. How the engineer's skills align with this company's tech needs
3. Key talking points for the outreach email
4. Any unique personalization hooks

Keep it practical and actionable, under 200 words.`;

    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Research summary for outreach personalization",
            },
            techStack: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Identified or inferred tech stack",
            },
            hiringSignals: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Hiring signals or growth indicators",
            },
            talkingPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Key personalization hooks for the email",
            },
            engineeringFocus: {
              type: Type.STRING,
              description: "What this company builds from an engineering perspective",
            },
          },
          required: ["summary", "techStack", "hiringSignals", "talkingPoints", "engineeringFocus"],
        },
      },
    });

    const output = response.text;
    if (!output) {
      res.status(502).json({ error: "Gemini returned empty response." });
      return;
    }

    res.json({
      success: true,
      research: JSON.parse(output.trim()),
      enrichedAt: getISTDateString(),
    });
  } catch (error: any) {
    console.error("Enrich contact error:", error);
    // Return a fallback if Gemini fails
    res.json({
      success: true,
      research: {
        summary: `${req.body?.contact?.companyName || "Company"} is a target for Full Stack outreach.`,
        techStack: req.body?.contact?.techStack ? req.body.contact.techStack.split(",").map((s: string) => s.trim()) : [],
        hiringSignals: req.body?.contact?.recentHiringActivity ? [req.body.contact.recentHiringActivity] : [],
        talkingPoints: [],
        engineeringFocus: req.body?.contact?.role || "",
      },
      enrichedAt: getISTDateString(),
      _fallbackActive: true,
    });
  }
});

/**
 * POST /api/campaign/build-queue
 * Build a human-like email send schedule for a campaign.
 * Returns array of scheduled send times (ISO strings).
 */
router.post("/api/campaign/build-queue", async (req, res) => {
  try {
    const {
      contactCount,
      dailyLimit = 10,
      startDate,
      minDelay = 120,
      maxDelay = 240,
      sendingDays = "weekdays",
      sendingWindowStart = "09:00",
      sendingWindowEnd = "18:00",
    } = req.body;

    if (!contactCount || contactCount < 1) {
      res.status(400).json({ error: "contactCount must be >= 1." });
      return;
    }

    const slots: string[] = [];
    const startTs = startDate ? new Date(startDate) : new Date(nowMs());

    // Parse window start and end times (e.g. "09:00", "18:00")
    const [startH, startM] = sendingWindowStart.split(":").map(Number);
    const [endH, endM] = sendingWindowEnd.split(":").map(Number);
    const windowStartMins = (startH || 9) * 60 + (startM || 0);
    const windowEndMins = (endH || 18) * 60 + (endM || 0);

    // Move to next valid sending day if needed
    function nextValidDay(d: Date): Date {
      while (true) {
        const istDate = getISTDate(d);
        const day = istDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = day === 0 || day === 6;

        if (sendingDays === "weekdays" && isWeekend) {
          d = addDays(d, 1);
        } else if (sendingDays === "weekends" && !isWeekend) {
          d = addDays(d, 1);
        } else {
          break; // It's a valid day
        }
      }
      return d;
    }

    function randomDelay(min: number, max: number): number {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    let current = new Date(startTs);
    const currentNowMs = nowMs();

    if (current.getTime() < currentNowMs) {
      current = new Date(currentNowMs);
    }

    const originalDateString = getISTDateString(current).split('T')[0];
    current = nextValidDay(current);
    const newDateString = getISTDateString(current).split('T')[0];

    let currentIST = getISTDate(current);
    let currentMins = currentIST.getUTCHours() * 60 + currentIST.getUTCMinutes();

    if (originalDateString !== newDateString) {
        setISTTime(current, startH, startM + Math.floor(Math.random() * 30));
    } else if (currentMins > windowEndMins) {
        current = addDays(current, 1);
        current = nextValidDay(current);
        setISTTime(current, startH, startM + Math.floor(Math.random() * 30));
    } else if (currentMins < windowStartMins) {
        setISTTime(current, startH, startM + Math.floor(Math.random() * 30));
    } else {
        current = new Date(current.getTime() + Math.floor(Math.random() * 5 + 1) * 60000);
    }

    let todayCount = 0;

    for (let i = 0; i < Math.min(contactCount, 500); i++) {
      // Check if within sending window
      const currentIST = getISTDate(current);
      let hour = currentIST.getUTCHours();
      let minute = currentIST.getUTCMinutes();
      let totalMinutes = hour * 60 + minute;

      // If past the window end, OR the current generated time is in the past, move to next valid day
      if (totalMinutes > windowEndMins || current.getTime() < currentNowMs) {
        // Move to next valid day
        current = addDays(current, 1);
        current = nextValidDay(current);
        setISTTime(current, startH, startM + Math.floor(Math.random() * 30));
        todayCount = 0;
      }

      if (todayCount >= dailyLimit) {
        // Hit daily limit — move to next valid day
        current = addDays(current, 1);
        current = nextValidDay(current);
        setISTTime(current, startH, startM + Math.floor(Math.random() * 30));
        todayCount = 0;
      }

      slots.push(getISTDateString(current));
      todayCount++;

      // Add random delay for next email
      const delayMinutes = randomDelay(minDelay, maxDelay);
      current = new Date(current.getTime() + delayMinutes * 60 * 1000);
    }

    res.json({
      success: true,
      slots,
      totalSlots: slots.length,
      estimatedDays: Math.ceil(contactCount / dailyLimit),
    });
  } catch (error: any) {
    console.error("Build queue error:", error);
    res.status(500).json({ error: error?.message || "Failed to build email queue." });
  }
});

/**
 * POST /api/campaign/launch
 * Orchestrates the campaign launch in the background.
 */
router.post("/api/campaign/launch", async (req, res) => {
  try {
    const { userId, campaign, resume, contacts, settings } = req.body;

    if (!userId || !campaign || !resume || !contacts || !settings) {
      res.status(400).json({ error: "Missing required fields." });
      return;
    }

    // Immediately respond to the client
    res.status(202).json({ success: true, message: "Campaign launch started in background." });

    // Start background process
    launchBackgroundWorker(userId, campaign, resume, contacts, settings).catch((err) => {
      console.error(`[Background Launch Error] Campaign ${campaign.id}:`, err);
    });
  } catch (error: any) {
    console.error("Launch campaign error:", error);
    res.status(500).json({ error: error?.message || "Failed to start campaign launch." });
  }
});

async function launchBackgroundWorker(userId: string, campaign: any, resume: any, contacts: any[], settings: any) {
  const db = await getAdminDb();
  const campaignRef = db.doc(`users/${userId}/campaigns/${campaign.id}`);
  const port = process.env.PORT || 3000;
  const baseUrl = `http://127.0.0.1:${port}`;

  const setProgress = async (step: number, label: string, progress: number, complete = false, error?: string) => {
    await campaignRef.set(
      {
        launchProgress: { step, label, progress, complete, error: error || null },
        status: complete && !error ? "Running" : error ? "Paused" : "Draft",
      },
      { merge: true }
    );
  };

  try {
    await setProgress(1, "Analyzing resume and extracting skills...", 10);

    // 1. Parse Resume
    const resumeRes = await fetch(`${baseUrl}/api/resume/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: resume.textContent }),
    });
    if (!resumeRes.ok) {
      const errText = await resumeRes.text();
      console.error(`[LaunchWorker] /api/resume/analyze failed: ${resumeRes.status} ${errText}`);
      throw new Error(`Failed to analyze resume: ${resumeRes.status} - ${errText}`);
    }
    const resumeData = await resumeRes.json();
    const resumeSummary = resumeData.summary;
    const resumeSkills = resumeData.skills || [];

    await setProgress(2, `Enriching ${contacts.length} companies with AI...`, 20);

    // 2. Enrich Contacts
    const enrichedResearch: Record<string, any> = {};
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const pct = 20 + Math.round((i / contacts.length) * 25);
      await setProgress(2, `Researching ${contact.companyName}...`, pct);

      const enrichRes = await fetch(`${baseUrl}/api/campaign/enrich-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact }),
      });
      if (enrichRes.ok) {
        const data = await enrichRes.json();
        if (data.success && data.research) {
          enrichedResearch[contact.id] = data.research;
          // Save to contact
          await db.doc(`users/${userId}/contacts/${contact.id}`).set(
            { outreachResearch: data.research, updatedAt: getISTDateString() },
            { merge: true }
          );
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    await setProgress(3, "Scoring contacts by outreach opportunity...", 48);

    // 3. Score Contacts
    const scores: Record<string, number> = {};
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const pct = 48 + Math.round((i / contacts.length) * 12);
      await setProgress(3, `Scoring ${contact.companyName}...`, pct);

      const scoreRes = await fetch(`${baseUrl}/api/campaign/score-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, resumeSkills }),
      });
      if (scoreRes.ok) {
        const data = await scoreRes.json();
        if (data.success) {
          scores[contact.id] = data.score;
          await db.doc(`users/${userId}/contacts/${contact.id}`).set(
            { outreachScore: data.score, outreachScoreBreakdown: data.breakdown, updatedAt: getISTDateString() },
            { merge: true }
          );
        }
      } else {
        scores[contact.id] = 50;
      }
    }

    const sortedContacts = [...contacts].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

    await setProgress(4, `Generating emails for ${sortedContacts.length} contacts...`, 62);

    // 4. Generate Emails and Applications
    const generatedEmails: Record<string, { subject: string; body: string }> = {};
    for (let i = 0; i < sortedContacts.length; i++) {
      const contact = sortedContacts[i];
      const research = enrichedResearch[contact.id];
      const pct = 62 + Math.round((i / sortedContacts.length) * 23);
      await setProgress(4, `Writing email for ${contact.companyName}...`, pct);

      let email = { subject: "", body: "" };
      const emailRes = await fetch(`${baseUrl}/api/outreach/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      if (emailRes.ok) {
        email = await emailRes.json();
      } else {
        email = {
          subject: `Full Stack Engineer Opportunity at ${contact.companyName}`,
          body: `Hi ${contact.personName || "there"},\n\nI'm Adarsh, a Full Stack Engineer with expertise in React, TypeScript, Node.js, and Firebase. I noticed ${contact.companyName} is looking for ${contact.role || "engineering talent"} and wanted to reach out.\n\nI'd love to explore if my background aligns with what you're building. Would you be open to a 15-minute call?\n\nBest,\nAdarsh`,
        };
      }

      if (resume.driveLink) {
        email.body += `\n\n---\n📎 Attached Secure CV Copy (Google Drive):\n${resume.driveLink}`;
      }

      generatedEmails[contact.id] = email;

      await db.doc(`users/${userId}/applications/${contact.id}`).set(
        {
          contactId: contact.id,
          campaignId: campaign.id,
          companyName: contact.companyName,
          recruiterName: contact.personName || contact.recruiterName || "Hiring Team",
          role: contact.role || "Software Engineer",
          status: "Queued",
          outreachScore: scores[contact.id],
          generatedSubject: email.subject,
          generatedBody: email.body,
          updatedAt: getISTDateString(),
          // Use arrayUnion to safely initialize or add to timeline
          timeline: getAdminFieldValue().arrayUnion({
            status: "Queued",
            note: "Email generated and added to dispatch queue",
            timestamp: getISTDateString(),
          }),
        },
        { merge: true }
      );
      await new Promise((r) => setTimeout(r, 500));
    }

    await setProgress(5, "Building autonomous dispatch schedule...", 85);

    // 5. Build Queue
    const queueRes = await fetch(`${baseUrl}/api/campaign/build-queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactCount: sortedContacts.length,
        dailyLimit: campaign.dailyLimit || settings.dailyLimit,
        minDelay: campaign.schedulerSettings?.minDelayMinutes || 120,
        maxDelay: campaign.schedulerSettings?.maxDelayMinutes || 240,
        sendingDays: campaign.schedulerSettings?.sendingDays || "weekdays",
        sendingWindowStart: campaign.schedulerSettings?.sendingWindowStart || "09:00",
        sendingWindowEnd: campaign.schedulerSettings?.sendingWindowEnd || "18:00",
      }),
    });
    if (!queueRes.ok) throw new Error("Failed to build queue");
    const queueData = await queueRes.json();
    const slots = queueData.slots;

    const batch = db.batch();
    for (let i = 0; i < sortedContacts.length; i++) {
      const contact = sortedContacts[i];
      const email = generatedEmails[contact.id];
      const qRef = db.collection(`users/${userId}/emailQueue`).doc();
      batch.set(qRef, {
        campaignId: campaign.id,
        contactId: contact.id,
        companyName: contact.companyName,
        recipientEmail: contact.email,
        scheduledAt: slots[i] || slots[slots.length - 1],
        status: "Pending",
        subject: email.subject,
        body: email.body,
        attemptNumber: 1,
        createdAt: getISTDateString(new Date(nowMs() + i * 1000)),
      });
    }

    await batch.commit();

    await setProgress(5, "Campaign launched successfully!", 100, true);
  } catch (err: any) {
    await setProgress(
      5,
      "Failed to launch campaign",
      0,
      true,
      err.message || "An unexpected error occurred"
    );
  }
}

export default router;
