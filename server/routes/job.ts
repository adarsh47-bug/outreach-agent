/**
 * Job matching route — ATS alignment scoring.
 */
import { Router } from "express";
import { Type } from "@google/genai";
import { getAI } from "../services/gemini.js";
import { config } from "../config.js";

const router = Router();

/**
 * POST /api/job/match
 * Compute alignment score between resume and job description.
 */
router.post("/api/job/match", async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;
    if (!resumeText || !jobDescription) {
      res.status(400).json({
        error: "Must specify both resumeText and jobDescription parameters.",
      });
      return;
    }

    const ai = getAI();
    const systemPrompt = `You are a professional ATS (Applicant Tracking System) compiler and recruiter advisor.
Compute a normalized match score between 0 and 100 based on alignment between the Candidate's Resume details and the requested Job Description.
Identify matching skills (which exist on both descriptions), missing critical skills (listed in job specifications but not highlighted on the resume), and constructive recommendations to adapt or optimize the resume profile for better ATS passing score.`;

    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: [
        { text: systemPrompt },
        { text: `Resume Detail:\n${resumeText}\n\nJob Description:\n${jobDescription}` },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: {
              type: Type.INTEGER,
              description: "The percentage score rating (0-100) indicating alignment.",
            },
            matchingSkills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of skills matching qualifications requirements.",
            },
            missingSkills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Critical gaps or qualifications present on job descriptions but omitted from the resume.",
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Specific formatting, phrasing, or experience additions advice to improve resume visibility.",
            },
          },
          required: ["score", "matchingSkills", "missingSkills", "recommendations"],
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
    console.error("Job matching error:", error);
    res.status(500).json({ error: error?.message || "Failed to compute job match score. Please check your Gemini API key and try again." });
  }
});

export default router;
