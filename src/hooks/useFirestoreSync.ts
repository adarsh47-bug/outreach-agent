/**
 * Custom hook for Firestore real-time synchronization — V3.
 * Handles subscriptions to all collections:
 * resumes, contacts, applications, campaigns, emailQueue, companyResearch, reports.
 */
import { useState, useEffect, useCallback } from "react";
import { User } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  Timestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  ResumeProfile,
  Contact,
  Application,
  Campaign,
  EmailQueueItem,
  CompanyResearch,
  DailyReport,
  UserSettings,
  OutreachStage,
} from "../types";

interface UseFirestoreSyncReturn {
  // Data
  resumes: ResumeProfile[];
  contacts: Contact[];
  applications: Application[];
  campaigns: Campaign[];
  emailQueue: EmailQueueItem[];
  companyResearch: CompanyResearch[];
  reports: DailyReport[];
  settings: UserSettings | null;

  // Selection state
  selectedResumeId: string;
  setSelectedResumeId: (id: string) => void;
  selectedLeadId: string;
  setSelectedLeadId: (id: string) => void;

  // Resume handlers
  handleAddResume: (res: ResumeProfile) => Promise<void>;
  handleDeleteResume: (id: string) => Promise<void>;

  // Contact handlers
  handleAddContact: (cont: Contact) => Promise<void>;
  handleDeleteContact: (id: string) => Promise<void>;
  handleUpdateContact: (id: string, updates: Partial<Contact>) => Promise<void>;

  // Application handlers
  handleDeleteApplication: (id: string) => Promise<void>;
  handleUpdateApplicationStatus: (appId: string, newStatus: Application["status"], note: string) => Promise<void>;
  handleMatchComplete: (result: {
    score: number;
    matchingSkills: string[];
    missingSkills: string[];
    recommendations: string[];
    jobDescriptionRaw: string;
    targetRole: string;
    selectedLeadId: string;
  }) => Promise<void>;
  handleSendSuccess: (status: string, subject: string, body: string, leadId: string, gmailMessageId?: string) => Promise<void>;
  handleUpsertApplication: (app: Partial<Application> & { contactId: string }) => Promise<string>;

  // Campaign handlers
  handleAddCampaign: (campaign: Campaign) => Promise<void>;
  handleUpdateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>;
  handleDeleteCampaign: (id: string) => Promise<void>;

  // Email queue handlers
  handleAddEmailQueueItem: (item: EmailQueueItem) => Promise<void>;
  handleUpdateEmailQueueItem: (id: string, updates: Partial<EmailQueueItem>) => Promise<void>;

  // Company research handlers
  handleSaveCompanyResearch: (research: CompanyResearch) => Promise<void>;

  // Reports handlers
  handleSaveReport: (report: DailyReport) => Promise<void>;

  // Settings handlers
  handleUpdateSettings: (updates: Partial<UserSettings>) => Promise<void>;

  // Utility
  handleClearAllData: () => void;
}

import { getISTDateString } from "../utils/date";

/** Convert Firestore timestamp fields safely to IST string. */
function toISOString(val: any): string {
  if (val && typeof val.toDate === "function") {
    return getISTDateString(val.toDate());
  }
  if (val) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return getISTDateString(d);
    }
  }
  return getISTDateString();
}

const DEFAULT_SETTINGS: UserSettings = {
  dailyLimit: 10,
  emailsSentToday: 0,
  lastResetDate: getISTDateString().split("T")[0],
  addFollowUpReminders: true,
  defaultFollowUpDays: 5,
  followUp2Days: 7,
  archiveDays: 14,
  updatedAt: getISTDateString(),
};

