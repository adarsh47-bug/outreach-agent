/**
 * Contacts V2 Section — V3.
 * Rich CSV import with 15+ fields, enrichment status, outreach scores, priority filters.
 */

import { useState, useMemo } from "react";
import {
  Users,
  Upload,
  Search,
  Trash2,
  Star,
  Globe,
  Linkedin,
  Tag,
  ChevronDown,
  ChevronUp,
  Download,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Filter,
} from "lucide-react";
import { Contact, ContactPriority, Campaign } from "../types";
import { getISTDateString } from '../utils/date';

interface ContactsV2SectionProps {
  contacts: Contact[];
  campaigns: Campaign[];
  onAddContact: (contact: Contact) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
  onUpdateContact?: (id: string, updates: Partial<Contact>) => Promise<void>;
}

type FilterPriority = "All" | ContactPriority;
type FilterStatus = "All" | "Unreached" | "Outreached";

const PRIORITY_COLORS: Record<ContactPriority, string> = {
  High: "badge-high",
  Medium: "badge-medium",
  Low: "badge-low",
};

const CSV_TEMPLATE = `company_name,website,email,person_name,designation,role,location,priority,linkedin,industry,company_size,tech_stack,reason_for_outreach,recent_news,recent_hiring_activity,founder_name,company_stage,funding_status,job_url,personal_notes
Acme Corp,https://acme.com,hr@acme.com,Jane Smith,Engineering Manager,Full Stack Engineer,Remote,High,https://linkedin.com/in/jsmith,SaaS,50-200,React TypeScript Node.js Firebase,Recently hiring full stack engineers,Raised Series B,Engineering team expansion,John Acme,Series B,Raised $15M,https://acme.com/jobs,Reached out on LinkedIn`;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function importContactsFromCSV(raw: string): { contacts: Contact[]; errors: string[] } {
  const lines = raw.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { contacts: [], errors: ["CSV must have a header row + at least one data row."] };

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/[\s-]/g, "_").replace(/^"/, "").replace(/"$/, "")
  );

  const contacts: Contact[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").replace(/^"/, "").replace(/"$/, "").trim();
    });

    const email = row.email || row.email_address || "";
    const companyName = row.company_name || row.company || "";

    if (!companyName && !email) {
      errors.push(`Row ${i + 1}: Missing company_name and email — skipped.`);
      continue;
    }

    const rawPriority = row.priority || "";
    const priorityStr = rawPriority.charAt(0).toUpperCase() + rawPriority.slice(1).toLowerCase();
    const finalPriority: ContactPriority = ["High", "Medium", "Low"].includes(priorityStr) ? (priorityStr as ContactPriority) : "Medium";

    contacts.push({
      id: `cont_${Math.random().toString(36).substring(2, 10)}_${i}`,
      companyName: companyName || "Unknown Company",
      email,
      role: row.role || row.job_title || row.position || "",
      location: row.location || "Remote",
      priority: finalPriority,
      createdAt: getISTDateString(),
      website: row.website || row.company_website || "",
      personName: row.person_name || row.name || row.contact_name || "",
      designation: row.designation || row.title || "",
      linkedin: row.linkedin || row.linkedin_url || "",
      industry: row.industry || "",
      companySize: row.company_size || row.size || "",
      careersUrl: row.careers_url || row.careers || "",
      reasonForOutreach: row.reason_for_outreach || row.reason || "",
      recentNews: row.recent_news || row.news || "",
      techStack: row.tech_stack || row.technologies || row.stack || "",
      recentHiringActivity: row.recent_hiring_activity || row.hiring_activity || "",
      engineeringBlog: row.engineering_blog || row.blog || "",
      founderName: row.founder_name || row.founder || "",
      companyStage: row.company_stage || row.stage || "",
      fundingStatus: row.funding_status || row.funding || "",
      jobUrl: row.job_url || row.job_link || "",
      personalNotes: row.personal_notes || row.notes || "",
      recruiterName: row.person_name || row.name || "",
      source: "Imported CSV",
    });
  }

  return { contacts, errors };
}

