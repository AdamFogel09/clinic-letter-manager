"use client";

// Supabase is now the source of truth for patients and letters.
// Temporary storage should only be used as a fallback during development.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getAllPatients, patientToDraft, type Patient } from "@/lib/supabase/patients";
import { getAllLetters, duplicateLetter } from "@/lib/supabase/letters";
import { type StoredLetter, type LetterStatus } from "@/lib/letterStore";

const STATUS_COLORS: Record<LetterStatus, { bg: string; text: string }> = {
  "Draft":             { bg: "#EBF3FB", text: "#4A90D9" },
  "Ready for Review":  { bg: "#FEF3C7", text: "#D97706" },
  "Waiting for Anat":  { bg: "#EDE9FE", text: "#7C3AED" },
  "Reviewed":          { bg: "#FFE4E6", text: "#BE123C" },
  "Ready for Patient": { bg: "#CCFBF1", text: "#0D9488" },
  "Sent to Patient":   { bg: "#F0FDF4", text: "#16A34A" },
};

function calcAge(day: string, month: string, year: string): string {
  const dy = parseInt(day), mo = parseInt(month), yr = parseInt(year);
  if (!dy || !mo || !yr || yr < 1900 || yr > new Date().getFullYear()) return "";
  const birth = new Date(yr, mo - 1, dy);
  if (isNaN(birth.getTime()) || birth.getMonth() !== mo - 1) return "";
  const now = new Date();
  let yrs = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < mo - 1 || (now.getMonth() === mo - 1 && now.getDate() < dy)) yrs--;
  if (yrs < 0) return "";
  return `${yrs}y`;
}

