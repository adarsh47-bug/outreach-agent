/**
 * CampaignScheduler — autonomous background email dispatch engine.
 *
 * Responsibilities (runs every 60 s on the Express server):
 *   1. Find all Pending queue items whose scheduledAt <= now.
 *   2. Enforce the user's daily email limit.
 *   3. Send each due email via Gmail REST API using the token stored in Firestore.
 *   4. Mark the queue item Sent / Failed and update the application stage.
 *   5. Update campaign stats.
 *   6. Reset emailsSentToday at midnight.
 *   7. Auto-generate a daily report at 18:00.
 *   8. Create follow-up queue items when the primary send reaches day 5 / day 7.
 */

import { getAdminDb } from "./firebaseAdmin.js";
import { getISTDateString, todayISTDateString, getISTDate, nowMs } from "../utils/date.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueueItem {
  id: string;
  campaignId: string;
  contactId: string;
  companyName: string;
  recipientEmail: string;
  scheduledAt: string;
  status: "Pending" | "Sent" | "Failed" | "Cancelled";
  subject: string;
  body: string;
  attemptNumber: number;
  gmailMessageId?: string;
  createdAt: string;
}

interface SchedulerState {
  running: boolean;
  lastTickAt: string | null;
  lastTickResult: string;
  emailsSentThisTick: number;
  totalEmailsSentToday: number;
  nextEmailDueAt: string | null;
  errors: string[];
}

// ── State ─────────────────────────────────────────────────────────────────────

const state: SchedulerState = {
  running: false,
  lastTickAt: null,
  lastTickResult: "Not started",
  emailsSentThisTick: 0,
  totalEmailsSentToday: 0,
  nextEmailDueAt: null,
  errors: [],
};

let intervalHandle: ReturnType<typeof setInterval> | null = null;
const TICK_INTERVAL_MS = 60_000; // 1 minute
const MAX_ERRORS_LOG = 20;

// ── Gmail Send ────────────────────────────────────────────────────────────────

async function sendViaGmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const encodedSubject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const rawParts = [
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      body,
    ];
    const raw = Buffer.from(rawParts.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err };
    }

    const data: any = await response.json();
    return { success: true, messageId: data.id };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(val: any): string {
  if (!val) return getISTDateString();
  if (typeof val === "string") return val;
  if (typeof val?.toDate === "function") return getISTDateString(val.toDate());
  return getISTDateString();
}

function logError(msg: string) {
  console.error(`[Scheduler] ${msg}`);
  state.errors.unshift(`${getISTDateString()} — ${msg}`);
  if (state.errors.length > MAX_ERRORS_LOG) state.errors.pop();
}

function todayDate(): string {
  return todayISTDateString();
}

function isWithinSendingWindow(windowStart: string, windowEnd: string): boolean {
  const now = getISTDate();
  const [sh, sm] = windowStart.split(":").map(Number);
  const [eh, em] = windowEnd.split(":").map(Number);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return nowMin >= startMin && nowMin <= endMin;
}

function isDayAllowed(sendingDays: string): boolean {
  const day = getISTDate().getUTCDay(); // 0=Sun, 6=Sat
  if (sendingDays === "weekdays") return day >= 1 && day <= 5;
  if (sendingDays === "weekends") return day === 0 || day === 6;
  return true; // full_week
}

export async function forceTick() {
  await tick();
}

// ── Main tick ─────────────────────────────────────────────────────────────────

async function tick() {
  const db = await getAdminDb();
  if (!db) {
    // No Admin SDK — log once, continue silently
    state.lastTickResult = "Simulation mode (no Firebase Admin credentials)";
    state.lastTickAt = getISTDateString();
    return;
  }

  state.lastTickAt = getISTDateString();
  state.emailsSentThisTick = 0;
  state.nextEmailDueAt = null;

  try {
    // Fetch all users with active campaigns
    const usersSnap = await db.collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;

      try {
        await processUser(db, userId);
      } catch (err: any) {
        logError(`User ${userId}: ${err?.message}`);
      }
    }

    state.lastTickResult = `OK — ${state.emailsSentThisTick} sent this tick`;
  } catch (err: any) {
    logError(`Tick failed: ${err?.message}`);
    state.lastTickResult = `Error: ${err?.message}`;
  }
}