export default function ContactsV2Section({
  contacts,
  campaigns,
  onAddContact,
  onDeleteContact,
  onUpdateContact,
}: ContactsV2SectionProps) {
  const [showImport, setShowImport] = useState(false);
  const [csvInput, setCsvInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; errors: string[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("All");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);

  const usedContactIds = useMemo(() => {
    return new Set(campaigns.flatMap((c) => c.contactIds));
  }, [campaigns]);

  const handleImport = async () => {
    if (!csvInput.trim()) return;
    setImporting(true);
    setImportResult(null);

    const { contacts: parsed, errors } = importContactsFromCSV(csvInput);

    let imported = 0;
    for (const contact of parsed) {
      try {
        await onAddContact(contact);
        imported++;
      } catch (e) {
        errors.push(`Failed to save ${contact.companyName}.`);
      }
    }

    setImportResult({ count: imported, errors });
    if (imported > 0) {
      setCsvInput("");
      setShowImport(false);
    }
    setImporting(false);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "outreach_contacts_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (filterPriority !== "All" && c.priority !== filterPriority) return false;
      if (filterStatus === "Outreached" && !usedContactIds.has(c.id)) return false;
      if (filterStatus === "Unreached" && usedContactIds.has(c.id)) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.companyName.toLowerCase().includes(q) ||
        (c.personName || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.role || "").toLowerCase().includes(q) ||
        (c.techStack || "").toLowerCase().includes(q)
      );
    });
  }, [contacts, searchQuery, filterPriority, filterStatus, usedContactIds]);

  const totalByPriority = useMemo(() => ({
    High: contacts.filter((c) => c.priority === "High").length,
    Medium: contacts.filter((c) => c.priority === "Medium").length,
    Low: contacts.filter((c) => c.priority === "Low").length,
    enriched: contacts.filter((c) => c.enriched).length,
  }), [contacts]);

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-10 bg-indigo-50" style={{ borderRadius: "10px" }}>
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-display">Contacts</h1>
            <p className="text-sm text-slate-500">
              {contacts.length} contacts · {totalByPriority.High} high priority
              {totalByPriority.enriched > 0 && ` · ${totalByPriority.enriched} enriched`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="btn-secondary text-xs py-2 px-3"
            id="download-csv-template-btn"
          >
            <Download className="w-3.5 h-3.5" />
            Template
          </button>
          <button
            onClick={() => {
              setShowImport(!showImport);
              setImportResult(null);
            }}
            className="btn-primary text-xs"
            id="toggle-import-btn"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
        </div>
      </div>

      {/* Import Result feedback */}
      {importResult && (
        <div
          className={`flex items-start gap-3 p-4 rounded-10 text-sm ${
            importResult.errors.length === 0
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-amber-50 border border-amber-200 text-amber-800"
          }`}
          style={{ borderRadius: "10px" }}
        >
          {importResult.errors.length === 0 ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className="font-semibold">{importResult.count} contacts imported successfully!</p>
            {importResult.errors.length > 0 && (
              <ul className="mt-1 text-xs space-y-0.5">
                {importResult.errors.map((e, i) => <li key={i}>⚠ {e}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* CSV Import Panel */}
      {showImport && (
        <div className="card animate-scale-in">
          <div className="card-header">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" />
              Import Contacts from CSV
            </h2>
            <button
              onClick={() => setShowTemplate(!showTemplate)}
              className="text-xs text-indigo-600 hover:underline"
            >
              {showTemplate ? "Hide" : "Show"} field guide
            </button>
          </div>
          <div className="card-body space-y-4">
            {showTemplate && (
              <div className="bg-slate-50 border border-slate-200 rounded-10 p-4 text-xs" style={{ borderRadius: "10px" }}>
                <p className="font-bold text-slate-700 mb-2">Supported CSV Fields:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                  {[
                    ["company_name", "Required"],
                    ["email", "Required"],
                    ["role", "Required"],
                    ["location", "Required"],
                    ["priority", "High/Medium/Low"],
                    ["website", "Company URL"],
                    ["person_name", "Contact name"],
                    ["designation", "Their title"],
                    ["linkedin", "LinkedIn URL"],
                    ["industry", "e.g. SaaS, Fintech"],
                    ["company_size", "e.g. 50-200"],
                    ["tech_stack", "e.g. React, Node.js"],
                    ["reason_for_outreach", "Why reach out"],
                    ["recent_news", "Recent updates"],
                    ["recent_hiring_activity", "Hiring signals"],
                    ["founder_name", "For startups"],
                    ["company_stage", "Seed/Series A/B"],
                    ["funding_status", "Funding info"],
                    ["job_url", "Job listing URL"],
                    ["personal_notes", "Your notes"],
                  ].map(([field, desc]) => (
                    <div key={field} className="flex items-center gap-1">
                      <span className="tag tag-indigo font-mono text-[10px]">{field}</span>
                      <span className="text-slate-500">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label">Paste CSV Data</label>
              <textarea
                id="csv-import-textarea"
                rows={6}
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                className="input-field font-mono text-xs resize-y"
                placeholder={`company_name,email,role,location,priority,tech_stack,reason_for_outreach\nAcme Corp,hr@acme.com,Full Stack Engineer,Remote,High,"React, Node.js",Recently expanding engineering team`}
              />
              <p className="text-xs text-slate-400 mt-1">
                {csvInput.split("\n").filter(Boolean).length - 1} data rows detected
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={importing || !csvInput.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                id="run-import-btn"
              >
                {importing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Import Contacts
                  </>
                )}
              </button>
              <button
                onClick={() => { setShowImport(false); setCsvInput(""); }}
                className="btn-secondary"
                id="cancel-import-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="contacts-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9 text-sm"
            placeholder="Search by company, name, role, tech stack..."
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {(["All", "High", "Medium", "Low"] as FilterPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              id={`filter-priority-${p.toLowerCase()}`}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                filterPriority === p
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {p}{p !== "All" && ` (${totalByPriority[p] || 0})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border-l border-slate-200 pl-3 ml-1">
          {(["All", "Unreached", "Outreached"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              id={`filter-status-${s.toLowerCase()}`}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                filterStatus === s
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List */}
      {filteredContacts.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">
              {contacts.length === 0 ? "No contacts yet" : "No contacts match your filter"}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {contacts.length === 0
                ? "Import a CSV to get started"
                : "Try adjusting your search or priority filter"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredContacts.map((c) => {
            const isExpanded = expandedId === c.id;
            return (
              <div
                key={c.id}
                id={`contact-${c.id}`}
                className="card hover:border-indigo-200 transition-colors"
              >
                <div
                  className="px-5 py-4 flex items-center gap-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  {/* Score */}
                  {c.outreachScore !== undefined ? (
                    <div
                      className={`score-ring flex-shrink-0 ${
                        c.outreachScore >= 80 ? "very-high" :
                        c.outreachScore >= 60 ? "high" :
                        c.outreachScore >= 40 ? "medium" : "low"
                      }`}
                      title="Outreach Opportunity Score"
                    >
                      {c.outreachScore}
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] text-slate-400">—</span>
                    </div>
                  )}

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{c.companyName}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[c.priority]}`}>
                        {c.priority}
                      </span>
                      {usedContactIds.has(c.id) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          In Campaign
                        </span>
                      )}
                      {c.enriched && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full tag-green">
                          <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
                          Enriched
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-slate-600 font-semibold">{c.role}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500">{c.location}</span>
                      {c.personName && (
                        <>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-500">{c.personName}</span>
                        </>
                      )}
                    </div>
                    {/* Tech tags */}
                    {c.techStack && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {c.techStack.split(",").slice(0, 4).map((t) => (
                          <span key={t} className="tag tag-indigo">{t.trim()}</span>
                        ))}
                        {c.techStack.split(",").length > 4 && (
                          <span className="tag">+{c.techStack.split(",").length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400 font-mono hidden md:block">{c.email}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                    <button
                      id={`delete-contact-${c.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteContact(c.id);
                      }}
                      className="btn-icon hover:text-red-500 hover:border-red-200"
                      title="Delete contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 animate-fade-in">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      {[
                        { label: "Email", value: c.email },
                        { label: "Website", value: c.website, link: true },
                        { label: "LinkedIn", value: c.linkedin, link: true },
                        { label: "Industry", value: c.industry },
                        { label: "Company Size", value: c.companySize },
                        { label: "Stage", value: c.companyStage },
                        { label: "Funding", value: c.fundingStatus },
                        { label: "Founder", value: c.founderName },
                        { label: "Job URL", value: c.jobUrl, link: true },
                      ].filter((f) => f.value).map(({ label, value, link }) => (
                        <div key={label}>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
                          {link ? (
                            <a
                              href={value as string}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 text-xs hover:underline flex items-center gap-1 truncate"
                            >
                              {value} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          ) : (
                            <p className="text-slate-700 text-xs truncate">{value}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Reason / Hiring / Notes */}
                    {(c.reasonForOutreach || c.recentHiringActivity || c.personalNotes) && (
                      <div className="mt-4 space-y-2">
                        {c.reasonForOutreach && (
                          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-0.5">Reason for Outreach</p>
                            <p className="text-xs text-indigo-800">{c.reasonForOutreach}</p>
                          </div>
                        )}
                        {c.recentHiringActivity && (
                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-0.5">Hiring Activity</p>
                            <p className="text-xs text-amber-800">{c.recentHiringActivity}</p>
                          </div>
                        )}
                        {c.personalNotes && (
                          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-0.5">Personal Notes</p>
                            <p className="text-xs text-slate-700">{c.personalNotes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
