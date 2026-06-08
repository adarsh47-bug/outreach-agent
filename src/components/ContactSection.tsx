/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Users, Search, Trash2, CheckCircle, Table, Mail, Phone } from "lucide-react";
import { getISTDateString } from "../utils/date";
import { Contact } from "../types";

interface ContactSectionProps {
  contacts: Contact[];
  onAddContact: (contact: Contact) => void;
  onDeleteContact: (id: string) => void;
  onStartOutreach?: (contact: Contact) => void;
}

export default function ContactSection({
  contacts,
  onAddContact,
  onDeleteContact,
  onStartOutreach,
}: ContactSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [csvInput, setCsvInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showCsvBox, setShowCsvBox] = useState(false);

  const handleCsvImport = () => {
    const rawData = csvInput.trim();
    if (!rawData) {
      setFeedback("Please paste CSV data first.");
      return;
    }

    const lines = rawData.split("\n");
    let count = 0;

    lines.forEach((line, idx) => {
      // skip header row
      if (idx === 0 && line.toLowerCase().includes("companyname")) return;
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 4) {
        const [comp, rec, mail, jobRole, loc, src] = parts;
        if (comp && rec && mail && jobRole) {
          const newContact: Contact = {
            id: "cont_" + Math.random().toString(36).substring(7) + "_" + idx,
            companyName: comp,
            recruiterName: rec,
            email: mail,
            phone: "N/A",
            role: jobRole,
            location: loc || "Remote",
            source: src || "Imported CSV",
            priority: "Medium",
            createdAt: getISTDateString(),
          };
          onAddContact(newContact);
          count++;
        }
      }
    });

    setFeedback(`Imported ${count} contacts from CSV successfully!`);
    setCsvInput("");
    setShowCsvBox(false);
  };

  const filteredContacts = contacts.filter((c) => {
    const term = searchQuery.toLowerCase();
    return (
      c.companyName.toLowerCase().includes(term) ||
      (c.recruiterName || "").toLowerCase().includes(term) ||
      c.role.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6" id="contacts-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Recruiter &amp; Lead Directory
          </h2>
          <p className="text-sm text-slate-500 mt-1">Manage corporate contacts, leads, and targets to personalize outreaches</p>
        </div>
        <div className="flex gap-2">
          <button
            id="toggle-csv-btn"
            onClick={() => {
              setShowCsvBox(!showCsvBox);
              setFeedback("");
            }}
            className="text-xs font-medium text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
          >
            <Table className="w-3.5 h-3.5" />
            CSV Import Pipeline
          </button>
        </div>
      </div>

      {feedback && (
        <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-3 py-2 flex items-center gap-1.5 font-mono">
          <CheckCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          {feedback}
        </p>
      )}

      {/* CSV Import Panel */}
      {showCsvBox && (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3" id="csv-import-box">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-widest flex items-center gap-1">
              <Table className="w-3.5 h-3.5 text-indigo-600" /> Convert CSV to Directory Contacts
            </h4>
          </div>
          <p className="text-xs text-slate-500">
            Paste comma-separated records with columns: <code className="font-mono bg-slate-100 px-1 rounded">companyName, recruiterName, email, role, location, source</code>
          </p>
          <textarea
            id="csv-text-area"
            rows={4}
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            className="w-full text-xs font-mono bg-white border border-slate-200 rounded p-2 focus:outline-none focus:border-indigo-500"
            placeholder="companyName,recruiterName,email,role,location,source&#10;Google,Jane Miller,jane@google.com,Senior Engineer,Remote,LinkedIn"
          />
          <div className="flex gap-2">
            <button
              id="submit-csv-import"
              onClick={handleCsvImport}
              className="bg-indigo-600 text-white font-medium text-xs px-3.5 py-2 rounded hover:bg-indigo-700 transition"
            >
              Parse &amp; Save CSV Entries
            </button>
            <button
              id="cancel-csv-box"
              onClick={() => {
                setShowCsvBox(false);
                setCsvInput("");
              }}
              className="text-xs text-slate-500 hover:text-slate-800 px-3 py-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Directory — full width */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            id="search-leads-box"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-4 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500"
            placeholder="Search leads by company, recruiter, email, or role..."
          />
        </div>

        {filteredContacts.length === 0 ? (
          <div className="h-[300px] border border-slate-100 rounded-xl flex flex-col items-center justify-center p-6 text-center bg-slate-50/20">
            <Users className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-500">No contacts yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Use the CSV Import button above to bulk-add recruiter leads.
            </p>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
            {filteredContacts.map((c) => (
              <div
                id={`contact-card-${c.id}`}
                key={c.id}
                className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-grow">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800 text-sm">{c.recruiterName}</span>
                    <span className="text-xs bg-indigo-50 text-indigo-700 font-mono px-2 py-0.5 rounded-full border border-indigo-100 font-medium">
                      {c.companyName}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600">{c.role}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="text-slate-600 font-semibold">{c.email}</span>
                    </span>
                    {c.phone && c.phone !== "N/A" && (
                      <a
                        href={`tel:${c.phone}`}
                        className="flex items-center gap-1 text-indigo-600 hover:underline hover:text-indigo-700 cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{c.phone}</span>
                      </a>
                    )}
                    {c.location && <span>• {c.location}</span>}
                    {c.source && <span>• via {c.source}</span>}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 shrink-0 sm:self-center">
                  {onStartOutreach && (
                    <button
                      onClick={() => onStartOutreach(c)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                      title="Draft Outreach Email"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email Out</span>
                    </button>
                  )}
                  {c.phone && c.phone !== "N/A" ? (
                    <a
                      href={`tel:${c.phone}`}
                      className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs p-1.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer border border-slate-200"
                      title="Direct Dial Recruiter"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  ) : null}
                  <button
                    id={`delete-contact-${c.id}`}
                    onClick={() => onDeleteContact(c.id)}
                    className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-slate-100 shrink-0 cursor-pointer"
                    title="Delete Lead"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