async function processUser(db: any, userId: string) {
  // ── Find next due email across all pending (do this first for UI accuracy) ──
  const nowIso = getISTDateString();
  const queueSnap = await db
    .collection(`users/${userId}/emailQueue`)
    .where("status", "==", "Pending")
    .get();

  const allPending = queueSnap.docs
    .map((d: any) => d.data())
    .sort((a: any, b: any) => toISO(a.scheduledAt).localeCompare(toISO(b.scheduledAt)));

  if (allPending.length > 0) {
    const userNextDue = toISO(allPending[0].scheduledAt);
    if (!state.nextEmailDueAt || userNextDue < state.nextEmailDueAt) {
      state.nextEmailDueAt = userNextDue;
    }
  }

  // ── Load settings ──────────────────────────────────────────────────────────
  const settingsSnap = await db
    .doc(`users/${userId}/settings/userSettings`)
    .get();

  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const dailyLimit: number = settings?.dailyLimit ?? 10;
  const followUp1Days: number = settings?.defaultFollowUpDays ?? 5;
  const followUp2Days: number = settings?.followUp2Days ?? 7;
  const archiveDays: number = settings?.archiveDays ?? 14;
  // ── Reset daily counter if new day ────────────────────────────────────────
  const today = todayDate();
  let emailsSentToday: number = settings?.emailsSentToday ?? 0;
  if (settings?.lastResetDate !== today) {
    emailsSentToday = 0;
    await db.doc(`users/${userId}/settings/userSettings`).set(
      { emailsSentToday: 0, lastResetDate: today },
      { merge: true }
    );
  }

  // Generate daily report at 23:00 if end of day
  const now = getISTDate();
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (nowMin >= 23 * 60 && nowMin <= 23 * 60 + 5) {
    await autoGenerateDailyReport(db, userId, emailsSentToday, today);
  }

  // ── Enforce daily limit ───────────────────────────────────────────────────
  if (emailsSentToday >= dailyLimit) {
    state.lastTickResult = `User ${userId}: daily limit (${dailyLimit}) reached`;
    return;
  }


  // ── Find items due RIGHT NOW ──────────────────────────────────────────────
  const dueItems: QueueItem[] = [];
  const campaigns: Record<string, any> = {};

  for (const d of queueSnap.docs) {
    const data = d.data();
    const campaignId = data.campaignId;
    
    if (campaignId && !campaigns[campaignId]) {
      const campSnap = await db.doc(`users/${userId}/campaigns/${campaignId}`).get();
      campaigns[campaignId] = campSnap.exists ? campSnap.data() : null;
    }
    const camp = campaigns[campaignId];
    if (!camp || camp.status === "Paused" || camp.status === "Complete") continue;

    const sched = camp.schedulerSettings || {
      sendingDays: "full_week",
      sendingWindowStart: "09:00",
      sendingWindowEnd: "23:00"
    };

    if (!isDayAllowed(sched.sendingDays)) continue;
    if (!isWithinSendingWindow(sched.sendingWindowStart, sched.sendingWindowEnd)) continue;

    const item: QueueItem = {
      id: d.id,
      campaignId: data.campaignId || "",
      contactId: data.contactId || "",
      companyName: data.companyName || "",
      recipientEmail: data.recipientEmail || "",
      scheduledAt: toISO(data.scheduledAt),
      status: data.status || "Pending",
      subject: data.subject || "",
      body: data.body || "",
      attemptNumber: data.attemptNumber || 1,
      gmailMessageId: data.gmailMessageId,
      createdAt: toISO(data.createdAt),
    };
    if (item.scheduledAt <= nowIso && item.recipientEmail) {
      dueItems.push(item);
    }
  }

  // Sort: earlier scheduled first
  dueItems.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  // ── Load Gmail token ──────────────────────────────────────────────────────
  const tokenSnap = await db.doc(`users/${userId}/settings/authTokens`).get();
  const tokenData = tokenSnap.exists ? tokenSnap.data() : null;

  let accessToken: string | null = null;
  if (tokenData?.accessToken && tokenData?.expiresAt) {
    let expiresAt: Date;
    if (typeof tokenData.expiresAt === "number") {
      expiresAt = new Date(tokenData.expiresAt);
    } else if (typeof tokenData.expiresAt?.toDate === "function") {
      expiresAt = tokenData.expiresAt.toDate();
    } else {
      expiresAt = new Date(tokenData.expiresAt);
    }
    
    if (isNaN(expiresAt.getTime())) {
      expiresAt = new Date(0);
    }
    if (expiresAt > new Date(nowMs() + 2 * 60 * 1000)) {
      // Token valid with >2 min remaining
      accessToken = tokenData.accessToken;
    } else if (tokenData.refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      // Auto-refresh token
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: tokenData.refreshToken,
            grant_type: "refresh_token",
          }),
        });
        const data = await response.json();
        if (response.ok && data.access_token) {
          accessToken = data.access_token;
          await db.doc(`users/${userId}/settings/authTokens`).set({
            accessToken,
            expiresAt: getISTDateString(new Date(nowMs() + data.expires_in * 1000)),
            updatedAt: getISTDateString(),
          }, { merge: true });
        } else {
          throw new Error("Failed to refresh: " + JSON.stringify(data));
        }
      } catch (err: any) {
        logError(`Failed to refresh Google token for user ${userId}: ${err.message}`);
      }
    }

    if (!accessToken) {
      logError(`User ${userId}: Gmail token expired and cannot be refreshed. User must re-authenticate.`);
      // Mark all running campaigns as paused
      await db
        .collection(`users/${userId}/campaigns`)
        .where("status", "==", "Running")
        .get()
        .then((snap: any) => {
          snap.docs.forEach((d: any) =>
            d.ref.set({ status: "Paused", _pauseReason: "gmail_token_expired" }, { merge: true })
          );
        });
      return;
    }
  } else {
    // No token — campaigns can't send but don't error loudly
    console.log(`[Scheduler] User ${userId} has no valid Gmail token.`);
    return;
  }

  if (!accessToken) return;


  // ── Process each due item ─────────────────────────────────────────────────
  for (const item of dueItems) {
    if (emailsSentToday >= dailyLimit) break;

    const sendResult = await sendViaGmail(
      accessToken,
      item.recipientEmail,
      item.subject,
      item.body
    );

    if (sendResult.success) {

      // Mark queue item Sent
      await db.doc(`users/${userId}/emailQueue/${item.id}`).set(
        {
          status: "Sent",
          sentAt: nowIso,
          gmailMessageId: sendResult.messageId || "",
        },
        { merge: true }
      );

      // Update application stage
      const newStatus =
        item.attemptNumber === 1
          ? "Sent"
          : item.attemptNumber === 2
          ? "Follow Up 1"
          : "Follow Up 2";

      const appSnap = await db
        .collection(`users/${userId}/applications`)
        .where("contactId", "==", item.contactId)
        .limit(1)
        .get();

      if (!appSnap.empty) {
        const appRef = appSnap.docs[0].ref;
        const appData = appSnap.docs[0].data();
        const updatePayload: any = {
          status: newStatus,
          updatedAt: nowIso,
          timeline: [
            ...(appData.timeline || []),
            { status: newStatus, timestamp: nowIso, note: `Email dispatched by scheduler (attempt ${item.attemptNumber})` },
          ],
        };
        if (item.attemptNumber === 1) updatePayload.lastEmailSentAt = nowIso;
        if (item.attemptNumber === 2) updatePayload.followUp1SentAt = nowIso;
        if (item.attemptNumber === 3) updatePayload.followUp2SentAt = nowIso;
        await appRef.set(updatePayload, { merge: true });

        // Schedule follow-up if this was attempt 1
        if (item.attemptNumber === 1 && camp.followUpEnabled) {
          await scheduleFollowUp(db, userId, item, followUp1Days, 2);
        } else if (item.attemptNumber === 2 && camp.followUpEnabled) {
          await scheduleFollowUp(db, userId, item, followUp2Days, 3);
        } else if (item.attemptNumber === 3 || !camp.followUpEnabled) {
          // Archive if no response after archiveDays from last send
          const archiveDate = new Date(
            nowMs() + archiveDays * 24 * 60 * 60 * 1000
          );
          // Schedule an archive check (store as metadata on the application)
          await appRef.set({ _archiveAfter: getISTDateString(archiveDate) }, { merge: true });
        }
      }

      // Update campaign stats
      const campSnap = await db
        .doc(`users/${userId}/campaigns/${item.campaignId}`)
        .get();
      if (campSnap.exists) {
        const campData = campSnap.data();
        const stats = campData?.stats || {};
        await db.doc(`users/${userId}/campaigns/${item.campaignId}`).set(
          {
            stats: {
              ...stats,
              sent: (stats.sent || 0) + (item.attemptNumber === 1 ? 1 : 0),
              followUpsSent:
                (stats.followUpsSent || 0) +
                (item.attemptNumber > 1 ? 1 : 0),
            },
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }

      emailsSentToday++;
      state.emailsSentThisTick++;
      state.totalEmailsSentToday++;

      console.log(
        `[Scheduler] ✉ Sent to ${item.recipientEmail} (${item.companyName}) — attempt ${item.attemptNumber}`
      );
    } else {
      // Mark Failed
      logError(
        `Failed to send to ${item.recipientEmail}: ${sendResult.error}`
      );
      await db.doc(`users/${userId}/emailQueue/${item.id}`).set(
        { status: "Failed", _error: sendResult.error?.slice(0, 300) },
        { merge: true }
      );
    }
  }

  // Persist updated emailsSentToday
  await db.doc(`users/${userId}/settings/userSettings`).set(
    { emailsSentToday, lastResetDate: today },
    { merge: true }
  );

  // ── Auto-archive stale applications ──────────────────────────────────────
  await autoArchiveStale(db, userId);
}

// ── Follow-up scheduling ─────────────────────────────────────────────────────

async function scheduleFollowUp(
  db: any,
  userId: string,
  original: QueueItem,
  delayDays: number,
  attemptNumber: number
) {
  const scheduledDateObj = new Date(nowMs() + delayDays * 24 * 60 * 60 * 1000);
  const scheduledAt = getISTDateString(scheduledDateObj);

  const fuId = `q_${original.campaignId}_${original.contactId}_fu${attemptNumber}_${nowMs()}`;
  const fuSubject = `Re: ${original.subject}`;
  const fuBody =
    attemptNumber === 2
      ? `Hi there,\n\nI wanted to follow up on my previous email regarding ${original.companyName}. I'm still very interested and would love to connect when you have a moment.\n\nWould you have 15 minutes this week?\n\nBest,\nAdarsh`
      : `Hi,\n\nThis is my final follow-up regarding my earlier message about ${original.companyName}. I believe I can add real value to your engineering team and would love the chance to chat.\n\nFeel free to reach out any time!\n\nBest,\nAdarsh`;

  await db.doc(`users/${userId}/emailQueue/${fuId}`).set({
    campaignId: original.campaignId,
    contactId: original.contactId,
    companyName: original.companyName,
    recipientEmail: original.recipientEmail,
    scheduledAt,
    status: "Pending",
    subject: fuSubject,
    body: fuBody,
    attemptNumber,
    createdAt: getISTDateString(),
  });

  console.log(
    `[Scheduler] 📅 Follow-up ${attemptNumber} scheduled for ${original.companyName} at ${scheduledAt}`
  );
}

// ── Auto-archive stale ────────────────────────────────────────────────────────

async function autoArchiveStale(db: any, userId: string) {
  try {
    const nowIso = getISTDateString();
    const appsSnap = await db
      .collection(`users/${userId}/applications`)
      .where("_archiveAfter", "<=", nowIso)
      .get();

    for (const appDoc of appsSnap.docs) {
      const data = appDoc.data();
      // Only archive if still in a non-terminal state
      const activeStatuses = ["Sent", "Follow Up 1", "Follow Up 2", "Queued"];
      if (activeStatuses.includes(data.status)) {
        await appDoc.ref.set(
          {
            status: "Archived",
            updatedAt: nowIso,
            _archiveAfter: null,
            timeline: [
              ...(data.timeline || []),
              { status: "Archived", timestamp: nowIso, note: "Auto-archived: no reply received" },
            ],
          },
          { merge: true }
        );
        console.log(`[Scheduler] 📦 Auto-archived ${data.companyName}`);
      }
    }
  } catch (err: any) {
    logError(`Auto-archive error: ${err?.message}`);
  }
}

// ── Daily report auto-generation ─────────────────────────────────────────────

async function autoGenerateDailyReport(
  db: any,
  userId: string,
  emailsSentToday: number,
  date: string
) {
  try {
    // Check if report already generated today
    const existingSnap = await db
      .collection(`users/${userId}/reports`)
      .where("date", "==", date)
      .limit(1)
      .get();
    if (!existingSnap.empty) return; // already generated

    const appsSnap = await db.collection(`users/${userId}/applications`).get();
    const apps = appsSnap.docs.map((d: any) => d.data());
    const replies = apps.filter((a: any) =>
      ["Replied", "Interview", "Interview Scheduled", "Offer Received"].includes(a.status)
    ).length;
    const interviews = apps.filter((a: any) =>
      ["Interview", "Interview Scheduled"].includes(a.status)
    ).length;
    const followUpsSentToday = apps.filter((a: any) =>
      a.followUp1SentAt?.startsWith(date) || a.followUp2SentAt?.startsWith(date)
    ).length;

    const topOpportunities = apps
      .sort((a: any, b: any) => (b.outreachScore || 0) - (a.outreachScore || 0))
      .slice(0, 5)
      .map((a: any) => ({
        companyName: a.companyName,
        role: a.role,
        score: a.outreachScore || 0,
        status: a.status,
      }));

    const reportId = `report_${date}_${Math.random().toString(36).substring(2, 7)}`;
    await db.doc(`users/${userId}/reports/${reportId}`).set({
      date,
      emailsSent: emailsSentToday,
      replies,
      interviews,
      followUpsSent: followUpsSentToday,
      pendingCompanies: apps.filter((a: any) => a.status === "Queued").length,
      topOpportunities,
      generatedAt: getISTDateString(),
      sentToGmail: false,
      _autoGenerated: true,
    });

    console.log(`[Scheduler] 📊 Daily report auto-generated for ${date}`);
  } catch (err: any) {
    logError(`Daily report generation failed: ${err?.message}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getSchedulerState(): SchedulerState {
  return { ...state };
}

export function startScheduler() {
  if (intervalHandle) return; // already running

  state.running = true;
  console.log(
    `[Scheduler] 🚀 Campaign Scheduler started — ticking every ${TICK_INTERVAL_MS / 1000}s`
  );

  // First tick immediately
  tick().catch((err) => logError(`Initial tick: ${err?.message}`));

  intervalHandle = setInterval(() => {
    tick().catch((err) => logError(`Interval tick: ${err?.message}`));
  }, TICK_INTERVAL_MS);
}

export function stopScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  state.running = false;
  console.log("[Scheduler] 🛑 Campaign Scheduler stopped.");
}
