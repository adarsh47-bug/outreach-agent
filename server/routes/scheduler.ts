/**
 * Scheduler status and control API routes.
 *
 * GET  /api/scheduler/status  — health check, last tick, emails sent, next due
 * POST /api/scheduler/pause   — stop the scheduler (admin/debug only)
 * POST /api/scheduler/resume  — restart the scheduler
 */
import { Router } from "express";
import {
  getSchedulerState,
  startScheduler,
  stopScheduler,
} from "../services/campaignScheduler.js";
import { getISTDateString } from "../utils/date.js";

const router = Router();

/** GET /api/scheduler/status */
router.get("/api/scheduler/status", (_req, res) => {
  const state = getSchedulerState();
  res.json({
    ok: true,
    scheduler: {
      running: state.running,
      lastTickAt: state.lastTickAt,
      lastTickResult: state.lastTickResult,
      emailsSentThisTick: state.emailsSentThisTick,
      totalEmailsSentToday: state.totalEmailsSentToday,
      nextEmailDueAt: state.nextEmailDueAt,
      recentErrors: state.errors.slice(0, 5),
    },
    serverTime: getISTDateString(),
  });
});

/** POST /api/scheduler/pause — stop background dispatch */
router.post("/api/scheduler/pause", (_req, res) => {
  stopScheduler();
  res.json({ ok: true, message: "Scheduler paused." });
});

/** POST /api/scheduler/resume — restart background dispatch */
router.post("/api/scheduler/resume", (_req, res) => {
  startScheduler();
  res.json({ ok: true, message: "Scheduler resumed." });
});

export default router;
