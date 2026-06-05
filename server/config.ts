/**
 * Server configuration — single source of truth for all server settings.
 */
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: "gemini-3.5-flash",
  isProd: process.env.NODE_ENV === "production",
  maxUploadSize: "5mb",
  maxScrapedTextLength: 14000,
} as const;
