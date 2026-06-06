/**
 * Express server entry point — V3.
 * Lean orchestrator — all business logic lives in routes/ and services/.
 */
import express from "express";
import path from "path";
import { config } from "./config.js";

// Route modules
import healthRoutes from "./routes/health.js";
import resumeRoutes from "./routes/resume.js";
import jobRoutes from "./routes/job.js";
import outreachRoutes from "./routes/outreach.js";
import gmailRoutes from "./routes/gmail.js";
import scraperRoutes from "./routes/scraper.js";
import campaignRoutes from "./routes/campaign.js";
import reportsRoutes from "./routes/reports.js";
import schedulerRoutes from "./routes/scheduler.js";
import authRoutes from "./routes/auth.js";
import { startScheduler } from "./services/campaignScheduler.js";

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: config.maxUploadSize }));

  // Set COOP and COEP headers for Firebase Auth
  app.use((_req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    next();
  });

  // Register API routes
  app.use(healthRoutes);
  app.use(resumeRoutes);
  app.use(jobRoutes);
  app.use(outreachRoutes);
  app.use(gmailRoutes);
  app.use(scraperRoutes);
  app.use(campaignRoutes);
  app.use(reportsRoutes);
  app.use(schedulerRoutes);
  app.use(authRoutes);

  // Vite integration (dev) or static serving (prod)
  if (!config.isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start listening
  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`🚀 Outreach Agent V3 running at http://localhost:${config.port}`);
    // Start autonomous background campaign scheduler
    startScheduler();
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ Port ${config.port} is already in use.`);
      console.error(`   Fix: Set a different port via PORT env var, or kill the process using port ${config.port}.\n`);
    } else {
      console.error("Server error:", err);
    }
    process.exit(1);
  });
}

startServer().catch((error) => {
  console.error("Express server failed to load:", error);
  process.exit(1);
});
