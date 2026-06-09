/**
 * Outreach email generation route — V3 Enhanced.
 * Uses resume, company research, tech stack, and personalization fields.
 */
import { Router } from "express";
import { Type } from "@google/genai";
import { getAI } from "../services/gemini.js";
import { config } from "../config.js";

const router = Router();

/**
 * POST /api/outreach/generate
 * Generate highly personalized outreach email drafts using full company context.
 */
router.post("/api/outreach/generate", async (req, res) => {
  try {
    const {
      resumeSummary,
      jobDetails,
      recruiterName,
      emailType,
      candidateName = "Adarsh",
      matchingSkills = [],
      // V3 enrichment fields
      companyName,
      techStack,
      recentNews,
      reasonForOutreach,
      founderName,
      companyStage,
      recentHiringActivity,
      engineeringFocus,
      talkingPoints = [],
      personalNotes,
      outreachScore,
    } = req.body;

    if (!resumeSummary || !jobDetails) {
      res.status(400).json({ error: "Missing resume details or job description." });
      return;
    }

    const cleanRecruiterName = recruiterName || (founderName ? founderName : "Hiring Team");
    const typeLabel = emailType || "application";

    // Build rich context block
    const contextParts = [
      companyName && `Company: ${companyName}`,
      techStack && `Their Tech Stack: ${techStack}`,
      recentHiringActivity && `Hiring Activity: ${recentHiringActivity}`,
      reasonForOutreach && `Why reaching out: ${reasonForOutreach}`,
      recentNews && `Recent News: ${recentNews}`,
      companyStage && `Company Stage: ${companyStage}`,
      engineeringFocus && `Engineering Focus: ${engineeringFocus}`,
      talkingPoints.length > 0 && `Talking Points: ${talkingPoints.join("; ")}`,
      personalNotes && `Personal Notes: ${personalNotes}`,
    ].filter(Boolean).join("\n");

    const ai = getAI();

    const systemPrompt = `You are an elite professional outreach copywriter specializing in helping software engineers land interviews at top companies.

Write a bespoke, highly personalized outreach email from ${candidateName} (a Full Stack Engineer with expertise in React, TypeScript, Node.js, Firebase, and Gemini AI) to ${cleanRecruiterName} at ${companyName || "the company"}.

CANDIDATE BACKGROUND:
${resumeSummary}

TARGET OPPORTUNITY:
${jobDetails}

COMPANY RESEARCH & CONTEXT:
${contextParts || "No additional context available."}

MATCHING SKILLS (weave 1–2 naturally):
${matchingSkills.length > 0 ? matchingSkills.slice(0, 4).join(", ") : "React, TypeScript, Node.js, Firebase"}

EMAIL REQUIREMENTS (strict):
- Must mention the company name (${companyName || "company"}) naturally
- Must reference a specific project or achievement from the candidate's background
- Must mention 1–2 matching technologies from their stack
- Must explicitly focus on exploring job opportunities, open roles, and how the candidate can contribute to their engineering team
- Must explicitly state that the candidate's resume is attached for reference (do not use the word "linked" or "link")
- Must reference the role or the reason for outreach
- Must end with a clear, low-pressure CTA (e.g., "Would you be open to a 15-minute call?")
- Length: under 130 words total
- Tone: genuine, warm, highly personalized, conversational and human — do NOT sound robotic, cold, or generic. No buzzwords, no "I hope this email finds you well"
- Format: Must use clear paragraph breaks (\n\n) to ensure readability. Do not output a single giant block of text.
- No generic placeholders like [Company Name] or [Your Name]
- NO bullet points — flowing paragraphs only

EMAIL TYPE CONTEXT:
- "application": Express interest in the specific role and request next steps
- "recruiter_outreach": Networking pitch, ask for a brief call
- "follow_up": Short, warm follow-up referencing the previous email

Selected type: ${typeLabel}

Generate the email now.`;

    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: {
              type: Type.STRING,
              description: "Compelling, specific email subject line (no generic phrases)",
            },
            body: {
              type: Type.STRING,
              description: "Complete email body, signed with candidate name. Under 130 words. No bullet points.",
            },
          },
          required: ["subject", "body"],
        },
      },
    });

    const output = response.text;
    if (!output) {
      res.status(502).json({ error: "Gemini API returned an empty response. Please try again." });
      return;
    }

    res.json(JSON.parse(output.trim()));
  } catch (error: any) {
    console.error("Outreach generation error:", error);
    res.status(500).json({ error: error?.message || "Failed to generate outreach email. Please check your Gemini API key and try again." });
  }
});

export default router;
