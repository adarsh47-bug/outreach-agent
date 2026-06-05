/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App.tsx — V3 Personal AI Outreach Agent
 * Sidebar layout with 7 navigation sections.
 */

import { useState, useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { useFirestoreSync } from "./hooks/useFirestoreSync";
import ErrorBoundary from "./components/ErrorBoundary";
import Sidebar, { NavSection } from "./components/Sidebar";

// Section components
import DashboardSection from "./components/DashboardSection";
import ResumeSection from "./components/ResumeSection";
import ContactsV2Section from "./components/ContactsV2Section";
import CampaignsSection from "./components/CampaignsSection";
import PipelineSection from "./components/PipelineSection";
import ReportsSection from "./components/ReportsSection";
import SettingsSection from "./components/SettingsSection";

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>("dashboard");

  // Auth
  const { user, googleToken, setGoogleToken, handleSignIn, handleSignOut } = useAuth();

  // Firestore sync — all collections
  const store = useFirestoreSync(user);

  // Sidebar badge counts
  const badges: Partial<Record<NavSection, number>> = {
    campaigns: store.campaigns.filter((c) => c.status === "Running").length || undefined,
    pipeline: store.applications.filter((a) => a.status === "Interview" || a.status === "Interview Scheduled").length || undefined,
    contacts: store.contacts.filter((c) => !c.enriched && c.priority === "High").length || undefined,
  };

  // Handler: enrich complete
  const handleEnrichComplete = async (contactId: string, research: any) => {
    await store.handleSaveCompanyResearch(research);
    await store.handleUpdateContact(contactId, { enriched: true });
  };

  // Handler: score complete
  const handleScoreComplete = async (contactId: string, score: number) => {
    await store.handleUpdateContact(contactId, { outreachScore: score });
  };

  // Handler: email generated (for any standalone compose)
  const handleEmailGenerated = async (contactId: string, subject: string, body: string) => {
    // Update existing application record with generated email
    const existing = store.applications.find((a) => a.contactId === contactId);
    if (existing) {
      await store.handleUpdateApplicationStatus(existing.id, existing.status, `Email generated: ${subject}`);
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        badges={badges}
      />

      {/* Main content area */}
      <main className="main-content">
        {/* Page content */}
        <div className="flex-1 p-6 max-w-[1400px] w-full mx-auto">
          <ErrorBoundary>

            {/* ── Dashboard ── */}
            {activeSection === "dashboard" && (
              <DashboardSection
                applications={store.applications}
                campaigns={store.campaigns}
                contacts={store.contacts}
                emailQueue={store.emailQueue}
                onNavigate={(section) => setActiveSection(section as NavSection)}
                onStartCampaign={() => setActiveSection("campaigns")}
              />
            )}

            {/* ── Resume ── */}
            {activeSection === "resume" && (
              <ResumeSection
                resumes={store.resumes}
                onAddResume={store.handleAddResume}
                onDeleteResume={store.handleDeleteResume}
                selectedResumeId={store.selectedResumeId}
                onSelectResume={store.setSelectedResumeId}
              />
            )}

            {/* ── Contacts ── */}
            {activeSection === "contacts" && (
              <ContactsV2Section
                contacts={store.contacts}
                onAddContact={store.handleAddContact}
                onDeleteContact={store.handleDeleteContact}
                onUpdateContact={store.handleUpdateContact}
              />
            )}

            {/* ── Campaigns ── */}
            {activeSection === "campaigns" && (
              <CampaignsSection
                campaigns={store.campaigns}
                contacts={store.contacts}
                resumes={store.resumes}
                emailQueue={store.emailQueue}
                applications={store.applications}
                settings={store.settings}
                googleToken={googleToken}
                onAddCampaign={store.handleAddCampaign}
                onUpdateCampaign={store.handleUpdateCampaign}
                onDeleteCampaign={store.handleDeleteCampaign}
                onEnrichComplete={handleEnrichComplete}
                onScoreComplete={handleScoreComplete}
                onEmailGenerated={handleEmailGenerated}
                onQueueItemCreated={store.handleAddEmailQueueItem}
                onApplicationUpsert={store.handleUpsertApplication}
                onSignIn={handleSignIn}
              />
            )}

            {/* ── Pipeline ── */}
            {activeSection === "pipeline" && (
              <PipelineSection
                applications={store.applications}
                onUpdateStatus={store.handleUpdateApplicationStatus}
                onDeleteApplication={store.handleDeleteApplication}
              />
            )}

            {/* ── Reports ── */}
            {activeSection === "reports" && (
              <ReportsSection
                reports={store.reports}
                applications={store.applications}
                emailQueue={store.emailQueue}
                userEmail={user?.email || undefined}
                googleToken={googleToken}
                onSaveReport={store.handleSaveReport}
                onSignIn={handleSignIn}
              />
            )}

            {/* ── Settings ── */}
            {activeSection === "settings" && (
              <SettingsSection
                settings={store.settings}
                userEmail={user?.email || undefined}
                googleToken={googleToken}
                onUpdateSettings={store.handleUpdateSettings}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
              />
            )}

          </ErrorBoundary>
        </div>

        {/* Footer */}
        <footer
          style={{
            borderTop: "1px solid #e2e8f0",
            padding: "16px 24px",
            textAlign: "center",
            fontSize: "11px",
            color: "#94a3b8",
            fontFamily: "var(--font-mono)",
          }}
        >
          © 2026 Outreach Agent V3 · Built with React, TypeScript, Firebase & Google Gemini
        </footer>
      </main>
    </div>
  );
}
