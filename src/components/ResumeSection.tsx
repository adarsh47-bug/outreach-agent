/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Sparkles, FileText, Upload, Trash2, CheckCircle, CheckCircle2 } from "lucide-react";
import { getISTDateString } from '../utils/date';
import { ResumeProfile } from "../types";

interface ResumeSectionProps {
  resumes: ResumeProfile[];
  onAddResume: (resume: ResumeProfile) => void;
  onDeleteResume: (id: string) => void;
  selectedResumeId: string;
  onSelectResume: (id: string) => void;
}



export default function ResumeSection({
  resumes,
  onAddResume,
  onDeleteResume,
  selectedResumeId,
  onSelectResume,
}: ResumeSectionProps) {
  const [inputText, setInputText] = useState("");
  const [fileName, setFileName] = useState("My_Resume.txt");
  const [isParsing, setIsParsing] = useState(false);
  const [feedback, setFeedback] = useState("");

  const parseWithGemini = async () => {
    if (!inputText.trim()) {
      setFeedback("Please paste your resume credentials or copy a template resume first.");
      return;
    }

    setIsParsing(true);
    setFeedback("Invoking Gemini 3.5 Flash server-side parser...");

    try {
      const response = await fetch("/api/resume/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      if (!response.ok) {
        throw new Error("Gemini server-side parsing failed.");
      }

      const structuredResult = await response.json();

      const newResume: ResumeProfile = {
        id: "res_" + Math.random().toString(36).substring(7),
        fileName: fileName,
        uploadedAt: getISTDateString(),
        textContent: inputText,
        summary: structuredResult.summary || "Extracted Candidate Profile.",
        skills: structuredResult.skills || [],
        projects: structuredResult.projects || [],
        experience: structuredResult.experience || [],
        achievements: structuredResult.achievements || [],
        cloudExperience: structuredResult.cloudExperience || [],
        aiExperience: structuredResult.aiExperience || [],
      };

      onAddResume(newResume);
      const skillCount = (structuredResult.skills || []).length;
      const projectCount = (structuredResult.projects || []).length;
      setFeedback(`Resume analyzed: ${skillCount} skills, ${projectCount} projects extracted and saved!`);
      setInputText("");
    } catch (error: any) {
      console.error(error);
      setFeedback("Parsing failure: " + (error?.message || "Please check server limits."));
    } finally {
      setIsParsing(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processUploadedFile = async (file: File) => {
    setFileName(file.name);
    setFeedback(`Reading ${file.name}...`);
    const lowercaseName = file.name.toLowerCase();

    if (lowercaseName.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setInputText(e.target.result as string);
          setFeedback("Plain text file details loaded successfully! Click the 'Analyze with Gemini API' button to map credentials.");
        }
      };
      reader.readAsText(file);
    } else if (lowercaseName.endsWith(".pdf") || lowercaseName.endsWith(".docx") || lowercaseName.endsWith(".doc")) {
      setFeedback(`Extracting content from ${file.name} using the backend parsing parser...`);
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!e.target?.result) return;
        
        try {
          const resultStr = e.target.result as string;
          const base64Content = resultStr.split(",")[1];

          const response = await fetch("/api/resume/parse-document", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              base64: base64Content,
              fileName: file.name,
              mimeType: file.type
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Document processing failed.");
          }

          const parsedResult = await response.json();
          if (parsedResult.text) {
            setInputText(parsedResult.text);
            setFeedback(`Successfully imported text from ${file.name}! Check text below and click 'Analyze with Gemini' to map.`);
          } else {
            throw new Error("No readable text content extracted.");
          }
        } catch (error: any) {
          console.error(error);
          setFeedback(`Process failed: ${error.message}`);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setFeedback("Format unsupported. Please choose a `.pdf`, `.docx`, or `.txt` file.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processUploadedFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processUploadedFile(files[0]);
    }
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50" style={{ borderRadius: "10px" }}>
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-display">Resume</h1>
            <p className="text-sm text-slate-500">Upload and analyze your resume with Gemini AI</p>
          </div>
        </div>
        <span className="tag tag-indigo text-xs">Gemini Powered</span>
      </div>

    <div className="card" id="resume-section-card">
      <div className="card-body">



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Input area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">Resume Plain Text or File Import</label>
            <input
              id="file-name-input"
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="text-xs font-mono text-slate-500 border border-slate-200 rounded px-2 py-0.5 max-w-[180px] focus:outline-none focus:border-indigo-500"
              placeholder="Filename"
            />
          </div>

          <div
            id="drag-drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-slate-100/50 transition-colors relative group hover:border-indigo-400"
          >
            <textarea
              id="resume-text-area"
              rows={8}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-transparent border-0 resize-none text-sm text-slate-700 focus:outline-none placeholder:text-slate-400 relative z-10"
              placeholder="Drag & drop a `.pdf`, `.docx` or `.txt` resume here directly, or paste candidate details manually..."
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              id="resume-file-picker"
            />
            {(!inputText) && (
              <div 
                onClick={triggerFileSelect}
                className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-50/95 cursor-pointer rounded-lg space-y-3 z-20 pointer-events-auto"
              >
                <div className="p-2.5 border border-slate-200/80 bg-white rounded-full shadow-sm group-hover:border-indigo-350 transition-colors">
                  <Upload className="w-5 h-5 text-indigo-600 group-hover:scale-115 transition-transform" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-600 font-semibold group-hover:text-indigo-600 transition-colors">
                    Drag & drop PDF, Word, or TXT file here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    or click inside this zone to browse your device
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="analyze-resume-btn"
              onClick={parseWithGemini}
              disabled={isParsing || !inputText.trim()}
              className="bg-indigo-600 font-semibold hover:bg-indigo-700 text-white text-sm px-5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
            >
              {isParsing ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-white" />
                  Extracting with Gemini AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  Analyze with Gemini API
                </>
              )}
            </button>

            <button
              id="upload-file-btn"
              type="button"
              onClick={triggerFileSelect}
              className="bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-300 text-sm px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              Upload PDF/Word/TXT
            </button>
          </div>

          {feedback && (
            <p className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded px-3 py-2 flex items-center gap-1.5 font-mono">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {feedback}
            </p>
          )}
        </div>

        {/* Saved Resumes Directory */}
        <div className="space-y-4 border-t lg:border-t-0 lg:border-l lg:pl-6 border-slate-100">
          <label className="text-sm font-semibold text-slate-700 block">Parsed Candidate Directory</label>

          {resumes.length === 0 ? (
            <div className="h-[250px] border border-slate-100 rounded-lg flex flex-col items-center justify-center p-6 text-center bg-slate-50/50">
              <FileText className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-500">No registered resumes yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">Analyze resumes using Gemini to build the active profile database.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[290px] pr-1">
              {resumes.map((res) => {
                const isSelected = selectedResumeId === res.id;
                return (
                  <div
                    id={`resume-card-${res.id}`}
                    key={res.id}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-500"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => onSelectResume(res.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className={`w-4 h-4 ${isSelected ? "text-indigo-600" : "text-slate-400"}`} />
                          <h4 className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">{res.fileName}</h4>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 pr-2">{res.summary}</p>
                      </div>
                      <button
                        id={`delete-resume-${res.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteResume(res.id);
                        }}
                        className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100/50 shrink-0"
                        title="Delete resume profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Skills */}
                    <div className="flex flex-wrap gap-1 mt-3">
                      {res.skills.slice(0, 6).map((skill, idx) => (
                        <span
                          key={idx}
                          className="bg-white text-slate-600 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-100"
                        >
                          {skill}
                        </span>
                      ))}
                      {res.skills.length > 6 && (
                        <span className="text-[10px] text-slate-400 font-mono pt-0.5 pl-1">
                          +{res.skills.length - 6} skills
                        </span>
                      )}
                    </div>

                    {/* Extended field counts */}
                    {(res.projects?.length || res.achievements?.length || res.cloudExperience?.length || res.aiExperience?.length) ? (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(res.projects?.length || 0) > 0 && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-semibold">
                            {res.projects!.length} projects
                          </span>
                        )}
                        {(res.experience?.length || 0) > 0 && (
                          <span className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded font-semibold">
                            {res.experience!.length} roles
                          </span>
                        )}
                        {(res.achievements?.length || 0) > 0 && (
                          <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-semibold">
                            {res.achievements!.length} wins
                          </span>
                        )}
                        {(res.cloudExperience?.length || 0) > 0 && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-semibold">
                            ☁️ Cloud
                          </span>
                        )}
                        {(res.aiExperience?.length || 0) > 0 && (
                          <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-semibold">
                            🤖 AI/ML
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}
