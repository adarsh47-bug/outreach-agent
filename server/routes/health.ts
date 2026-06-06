/**
 * Health check route.
 */
import { Router } from "express";
import { getISTDateString } from "../utils/date.js";

const router = Router();

router.get("/api/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: getISTDateString() });
});

export default router;
