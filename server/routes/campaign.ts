/**
 * Campaign management routes.
 * Handles campaign creation, launch orchestration, and status polling.
 */
import { Router } from "express";
import { Type } from "@google/genai";
import { getAI } from "../services/gemini.js";
import { config } from "../config.js";

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
      enrichedAt: new Date().toISOString(),
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
      enrichedAt: new Date().toISOString(),
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
    } = req.body;

    if (!contactCount || contactCount < 1) {
      res.status(400).json({ error: "contactCount must be >= 1." });
      return;
    }

    const slots: string[] = [];
    const startTs = startDate ? new Date(startDate) : new Date();

    // Move to next weekday if needed
    function nextWeekday(d: Date): Date {
      const day = d.getDay();
      if (day === 0) d.setDate(d.getDate() + 1); // Sunday → Monday
      if (day === 6) d.setDate(d.getDate() + 2); // Saturday → Monday
      return d;
    }

    function randomDelay(min: number, max: number): number {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    let current = nextWeekday(new Date(startTs));
    // Start at 09:00 IST (09:00 local, representing sending window start)
    current.setHours(9, Math.floor(Math.random() * 30), 0, 0); // 09:00–09:30 first email

    let todayCount = 0;

    for (let i = 0; i < Math.min(contactCount, 500); i++) {
      // Check if within sending window (09:00–18:00)
      const hour = current.getHours();
      const minute = current.getMinutes();
      const totalMinutes = hour * 60 + minute;

      if (totalMinutes > 18 * 60) {
        // Past 18:00 — move to next weekday 09:00–09:30
        current.setDate(current.getDate() + 1);
        current = nextWeekday(current);
        current.setHours(9, Math.floor(Math.random() * 30), 0, 0);
        todayCount = 0;
      }

      if (todayCount >= dailyLimit) {
        // Hit daily limit — move to next weekday
        current.setDate(current.getDate() + 1);
        current = nextWeekday(current);
        current.setHours(9, Math.floor(Math.random() * 30), 0, 0);
        todayCount = 0;
      }

      slots.push(current.toISOString());
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

export default router;
