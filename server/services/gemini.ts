/**
 * Gemini AI client service — lazy-initialized singleton.
 */
import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

let aiInstance: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI {
  if (!aiInstance) {
    if (!config.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: config.geminiApiKey,
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });
  }
  return aiInstance;
}