function formatDOB(day: string, month: string, year: string): string {
  if (!day || !month || !year) return "";
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

// ── Patient card with expandable letter history ───────────────────────────────

function PatientCard({
  patient, letters, duplicatingId,
  onStartNewLetter, onOpenLetter, onPreviewLetter, onDuplicateLetter,
}: {
  patient: Patient;
  letters: StoredLetter[];
  duplicatingId: string | null;
  onStartNewLetter:   (p: Patient) => void;
  onOpenLetter:       (l: StoredLetter) => void;
  onPreviewLetter:    (l: StoredLetter) => void;
  onDuplicateLetter:  (l: StoredLetter) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const age     = calcAge(patient.birthdate_day, patient.birthdate_month, patient.birthdate_year);
  const dob     = formatDOB(patient.birthdate_day, patient.birthdate_month, patient.birthdate_year);
  const ageLine = [age, patient.gender].filter(Boolean).join(" · ");

  return (
    <div className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: "#E2E8F0",
        boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05), 0 4px 16px 0 rgb(26 43 74/0.04)" }}>

      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold" style={{ color: "#1A2B4A" }}>{patient.full_name}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {patient.patient_id_number && (
                <span className="text-xs" style={{ color: "#64748B" }}>ID: {patient.patient_id_number}</span>
              )}
              {dob     && <span className="text-xs" style={{ color: "#64748B" }}>DOB: {dob}</span>}
              {ageLine && <span className="text-xs" style={{ color: "#64748B" }}>{ageLine}</span>}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {patient.phone && <span className="text-xs" style={{ color: "#94A3B8" }}>{patient.phone}</span>}
              {patient.email && <span className="text-xs" style={{ color: "#94A3B8" }}>{patient.email}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
            <button onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all duration-150 hover:-translate-y-px"
              style={{ borderColor: "#E2E8F0", color: "#64748B", background: "white" }}>
              View History
              {letters.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: "#F1F5F9", color: "#475569" }}>
                  {letters.length}
                </span>
              )}
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"
                style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                <path d="M4 6l4 4 4-4"/>
              </svg>
            </button>
            <button onClick={() => onStartNewLetter(patient)}
              className="inline-flex items-center text-xs font-semibold px-3 py-2 rounded-xl transition-all duration-150 hover:-translate-y-px hover:shadow-sm"
              style={{ backgroundColor: "#1A2B4A", color: "#fff" }}>
              Create Update Letter
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #F1F5F9", backgroundColor: "#FAFBFC" }}>
          {letters.length === 0 ? (
            <p className="text-xs text-center py-5" style={{ color: "#CBD5E1" }}>
              No letters saved yet for this patient.
            </p>
          ) : (
            <div className="px-5 sm:px-6 py-3 flex flex-col gap-2">
              {letters.map((letter, idx) => {
                const c = STATUS_COLORS[letter.status] ?? { bg: "#F1F5F9", text: "#475569" };
                const isDuplicating = duplicatingId === letter.id;
                const isLatest = idx === 0;
                return (
                  <div key={letter.id}
                    className="flex items-center justify-between gap-3 py-2.5 px-4 rounded-xl bg-white border"
                    style={{ borderColor: isLatest ? "#0D9488" : "#E2E8F0" }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isLatest && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#CCFBF1", color: "#0D9488" }}>
                            Latest
                          </span>
                        )}
                        {letter.letterDate && (
                          <span className="text-xs font-medium" style={{ color: "#1A2B4A" }}>{letter.letterDate}</span>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: c.bg, color: c.text }}>
                          {letter.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      <button onClick={() => onPreviewLetter(letter)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all"
                        style={{ borderColor: "#E2E8F0", color: "#64748B", background: "white" }}>
                        Preview
                      </button>
                      <button
                        onClick={() => onDuplicateLetter(letter)}
                        disabled={isDuplicating}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all"
                        style={{
                          borderColor: "#DDD6FE",
                          color: isDuplicating ? "#A78BFA" : "#7C3AED",
                          background: isDuplicating ? "#F5F3FF" : "#EDE9FE",
                          cursor: isDuplicating ? "default" : "pointer",
                        }}>
                        {isDuplicating ? "Creating…" : "Create Update"}
                      </button>
                      <button onClick={() => onOpenLetter(letter)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ backgroundColor: "#1A2B4A", color: "#fff" }}>
                        {isLatest ? "Edit Latest" : "Continue"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AllLettersPage() {
  const router  = useRouter();
  const [patients, setPatients]     = useState<Patient[]>([]);
  const [letters,  setLetters]      = useState<StoredLetter[]>([]);
  const [loading,  setLoading]      = useState(true);
  const [search,   setSearch]       = useState("");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [pats, lets] = await Promise.all([
        getAllPatients(supabase),
        getAllLetters(supabase),
      ]);
      setPatients(pats);
      setLetters(lets);
      setLoading(false);
    };
    load();

    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearch(decodeURIComponent(q));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.patient_id_number.toLowerCase().includes(q)
    );
  }, [patients, search]);

  const lettersForPatient = (p: Patient): StoredLetter[] =>
    letters.filter(
      (l) =>
        (p.patient_id_number && l.patientId === p.patient_id_number) ||
        l.patientName.toLowerCase() === p.full_name.toLowerCase()
    );

  const startNewLetter = (p: Patient) => {
    sessionStorage.setItem("draft_patient", JSON.stringify(patientToDraft(p)));
    sessionStorage.removeItem("letter_draft");
    sessionStorage.removeItem("letter_draft_id");
    sessionStorage.removeItem("letter_supabase_id");
    // Pass patientId in the URL as a Safari-safe fallback for sessionStorage
    const patId = (p as { id?: string }).id;
    router.push(patId ? `/workspace/letter-editor?patientId=${patId}` : "/workspace/letter-editor");
  };

  const openInEditor = (letter: StoredLetter) => {
    sessionStorage.setItem("letter_supabase_id", letter.id);
    sessionStorage.setItem("load_from_supabase", "1");
    sessionStorage.removeItem("draft_patient");
    sessionStorage.removeItem("letter_draft");
    sessionStorage.removeItem("is_update_mode");
    localStorage.setItem("letter_current_id",          letter.id);
    localStorage.setItem("letter_current_supabase_id", letter.id);
    // Pass letterId in the URL as a Safari-safe fallback for sessionStorage
    router.push(`/workspace/letter-editor?letterId=${letter.id}`);
  };

  const openPreview = (letter: StoredLetter) => {
    if (letter.data) localStorage.setItem("letter_preview", JSON.stringify(letter.data));
    localStorage.setItem("letter_current_id",          letter.id);
    localStorage.setItem("letter_current_supabase_id", letter.id);
    localStorage.setItem("letter_return_to", "all-letters");
    localStorage.setItem("letter_status",              letter.status);
    localStorage.removeItem("letter_export_mode");
    router.push("/workspace/letter-preview");
  };

  const handleDuplicate = async (letter: StoredLetter) => {
    if (duplicatingId) return;
    setDuplicatingId(letter.id);
    setDuplicateError("");
    try {
      const supabase = createClient();
      const { id: newId } = await duplicateLetter(supabase, letter.id);
      sessionStorage.setItem("letter_supabase_id",   newId);
      sessionStorage.setItem("load_from_supabase",   "1");
      sessionStorage.setItem("is_update_mode",       "1");
      sessionStorage.removeItem("draft_patient");
      sessionStorage.removeItem("letter_draft");
      localStorage.setItem("letter_current_supabase_id", newId);
      router.push("/workspace/letter-editor");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create update letter.";
      setDuplicateError(msg);
      setDuplicatingId(null);
      setTimeout(() => setDuplicateError(""), 5000);
    }
  };

  return (
    <div className="flex-1 pb-10">
      {/* Header */}
      <div className="grid grid-cols-3 items-start px-6 sm:px-8 pt-8 pb-6">
        <div />
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "#1A2B4A" }}>All Letters</h1>
          <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>All patients and their letter history</p>
        </div>
        <div className="flex items-center justify-end pt-1">
          <Link href="/workspace/new-letter"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-150 hover:-translate-y-px"
            style={{ backgroundColor: "#1A2B4A", color: "#ffffff" }}>
            New Letter
          </Link>
        </div>
      </div>

      <div className="px-6 sm:px-8">
        {/* Duplicate error */}
        {duplicateError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4"
            style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
            <p className="text-xs font-semibold" style={{ color: "#DC2626" }}>{duplicateError}</p>
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 bg-white"
          style={{ border: "1px solid #E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.04)" }}>
          <svg viewBox="0 0 20 20" fill="none" stroke="#94A3B8" strokeWidth={1.75}
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
            <circle cx="9" cy="9" r="6"/><path d="M17 17l-3.5-3.5"/>
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name or ID…"
            className="flex-1 text-sm bg-transparent outline-none" style={{ color: "#1A2B4A" }} />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs" style={{ color: "#94A3B8" }}>Clear</button>
          )}
        </div>

        {!loading && (
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold" style={{ color: "#1A2B4A" }}>
              {search ? `Results for "${search}"` : "All Patients"}
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums"
              style={{ backgroundColor: "#F1F5F9", color: "#475569" }}>
              {filtered.length}
            </span>
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border animate-pulse"
                style={{ borderColor: "#E2E8F0", height: 90 }} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
            style={{ border: "1px dashed #E2E8F0" }}>
            <svg viewBox="0 0 48 48" fill="none" stroke="#CBD5E1" strokeWidth={1.5}
              strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 mb-3">
              <rect x="4" y="10" width="40" height="10" rx="2"/>
              <path d="M6 20v20a2 2 0 0 0 2 2h32a2 2 0 0 0 2-2V20"/><path d="M18 30h12"/>
            </svg>
            <p className="text-sm font-semibold mb-1" style={{ color: "#94A3B8" }}>
              {search ? "No patients match your search" : "No patients yet"}
            </p>
            {!search && (
              <p className="text-xs" style={{ color: "#CBD5E1" }}>
                Add patients using the New Patient button
              </p>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-3">
            {filtered.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                letters={lettersForPatient(patient)}
                duplicatingId={duplicatingId}
                onStartNewLetter={startNewLetter}
                onOpenLetter={openInEditor}
                onPreviewLetter={openPreview}
                onDuplicateLetter={handleDuplicate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
