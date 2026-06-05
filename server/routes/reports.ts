/**
 * Reports route — generate and send daily outreach summary.
 */
import { Router } from "express";
import { Type } from "@google/genai";
import { getAI } from "../services/gemini.js";
import { config } from "../config.js";

const router = Router();

/**
 * POST /api/reports/generate
 * Generate a daily outreach report summary using Gemini.
 */
router.post("/api/reports/generate", async (req, res) => {
  try {
    const {
      date,
      emailsSent = 0,
      replies = 0,
      interviews = 0,
      followUpsSent = 0,
      pendingCompanies = 0,
      topOpportunities = [],
      recentActivity = [],
    } = req.body;

    const ai = getAI();

    const reportDate = date || new Date().toISOString().split("T")[0];

    const prompt = `You are an AI recruitment assistant generating a daily outreach performance summary for Adarsh, a Full Stack Engineer (React, TypeScript, Node.js, Firebase, Gemini AI).

Daily Metrics for ${reportDate}:
- Emails Sent: ${emailsSent}
- Replies Received: ${replies}
- Interviews Secured: ${interviews}
- Follow-Ups Sent: ${followUpsSent}
- Pending Companies: ${pendingCompanies}

Top Opportunities:
${topOpportunities.map((o: any) => `- ${o.companyName} (${o.role}) — Score: ${o.score}, Status: ${o.status}`).join("\n") || "None yet."}

Recent Activity:
${recentActivity.slice(0, 5).map((a: any) => `- ${a.note} at ${a.timestamp}`).join("\n") || "No recent activity."}

Write a concise, motivating daily summary email with:
1. Performance highlights
2. Key wins or progress
3. Tomorrow's focus companies
4. One actionable tip to increase reply rate

Keep it under 200 words, professional but human.`;

    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: {
              type: Type.STRING,
              description: "Email subject for daily report",
            },
            body: {
              type: Type.STRING,
              description: "Full email body for daily report",
            },
            highlights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3-5 key highlights from today",
            },
            tomorrowFocus: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Companies to prioritize tomorrow",
            },
          },
          required: ["subject", "body", "highlights"],
        },
      },
    });

    const output = response.text;
    if (!output) {
      res.status(502).json({ error: "Gemini returned empty response." });
      return;
    }

    const reportData = JSON.parse(output.trim());

    res.json({
      success: true,
      date: reportDate,
      report: reportData,
      metrics: {
        emailsSent,
        replies,
        interviews,
        followUpsSent,
        pendingCompanies,
        replyRate: emailsSent > 0 ? Math.round((replies / emailsSent) * 100) : 0,
        interviewRate: emailsSent > 0 ? Math.round((interviews / emailsSent) * 100) : 0,
      },
    });
  } catch (error: any) {
    console.error("Report generation error:", error);
    // Fallback report
    const d = req.body;
    res.json({
      success: true,
      date: d.date || new Date().toISOString().split("T")[0],
      report: {
        subject: `Outreach Daily Report — ${d.date || new Date().toLocaleDateString()}`,
        body: `Daily Summary:\n\nEmails Sent: ${d.emailsSent || 0}\nReplies: ${d.replies || 0}\nInterviews: ${d.interviews || 0}\nFollow-Ups: ${d.followUpsSent || 0}\n\nKeep going — consistency is key!`,
        highlights: [`${d.emailsSent || 0} emails sent today`, `${d.replies || 0} replies received`],
        tomorrowFocus: [],
      },
      metrics: {
        emailsSent: d.emailsSent || 0,
        replies: d.replies || 0,
        interviews: d.interviews || 0,
        followUpsSent: d.followUpsSent || 0,
        pendingCompanies: d.pendingCompanies || 0,
        replyRate: 0,
        interviewRate: 0,
      },
      _fallbackActive: true,
    });
  }
});

/**
 * POST /api/reports/classify-reply
 * Use Gemini to classify an email reply as positive/negative/interview/etc.
 */
router.post("/api/reports/classify-reply", async (req, res) => {
  try {
    const { emailBody, subject } = req.body;

    if (!emailBody) {
      res.status(400).json({ error: "Missing emailBody." });
      return;
    }

    const ai = getAI();

    const prompt = `You are a recruitment reply classifier. Analyze this email reply and classify it.

Subject: ${subject || "(no subject)"}
Body: ${emailBody}

Classify this reply accurately.`;

    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classification: {
              type: Type.STRING,
              description: "One of: Positive, Interview Request, Technical Assessment, Rejection, Out of Office, Unsubscribe, Unclear",
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence score 0–1",
            },
            suggestedAction: {
              type: Type.STRING,
              description: "Recommended next action",
            },
            summary: {
              type: Type.STRING,
              description: "Brief summary of the reply",
            },
          },
          required: ["classification", "confidence", "suggestedAction", "summary"],
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
      ...JSON.parse(output.trim()),
    });
  } catch (error: any) {
    console.error("Classify reply error:", error);
    res.status(500).json({ error: error?.message || "Failed to classify reply." });
  }
});

export default router;
