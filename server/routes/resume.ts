/**
 * Resume parsing and analysis routes.
 */
import { Router } from "express";
import { Type } from "@google/genai";
import { getAI } from "../services/gemini.js";
import { parseDocument } from "../services/document-parser.js";
import { config } from "../config.js";

const router = Router();

/**
 * POST /api/resume/parse-document
 * Multi-format file parser (PDF, DOCX/DOC, TXT).
 */
router.post("/api/resume/parse-document", async (req, res) => {
  try {
    const { base64, fileName, mimeType } = req.body;
    if (!base64 || typeof base64 !== "string") {
      res.status(400).json({ error: "Missing or invalid base64 file data." });
      return;
    }

    const buffer = Buffer.from(base64, "base64");

    try {
      const text = await parseDocument(buffer, fileName || "", mimeType || "");
      res.json({ text: text.trim() });
    } catch (parseError: any) {
      console.error("Document parse error:", parseError);
      res.status(422).json({
        error: parseError?.message || "Failed to extract text from document.",
      });
    }
  } catch (error: any) {
    console.error("Document upload error:", error);
    res.status(500).json({ error: error?.message || "Failed to process document upload." });
  }
});

/**
 * POST /api/resume/analyze
 * Structured resume extraction via Gemini AI — V3.
 * Extracts: summary, skills, projects, experience, achievements, cloudExperience, aiExperience
 */
router.post("/api/resume/analyze", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Invalid resume text payload." });
      return;
    }

    const ai = getAI();
    const systemPrompt = `You are an elite recruitment executive and resume parsing engine.
Analyze the provided resume content and extract a complete structured profile for a Full Stack Engineer (React, TypeScript, Node.js, Firebase, Gemini AI).
Map the text into the specified JSON format, standardizing dates, experience roles, and extracting all relevant technical skills, projects, achievements, and domain expertise.`;

    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: [
        { text: systemPrompt },
        { text: `Resume Content:\n${text}` },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description:
                "A professional summary highlighting primary skills, years of experience, and background (max 3 sentences).",
            },
            skills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Comprehensive list of technical skills, languages, frameworks, tools extracted from the resume.",
            },
            projects: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Key projects with brief descriptions (e.g. 'Built a RAG-based document assistant using Firebase + Gemini').",
            },
            experience: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Work experience entries (e.g. 'Software Engineer at Acme Corp, 2022-2024: Led full stack React/Node.js development').",
            },
            achievements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Notable achievements, metrics, or recognitions (e.g. 'Reduced API latency by 40% through query optimization').",
            },
            cloudExperience: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Cloud/infrastructure skills and experience (e.g. 'Firebase Hosting', 'Google Cloud Run', 'Firestore database design').",
            },
            aiExperience: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "AI/ML specific experience (e.g. 'Built RAG pipeline with Gemini 1.5', 'Implemented semantic search with embeddings').",
            },
          },
          required: ["summary", "skills", "projects", "experience", "achievements", "cloudExperience", "aiExperience"],
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
    console.error("Resume analysis error:", error);
    res.status(500).json({ error: error?.message || "Failed to analyze resume. Please check your Gemini API key and try again." });
  }
});

export default router;