export function useFirestoreSync(user: User | null): UseFirestoreSyncReturn {
  const [resumes, setResumes] = useState<ResumeProfile[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailQueue, setEmailQueue] = useState<EmailQueueItem[]>([]);
  const [companyResearch, setCompanyResearch] = useState<CompanyResearch[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");

  // ─── Real-time Firestore subscriptions ─────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setResumes([]);
      setContacts([]);
      setApplications([]);
      setCampaigns([]);
      setEmailQueue([]);
      setCompanyResearch([]);
      setReports([]);
      setSettings(null);
      setSelectedResumeId("");
      setSelectedLeadId("");
      return;
    }

    const userId = user.uid;

    // Resumes
    const unsubResumes = onSnapshot(
      collection(db, "users", userId, "resumes"),
      (snapshot) => {
        const list: ResumeProfile[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            fileName: data.fileName || "",
            uploadedAt: toISOString(data.uploadedAt),
            textContent: data.textContent || "",
            summary: data.summary || "",
            skills: data.skills || [],
            projects: data.projects || [],
            experience: data.experience || [],
            achievements: data.achievements || [],
            cloudExperience: data.cloudExperience || [],
            aiExperience: data.aiExperience || [],
            driveLink: data.driveLink,
          });
        });
        setResumes(list);
        if (list.length > 0) {
          setSelectedResumeId((prev) =>
            prev && list.some((r) => r.id === prev) ? prev : list[0].id
          );
        } else {
          setSelectedResumeId("");
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/resumes`)
    );

    // Contacts
    const unsubContacts = onSnapshot(
      collection(db, "users", userId, "contacts"),
      (snapshot) => {
        const list: Contact[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            companyName: data.companyName || "",
            email: data.email || "",
            role: data.role || "",
            location: data.location || "Remote",
            priority: data.priority || "Medium",
            createdAt: toISOString(data.createdAt),
            // Optional fields
            website: data.website,
            personName: data.personName,
            designation: data.designation,
            linkedin: data.linkedin,
            industry: data.industry,
            companySize: data.companySize,
            careersUrl: data.careersUrl,
            reasonForOutreach: data.reasonForOutreach,
            recentNews: data.recentNews,
            techStack: data.techStack,
            recentHiringActivity: data.recentHiringActivity,
            engineeringBlog: data.engineeringBlog,
            founderName: data.founderName,
            companyStage: data.companyStage,
            fundingStatus: data.fundingStatus,
            jobUrl: data.jobUrl,
            personalNotes: data.personalNotes,
            // Legacy
            recruiterName: data.recruiterName,
            phone: data.phone,
            source: data.source,
            // Enrichment
            enriched: data.enriched || false,
            outreachScore: data.outreachScore,
          });
        });
        // Sort: High priority first, then by score
        list.sort((a, b) => {
          const priorityOrder = { High: 0, Medium: 1, Low: 2 };
          const pa = priorityOrder[a.priority] ?? 1;
          const pb = priorityOrder[b.priority] ?? 1;
          if (pa !== pb) return pa - pb;
          return (b.outreachScore || 0) - (a.outreachScore || 0);
        });
        setContacts(list);
        if (list.length > 0) {
          setSelectedLeadId((prev) =>
            prev && list.some((c) => c.id === prev) ? prev : list[0].id
          );
        } else {
          setSelectedLeadId("");
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/contacts`)
    );

    // Applications
    const unsubApplications = onSnapshot(
      collection(db, "users", userId, "applications"),
      (snapshot) => {
        const list: Application[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            contactId: data.contactId || "",
            campaignId: data.campaignId,
            companyName: data.companyName || "",
            recruiterName: data.recruiterName || "",
            role: data.role || "",
            status: data.status || "Unreached",
            matchScore: data.matchScore || 0,
            outreachScore: data.outreachScore || 0,
            matchingSkills: data.matchingSkills || [],
            missingSkills: data.missingSkills || [],
            recommendations: data.recommendations || [],
            generatedSubject: data.generatedSubject || "",
            generatedBody: data.generatedBody || "",
            createdAt: toISOString(data.createdAt),
            updatedAt: toISOString(data.updatedAt),
            lastEmailSentAt: data.lastEmailSentAt ? toISOString(data.lastEmailSentAt) : undefined,
            followUp1SentAt: data.followUp1SentAt ? toISOString(data.followUp1SentAt) : undefined,
            followUp2SentAt: data.followUp2SentAt ? toISOString(data.followUp2SentAt) : undefined,
            gmailMessageId: data.gmailMessageId,
            timeline: data.timeline || [],
          });
        });
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setApplications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/applications`)
    );

    // Campaigns
    const unsubCampaigns = onSnapshot(
      collection(db, "users", userId, "campaigns"),
      (snapshot) => {
        const list: Campaign[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            name: data.name || "",
            resumeId: data.resumeId || "",
            status: data.status || "Draft",
            dailyLimit: data.dailyLimit || 10,
            followUpEnabled: data.followUpEnabled !== false,
            contactIds: data.contactIds || [],
            createdAt: toISOString(data.createdAt),
            updatedAt: toISOString(data.updatedAt),
            stats: data.stats || { total: 0, queued: 0, sent: 0, replies: 0, interviews: 0, followUpsSent: 0 },
            schedulerSettings: data.schedulerSettings
              ? {
                  sendingWindowStart: data.schedulerSettings.sendingWindowStart ?? "09:00",
                  sendingWindowEnd: data.schedulerSettings.sendingWindowEnd ?? "18:00",
                  minDelayMinutes: data.schedulerSettings.minDelayMinutes ?? 120,
                  maxDelayMinutes: data.schedulerSettings.maxDelayMinutes ?? 240,
                  sendingDays: data.schedulerSettings.sendingDays ?? "weekdays",
                }
              : undefined,
          });
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCampaigns(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/campaigns`)
    );

    // Email Queue
    const unsubQueue = onSnapshot(
      collection(db, "users", userId, "emailQueue"),
      (snapshot) => {
        const list: EmailQueueItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            campaignId: data.campaignId || "",
            contactId: data.contactId || "",
            companyName: data.companyName || "",
            recipientEmail: data.recipientEmail || "",
            scheduledAt: toISOString(data.scheduledAt),
            sentAt: data.sentAt ? toISOString(data.sentAt) : undefined,
            status: data.status || "Pending",
            subject: data.subject || "",
            body: data.body || "",
            attemptNumber: data.attemptNumber || 1,
            gmailMessageId: data.gmailMessageId,
            createdAt: toISOString(data.createdAt),
          });
        });
        list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
        setEmailQueue(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/emailQueue`)
    );

    // Company Research
    const unsubResearch = onSnapshot(
      collection(db, "users", userId, "companyResearch"),
      (snapshot) => {
        const list: CompanyResearch[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            contactId: data.contactId || "",
            companyName: data.companyName || "",
            summary: data.summary || "",
            techStack: data.techStack || [],
            hiringSignals: data.hiringSignals || [],
            productInfo: data.productInfo || "",
            fundingInfo: data.fundingInfo || "",
            engineeringFocus: data.engineeringFocus || "",
            enrichedAt: toISOString(data.enrichedAt),
          });
        });
        setCompanyResearch(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/companyResearch`)
    );

    // Reports (last 30)
    const unsubReports = onSnapshot(
      collection(db, "users", userId, "reports"),
      (snapshot) => {
        const list: DailyReport[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            date: data.date || "",
            emailsSent: data.emailsSent || 0,
            replies: data.replies || 0,
            interviews: data.interviews || 0,
            followUpsSent: data.followUpsSent || 0,
            pendingCompanies: data.pendingCompanies || 0,
            topOpportunities: data.topOpportunities || [],
            generatedAt: toISOString(data.generatedAt),
            sentToGmail: data.sentToGmail || false,
          });
        });
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setReports(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/reports`)
    );

    // Settings
    const unsubSettings = onSnapshot(
      doc(db, "users", userId, "settings", "userSettings"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            dailyLimit: data.dailyLimit ?? 10,
            emailsSentToday: data.emailsSentToday ?? 0,
            lastResetDate: data.lastResetDate ?? getISTDateString().split("T")[0],
            addFollowUpReminders: data.addFollowUpReminders !== false,
            defaultFollowUpDays: data.defaultFollowUpDays ?? 5,
            followUp2Days: data.followUp2Days ?? 7,
            archiveDays: data.archiveDays ?? 14,
            updatedAt: toISOString(data.updatedAt),
          });
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
      },
      (err) => console.warn("Settings fetch error:", err)
    );

    // Sync root user profile
    const syncRootProfile = async () => {
      try {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          await setDoc(userDocRef, {
            email: user.email || "",
            displayName: user.displayName || "Outreach User",
            photoURL: user.photoURL || "",
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn("Root profile sync error:", err);
      }
    };
    syncRootProfile();

    return () => {
      unsubResumes();
      unsubContacts();
      unsubApplications();
      unsubCampaigns();
      unsubQueue();
      unsubResearch();
      unsubReports();
      unsubSettings();
    };
  }, [user]);

  // ─── Resume CRUD ──────────────────────────────────────────────────────────

  const handleAddResume = useCallback(
    async (res: ResumeProfile) => {
      if (!user) throw new Error("Authentication required.");
      const docRef = doc(db, "users", user.uid, "resumes", res.id);
      await setDoc(docRef, {
        fileName: res.fileName,
        textContent: res.textContent,
        summary: res.summary,
        skills: res.skills,
        projects: res.projects || [],
        experience: res.experience || [],
        achievements: res.achievements || [],
        cloudExperience: res.cloudExperience || [],
        aiExperience: res.aiExperience || [],
        driveLink: res.driveLink || null,
        uploadedAt: serverTimestamp(),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/resumes/${res.id}`)
      );
    },
    [user]
  );

  const handleDeleteResume = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Authentication required.");
      await deleteDoc(doc(db, "users", user.uid, "resumes", id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/resumes/${id}`)
      );
    },
    [user]
  );

  // ─── Contact CRUD ─────────────────────────────────────────────────────────

  const handleAddContact = useCallback(
    async (cont: Contact) => {
      if (!user) throw new Error("Authentication required.");
      const docRef = doc(db, "users", user.uid, "contacts", cont.id);
      const { id, createdAt, ...rest } = cont;
      await setDoc(docRef, {
        ...rest,
        createdAt: serverTimestamp(),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/contacts/${cont.id}`)
      );
    },
    [user]
  );

  const handleUpdateContact = useCallback(
    async (id: string, updates: Partial<Contact>) => {
      if (!user) throw new Error("Authentication required.");
      const docRef = doc(db, "users", user.uid, "contacts", id);
      await setDoc(docRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/contacts/${id}`)
      );
    },
    [user]
  );

  const handleDeleteContact = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Authentication required.");
      await deleteDoc(doc(db, "users", user.uid, "contacts", id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/contacts/${id}`)
      );
    },
    [user]
  );

  // ─── Application CRUD ─────────────────────────────────────────────────────

  const handleUpsertApplication = useCallback(
    async (appData: Partial<Application> & { contactId: string }): Promise<string> => {
      if (!user) throw new Error("Authentication required.");
      const existingApp = applications.find((a) => a.contactId === appData.contactId);

      if (existingApp) {
        const docRef = doc(db, "users", user.uid, "applications", existingApp.id);
        await setDoc(docRef, {
          ...existingApp,
          ...appData,
          createdAt: Timestamp.fromDate(new Date(existingApp.createdAt)),
          updatedAt: serverTimestamp(),
          timeline: [
            ...(existingApp.timeline || []),
            {
              status: appData.status || existingApp.status,
              timestamp: getISTDateString(),
              note: `Updated application record`,
            },
          ],
        }).catch((err) =>
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/applications/${existingApp.id}`)
        );
        return existingApp.id;
      } else {
        const appId = "app_" + Math.random().toString(36).substring(2, 9);
        const contact = contacts.find((c) => c.id === appData.contactId);
        const docRef = doc(db, "users", user.uid, "applications", appId);
        await setDoc(docRef, {
          contactId: appData.contactId,
          campaignId: appData.campaignId || "",
          companyName: appData.companyName || contact?.companyName || "",
          recruiterName: appData.recruiterName || contact?.personName || contact?.recruiterName || "",
          role: appData.role || contact?.role || "",
          status: appData.status || "Unreached",
          matchScore: appData.matchScore || 0,
          outreachScore: appData.outreachScore || contact?.outreachScore || 0,
          matchingSkills: appData.matchingSkills || [],
          missingSkills: appData.missingSkills || [],
          recommendations: appData.recommendations || [],
          generatedSubject: appData.generatedSubject || "",
          generatedBody: appData.generatedBody || "",
          timeline: [
            { status: appData.status || "Unreached", timestamp: getISTDateString(), note: "Application created" },
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/applications/${appId}`)
        );
        return appId;
      }
    },
    [user, applications, contacts]
  );

  const handleMatchComplete = useCallback(
    async (result: {
      score: number;
      matchingSkills: string[];
      missingSkills: string[];
      recommendations: string[];
      jobDescriptionRaw: string;
      targetRole: string;
      selectedLeadId: string;
    }) => {
      if (!user) throw new Error("Authentication required.");
      setSelectedLeadId(result.selectedLeadId);
      const matchedContact = contacts.find((c) => c.id === result.selectedLeadId);
      const existingApp = applications.find((a) => a.contactId === result.selectedLeadId);

      if (existingApp) {
        const docRef = doc(db, "users", user.uid, "applications", existingApp.id);
        await setDoc(docRef, {
          ...existingApp,
          matchScore: result.score,
          matchingSkills: result.matchingSkills,
          missingSkills: result.missingSkills,
          recommendations: result.recommendations,
          createdAt: Timestamp.fromDate(new Date(existingApp.createdAt)),
          updatedAt: serverTimestamp(),
          timeline: [
            ...existingApp.timeline,
            {
              status: existingApp.status,
              timestamp: getISTDateString(),
              note: `Match analysis: ${result.score}% alignment`,
            },
          ],
        }).catch((err) =>
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/applications/${existingApp.id}`)
        );
      } else {
        const appId = "app_" + Math.random().toString(36).substring(2, 9);
        const docRef = doc(db, "users", user.uid, "applications", appId);
        await setDoc(docRef, {
          contactId: result.selectedLeadId,
          companyName: matchedContact?.companyName || "Target Company",
          recruiterName: matchedContact?.personName || matchedContact?.recruiterName || "Hiring Team",
          role: matchedContact?.role || result.targetRole,
          status: "Unreached",
          matchScore: result.score,
          outreachScore: matchedContact?.outreachScore || 0,
          matchingSkills: result.matchingSkills,
          missingSkills: result.missingSkills,
          recommendations: result.recommendations,
          generatedSubject: "",
          generatedBody: "",
          timeline: [{ status: "Unreached", timestamp: getISTDateString(), note: "Application Pipeline Created" }],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/applications/${appId}`)
        );
      }
    },
    [user, contacts, applications]
  );

  const handleSendSuccess = useCallback(
    async (status: string, subject: string, body: string, leadId: string, gmailMessageId?: string) => {
      if (!user) throw new Error("Authentication required.");
      const targetStatus: Application["status"] = status === "SENT" ? "Sent" : "Draft Generated";
      const note = status === "SENT" ? "Email sent via Gmail" : "Draft saved in Gmail";
      const existingApp = applications.find((app) => app.contactId === leadId);
      if (!existingApp) return;

      const docRef = doc(db, "users", user.uid, "applications", existingApp.id);
      await setDoc(docRef, {
        ...existingApp,
        status: targetStatus,
        generatedSubject: subject,
        generatedBody: body,
        gmailMessageId: gmailMessageId || existingApp.gmailMessageId,
        lastEmailSentAt: status === "SENT" ? serverTimestamp() : existingApp.lastEmailSentAt,
        createdAt: Timestamp.fromDate(new Date(existingApp.createdAt)),
        updatedAt: serverTimestamp(),
        timeline: [
          ...existingApp.timeline,
          { status: targetStatus, timestamp: getISTDateString(), note },
        ],
      }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/applications/${existingApp.id}`)
      );
    },
    [user, applications]
  );

  const handleUpdateApplicationStatus = useCallback(
    async (appId: string, newStatus: Application["status"], note: string) => {
      if (!user) throw new Error("Authentication required.");
      const existingApp = applications.find((app) => app.id === appId);
      if (!existingApp) return;

      const docRef = doc(db, "users", user.uid, "applications", appId);
      await setDoc(docRef, {
        ...existingApp,
        status: newStatus,
        createdAt: Timestamp.fromDate(new Date(existingApp.createdAt)),
        updatedAt: serverTimestamp(),
        timeline: [
          ...existingApp.timeline,
          { status: newStatus, timestamp: getISTDateString(), note },
        ],
      }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/applications/${appId}`)
      );
    },
    [user, applications]
  );

  const handleDeleteApplication = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Authentication required.");
      await deleteDoc(doc(db, "users", user.uid, "applications", id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/applications/${id}`)
      );
    },
    [user]
  );

  // ─── Campaign CRUD ────────────────────────────────────────────────────────

  const handleAddCampaign = useCallback(
    async (campaign: Campaign) => {
      if (!user) throw new Error("Authentication required.");
      const docRef = doc(db, "users", user.uid, "campaigns", campaign.id);
      const { id, createdAt, updatedAt, ...rest } = campaign;
      await setDoc(docRef, {
        ...rest,
        schedulerSettings: rest.schedulerSettings ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/campaigns/${campaign.id}`)
      );
    },
    [user]
  );

  const handleUpdateCampaign = useCallback(
    async (id: string, updates: Partial<Campaign>) => {
      if (!user) throw new Error("Authentication required.");
      const docRef = doc(db, "users", user.uid, "campaigns", id);
      await setDoc(docRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/campaigns/${id}`)
      );
    },
    [user]
  );

  const handleDeleteCampaign = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Authentication required.");
      await deleteDoc(doc(db, "users", user.uid, "campaigns", id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/campaigns/${id}`)
      );
    },
    [user]
  );

  // ─── Email Queue CRUD ─────────────────────────────────────────────────────

  const handleAddEmailQueueItem = useCallback(
    async (item: EmailQueueItem) => {
      if (!user) throw new Error("Authentication required.");
      const docRef = doc(db, "users", user.uid, "emailQueue", item.id);
      const { id, createdAt, ...rest } = item;
      await setDoc(docRef, {
        ...rest,
        createdAt: serverTimestamp(),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/emailQueue/${item.id}`)
      );
    },
    [user]
  );

  const handleUpdateEmailQueueItem = useCallback(
    async (id: string, updates: Partial<EmailQueueItem>) => {
      if (!user) throw new Error("Authentication required.");
      const docRef = doc(db, "users", user.uid, "emailQueue", id);
      await setDoc(docRef, updates, { merge: true }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/emailQueue/${id}`)
      );
    },
    [user]
  );

  // ─── Company Research CRUD ────────────────────────────────────────────────

  const handleSaveCompanyResearch = useCallback(
    async (research: CompanyResearch) => {
      if (!user) throw new Error("Authentication required.");
      const docRef = doc(db, "users", user.uid, "companyResearch", research.id);
      const { id, enrichedAt, ...rest } = research;
      await setDoc(docRef, {
        ...rest,
        enrichedAt: serverTimestamp(),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/companyResearch/${research.id}`)
      );
    },
    [user]
  );

  // ─── Reports CRUD ─────────────────────────────────────────────────────────

  const handleSaveReport = useCallback(
    async (report: DailyReport) => {
      if (!user) throw new Error("Authentication required.");
      const docRef = doc(db, "users", user.uid, "reports", report.id);
      const { id, generatedAt, ...rest } = report;
      await setDoc(docRef, {
        ...rest,
        generatedAt: serverTimestamp(),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/reports/${report.id}`)
      );
    },
    [user]
  );

  // ─── Settings CRUD ────────────────────────────────────────────────────────

  const handleUpdateSettings = useCallback(
    async (updates: Partial<UserSettings>) => {
      if (!user) throw new Error("Authentication required.");
      const docRef = doc(db, "users", user.uid, "settings", "userSettings");
      await setDoc(docRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/settings/userSettings`)
      );
    },
    [user]
  );

  // ─── Utility ──────────────────────────────────────────────────────────────

  const handleClearAllData = useCallback(() => {
    setResumes([]);
    setContacts([]);
    setApplications([]);
    setCampaigns([]);
    setEmailQueue([]);
    setCompanyResearch([]);
    setReports([]);
    setSettings(null);
    setSelectedResumeId("");
    setSelectedLeadId("");
  }, []);

  return {
    resumes,
    contacts,
    applications,
    campaigns,
    emailQueue,
    companyResearch,
    reports,
    settings,
    selectedResumeId,
    setSelectedResumeId,
    selectedLeadId,
    setSelectedLeadId,
    handleAddResume,
    handleDeleteResume,
    handleAddContact,
    handleUpdateContact,
    handleDeleteContact,
    handleDeleteApplication,
    handleUpdateApplicationStatus,
    handleMatchComplete,
    handleSendSuccess,
    handleUpsertApplication,
    handleAddCampaign,
    handleUpdateCampaign,
    handleDeleteCampaign,
    handleAddEmailQueueItem,
    handleUpdateEmailQueueItem,
    handleSaveCompanyResearch,
    handleSaveReport,
    handleUpdateSettings,
    handleClearAllData,
  };
}
