"use client";

// Supabase is now the source of truth for patients and letters.
// Temporary storage should only be used as a fallback during development.

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getLetterById,
  updateLetterHebrew,
  updateLetterStatus,
  deleteOldLettersForPatient,
  type SummarySection,
  type DiagnosisItem,
  type PlanStep,
  sectionsToSumHE,
  diagItemsToHE,
  planStepsToHEArr,
} from "@/lib/supabase/letters";
import {
  getLetters,
  updateLetterData,
  updateStatus,
} from "@/lib/letterStore";
import { getPrimaryEmail, getPrimaryPhone } from "@/lib/supabase/patients";

// ─── Section card: editable Hebrew + inline English reference ─────────────────

function EditSection({
  title, titleHe, refContent, children,
}: {
  title: string; titleHe: string;
  refContent?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border p-5 mb-4"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05)" }}>
      <div className="flex items-baseline justify-between pb-3 mb-4"
        style={{ borderBottom: "2px solid #1A2B4A" }}>
        <h3 className="text-base font-bold" style={{ color: "#1A2B4A" }}>{title}</h3>
        <span className="text-base font-semibold" style={{ color: "#1A2B4A" }}>{titleHe}</span>
      </div>
      {refContent && (
        <div className="rounded-xl px-4 py-3 mb-4"
          style={{ backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
            style={{ color: "#94A3B8", letterSpacing: "0.1em" }}>
            English Reference
          </p>
          {refContent}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnatReviewLetterPage() {
  const router = useRouter();
  const params = useParams();
  const id     = params.id as string;

  const [notFound,  setNotFound]  = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [diagItems,       setDiagItems]       = useState<DiagnosisItem[]>([]);
  const [summarySections, setSummarySections] = useState<SummarySection[]>([]);
  const [planSteps,       setPlanSteps]       = useState<PlanStep[]>([]);
  const [diagEN,          setDiagEN]          = useState("");
  const [planEN,    setPlanEN]    = useState<string[]>([]);
  const [gender,    setGender]    = useState("");
  const [patName,   setPatName]   = useState("");
  const [patId,     setPatId]     = useState("");
  const [letterDate, setLetterDate] = useState("");

  const [sourceLetterIdState, setSourceLetterIdState] = useState<string | null>(null);
  const [patientUuid,         setPatientUuid]         = useState<string | null>(null);
  const [saving,              setSaving]              = useState(false);
  const [finishing,           setFinishing]           = useState(false);
  const [savedMsg,            setSavedMsg]            = useState(false);
  const [finishError,         setFinishError]         = useState("");
  const [savingInternal,      setSavingInternal]      = useState(false);
  const [saveInternalDone,    setSaveInternalDone]    = useState(false);
  const [saveInternalError,   setSaveInternalError]   = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const letter   = await getLetterById(supabase, id);

      if (letter) {
        // Loaded from Supabase
        const p = letter.patients;
        setPatName(p?.full_name          || "");
        setPatId(p?.patient_id_number    || "");
        setLetterDate(letter.letter_date || "");
        setGender(p?.gender              || "");
        if (letter.source_letter_id) setSourceLetterIdState(letter.source_letter_id);
        if (letter.patient_id)       setPatientUuid(letter.patient_id);
        setDiagEN(letter.diagnosis_english || "");
        setPlanEN((letter.plan_english || []).filter(Boolean));
        // Structured diagnosis items
        if (letter.diagnosis_items?.length) {
          setDiagItems(letter.diagnosis_items);
        } else {
          const en = (letter.diagnosis_english || "").split("\n").filter(Boolean);
          const he = (letter.diagnosis_hebrew  || "").split("\n").filter(Boolean);
          setDiagItems(en.length || he.length
            ? Array.from({ length: Math.max(en.length, he.length) }, (_, i) => ({
                id: `d-${id.slice(0, 6)}-${i}`, textEN: en[i] || "", textHE: he[i] || "", source: "copied" as const
              }))
            : []);
        }
        // Structured plan steps
        if (letter.plan_steps?.length) {
          setPlanSteps(letter.plan_steps);
        } else {
          const en = (letter.plan_english || []);
          const he = (letter.plan_hebrew  || []);
          setPlanSteps(en.length
            ? en.map((textEN, i) => ({ id: `p-${id.slice(0, 6)}-${i}`, textEN, textHE: he[i] || "", source: "copied" as const }))
            : []);
        }
        // Structured summary sections
        if (letter.summary_sections?.length) {
          setSummarySections(letter.summary_sections);
        } else if (letter.summary_english || letter.summary_hebrew) {
          setSummarySections([{
            id: `s-${id.slice(0, 8)}`,
            date: letter.letter_date || "",
            textEN: letter.summary_english || "",
            textHE: letter.summary_hebrew  || "",
            source: "copied",
          }]);
        }
      } else {
        // Fallback to localStorage
        const local = getLetters().find((l) => l.id === id) ?? null;
        if (!local) { setNotFound(true); setLoading(false); return; }
        const d = (local.data ?? {}) as Record<string, unknown>;
        setPatName(local.patientName || "");
        setPatId(local.patientId     || "");
        setLetterDate(local.letterDate || "");
        setGender((d.gender  as string) || "");
        setDiagEN((d.diagEN as string) || "");
        setPlanEN(Array.isArray(d.planStepsEN) ? (d.planStepsEN as string[]).filter(Boolean) : []);
        // diagItems
        if (Array.isArray(d.diagItems) && d.diagItems.length) {
          setDiagItems(d.diagItems as DiagnosisItem[]);
        } else {
          const en = ((d.diagEN as string) || "").split("\n").filter(Boolean);
          const he = ((d.diagHE as string) || "").split("\n").filter(Boolean);
          setDiagItems(en.length || he.length
            ? Array.from({ length: Math.max(en.length, he.length) }, (_, i) => ({
                id: `d-local-${i}`, textEN: en[i] || "", textHE: he[i] || "", source: "copied" as const
              }))
            : []);
        }
        // planSteps
        if (Array.isArray(d.planSteps) && d.planSteps.length) {
          setPlanSteps(d.planSteps as PlanStep[]);
        } else {
          const en = Array.isArray(d.planStepsEN) ? d.planStepsEN as string[] : [];
          const he = Array.isArray(d.planStepsHE) ? d.planStepsHE as string[] : [];
          setPlanSteps(en.length
            ? en.map((textEN, i) => ({ id: `p-local-${i}`, textEN, textHE: he[i] || "", source: "copied" as const }))
            : []);
        }
        // summarySections
        if (Array.isArray(d.summarySections) && d.summarySections.length) {
          setSummarySections(d.summarySections as SummarySection[]);
        } else if (d.sumEN || d.sumHE) {
          setSummarySections([{
            id: `s-local-${id.slice(0, 8)}`,
            date: local.letterDate || "",
            textEN: (d.sumEN as string) || "",
            textHE: (d.sumHE as string) || "",
            source: "copied",
          }]);
        }
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const sumHE  = sectionsToSumHE(summarySections);
  const diagHE = diagItemsToHE(diagItems);
  const planHE = planStepsToHEArr(planSteps);

  const collect = () => ({ diagHE, sumHE, planHE });

  const handleSaveDraft = async () => {
    setSaving(true);
    const supabase = createClient();
    await updateLetterHebrew(supabase, id, { diagHE, sumHE, planHE, summarySections, diagItems, planSteps });
    updateLetterData(id, { diagHE, diagItems, sumHE, summarySections, planStepsHE: planHE, planSteps });
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  const handleFinishReview = async () => {
    setFinishing(true);
    setFinishError("");
    try {
    const supabase = createClient();
    // Save Hebrew + update status in Supabase
    await updateLetterHebrew(supabase, id, { diagHE, sumHE, planHE, summarySections, diagItems, planSteps });
    await updateLetterStatus(supabase, id, "Reviewed", {
      reviewedAt: new Date().toISOString(),
    });
    // localStorage fallback
    updateLetterData(id, collect());
    updateStatus(id, "Reviewed");
    // Set up preview using Supabase data (re-fetch to get latest)
    const updated = await getLetterById(supabase, id);
    if (updated) {
      const d = {
        name: updated.patients?.full_name || patName,
        patId: updated.patients?.patient_id_number || patId,
        bDay: updated.patients?.birthdate_day || "",
        bMonth: updated.patients?.birthdate_month || "",
        bYear: updated.patients?.birthdate_year || "",
        gender: updated.patients?.gender || gender,
        email: getPrimaryEmail(updated.patients?.emails),
        phone: getPrimaryPhone(updated.patients?.phones),
        smoking: updated.patients?.smoking_vaping || "",
        pets: updated.patients?.pets || "",
        occupation: updated.patients?.occupation || "",
        referredBy: updated.patients?.referred_by || "",
        location: updated.patients?.location || "",
        dateDay: (updated.letter_date || "").split("/")[0] || "",
        dateMonth: (updated.letter_date || "").split("/")[1] || "",
        dateYear: (updated.letter_date || "").split("/")[2] || "",
        diagEN: updated.diagnosis_english || "",
        diagHE: updated.diagnosis_hebrew  || "",
        sumEN:  updated.summary_english   || "",
        sumHE:  updated.summary_hebrew    || "",
        diagItems:       updated.diagnosis_items?.length    ? updated.diagnosis_items    : diagItems,
        summarySections: updated.summary_sections?.length   ? updated.summary_sections   : summarySections,
        planSteps:       updated.plan_steps?.length         ? updated.plan_steps         : planSteps,
        planStepsEN: updated.plan_english || [],
        planStepsHE: updated.plan_hebrew  || [],
        medHistory:  updated.medical_history || "",
        famHistory:  updated.family_history  || "",
        medications: updated.medications  || [],
        allergies:   updated.allergies    || [],
        vaccinations: updated.vaccinations || [],
        ...(updated.examination as object || {}),
        testResults: updated.test_results || {},
        lungRows:    updated.lung_function_tests || [],
        pictures:    updated.pictures || [],
        inhalers:    Array.isArray(updated.inhaler)
          ? updated.inhaler
          : ((updated.inhaler as Record<string, string>)?.name
              ? [{ id: "inh-0", name: (updated.inhaler as Record<string, string>).name, link: (updated.inhaler as Record<string, string>).link || "", imageUrl: (updated.inhaler as Record<string, string>).image_url || "" }]
              : []),
      };
      localStorage.setItem("letter_preview",           JSON.stringify(d));
      localStorage.setItem("letter_current_supabase_id", id);
    }
    router.push("/workspace/review");
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : "Failed to finish review. Please try again.");
    } finally {
      setFinishing(false);
    }
  };


  const handleSaveInternal = async () => {
    if (savingInternal) return;
    setSavingInternal(true);
    setSaveInternalError("");
    try {
      const supabase = createClient();
      // Save current Hebrew edits first
      await updateLetterHebrew(supabase, id, { diagHE, sumHE, planHE, summarySections, diagItems, planSteps });
      // Mark as saved_internal
      await updateLetterStatus(supabase, id, "saved_internal", {
        savedInternalAt: new Date().toISOString(),
      });

      // Delete all previous completed letters for this patient now that the new one is saved.
      if (patientUuid) {
        try {
          await deleteOldLettersForPatient(supabase, id, patientUuid);
        } catch (e) {
          console.warn("[saveInternal] old letter cleanup failed:", e);
        }
      }

      setSaveInternalDone(true);
      setTimeout(() => setSaveInternalDone(false), 5000);
    } catch (err) {
      setSaveInternalError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSavingInternal(false);
    }
  };

  // ─── Not found / loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm" style={{ color: "#94A3B8" }}>Loading…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-base font-semibold mb-3" style={{ color: "#1A2B4A" }}>Letter not found</p>
          <Link href="/workspace/anat-review" className="text-sm font-medium" style={{ color: "#7C3AED" }}>
            ← Back to Anat Review
          </Link>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-white flex-shrink-0"
        style={{ borderBottom: "1px solid #E2E8F0" }}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => window.history.length > 1 ? router.back() : router.push("/workspace/anat-review")}
            className="inline-flex items-center gap-1.5 text-sm font-medium flex-shrink-0"
            style={{ color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M10 12L6 8l4-4"/>
            </svg>
            Back
          </button>
          <span style={{ color: "#E2E8F0" }}>›</span>
          <h1 className="text-sm font-bold truncate" style={{ color: "#1A2B4A" }}>{patName}</h1>
        </div>
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          {savedMsg       && <span className="text-xs font-semibold" style={{ color: "#0D9488" }}>Draft saved ✓</span>}
          {saveInternalDone && <span className="text-xs font-semibold" style={{ color: "#0D9488" }}>Saved to All Letters ✓</span>}
          {(finishError || saveInternalError) && (
            <span className="text-xs font-semibold max-w-xs text-right" style={{ color: "#BE123C" }}>
              {finishError || saveInternalError}
            </span>
          )}
          <button onClick={handleSaveDraft} disabled={saving || savingInternal || finishing}
            className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 hover:-translate-y-px"
            style={{ backgroundColor: "white", color: "#1A2B4A", borderColor: "#E2E8F0", opacity: (saving||savingInternal||finishing) ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button onClick={handleSaveInternal} disabled={savingInternal || saving || finishing}
            className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 hover:-translate-y-px"
            style={{ backgroundColor: "white", color: "#475569", borderColor: "#94A3B8", opacity: (savingInternal||saving||finishing) ? 0.7 : 1 }}>
            {savingInternal ? "Saving…" : "Save to All Letters"}
          </button>
          <button onClick={handleFinishReview} disabled={finishing || savingInternal}
            className="text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-150 hover:-translate-y-px"
            style={{ backgroundColor: "#7C3AED", color: "#fff", borderColor: "#7C3AED", opacity: (finishing||savingInternal) ? 0.7 : 1 }}>
            {finishing ? "Finishing…" : "Finish Review"}
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-5 pb-36 lg:pb-8"
        style={{ backgroundColor: "#F4F6F9" }}>

        {/* Patient info card */}
        <div className="bg-white rounded-2xl border p-4 sm:p-5 mb-5"
          style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05)" }}>
          <p className="text-base sm:text-lg font-bold mb-3" style={{ color: "#1A2B4A" }}>{patName}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
            {patId && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#94A3B8" }}>ID</p>
                <p className="text-sm font-medium" style={{ color: "#1A2B4A" }}>{patId}</p>
              </div>
            )}
            {gender && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#94A3B8" }}>Gender</p>
                <p className="text-sm font-medium" style={{ color: "#1A2B4A" }}>{gender}</p>
              </div>
            )}
            {letterDate && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#94A3B8" }}>Date</p>
                <p className="text-sm font-medium" style={{ color: "#1A2B4A" }}>{letterDate}</p>
              </div>
            )}
          </div>
          {gender && (
            <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2"
              style={{ backgroundColor: "#EDE9FE", border: "1px solid #DDD6FE" }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="#7C3AED" strokeWidth={1.75}
                strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
                <circle cx="8" cy="8" r="7"/><path d="M8 5v4M8 11h.01"/>
              </svg>
              <p className="text-xs" style={{ color: "#7C3AED" }}>
                Patient is <strong>{gender}</strong> — use correct Hebrew grammatical forms
              </p>
            </div>
          )}
        </div>

        <p className="text-xs font-bold uppercase tracking-widest mb-4"
          style={{ color: "#7C3AED", letterSpacing: "0.12em" }}>
          Edit Hebrew Translation
        </p>

        {/* Hebrew Diagnosis — per item */}
        <div className="bg-white rounded-2xl border p-5 mb-4"
          style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05)" }}>
          <div className="flex items-baseline justify-between pb-3 mb-4"
            style={{ borderBottom: "2px solid #1A2B4A" }}>
            <h3 className="text-base font-bold" style={{ color: "#1A2B4A" }}>Diagnosis</h3>
            <span className="text-base font-semibold" style={{ color: "#1A2B4A" }}>אבחנה</span>
          </div>
          {diagItems.length === 0 && (
            <p className="text-sm italic" style={{ color: "#CBD5E1" }}>No diagnosis items.</p>
          )}
          <div className="space-y-4">
            {diagItems.map((item, idx) => {
              const isCopied = item.source === "copied";
              return (
                <div key={item.id} className="rounded-xl p-4 space-y-2"
                  style={{ border: "1px solid #E2E8F0", backgroundColor: isCopied ? "#F8FAFC" : "#FAFBFC" }}>
                  <div className="flex items-center justify-between gap-2 pb-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <span className="text-xs font-semibold" style={{ color: "#94A3B8" }}>{idx + 1}.</span>
                    {isCopied && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "#F1F5F9", color: "#94A3B8" }}>
                        Previous — Read-only
                      </span>
                    )}
                  </div>
                  {item.textEN.trim() && (
                    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#94A3B8" }}>English Reference</p>
                      <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>{item.textEN}</p>
                    </div>
                  )}
                  <label className="block text-xs font-semibold uppercase tracking-wide"
                    style={{ color: isCopied ? "#94A3B8" : "#64748B" }}>
                    Hebrew / עברית{isCopied ? " (locked)" : ""}
                  </label>
                  {isCopied ? (
                    <p className="text-sm leading-relaxed px-4 py-3 rounded-xl whitespace-pre-wrap"
                      style={{ color: "#1A2B4A", direction: "rtl", textAlign: "right",
                        backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", minHeight: "3rem" }}>
                      {item.textHE || "—"}
                    </p>
                  ) : (
                    <textarea dir="rtl" rows={3}
                      value={item.textHE}
                      onChange={e => setDiagItems(prev => prev.map(i =>
                        i.id === item.id ? { ...i, textHE: e.target.value } : i
                      ))}
                      placeholder="אבחנה בעברית"
                      className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none resize-none transition-colors duration-150"
                      style={{ borderColor: "#E2E8F0", color: "#1A2B4A", direction: "rtl", textAlign: "right", fontSize: 16, lineHeight: 1.7 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hebrew Summary — per dated section */}
        <div className="bg-white rounded-2xl border p-5 mb-4"
          style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05)" }}>
          <div className="flex items-baseline justify-between pb-3 mb-4"
            style={{ borderBottom: "2px solid #1A2B4A" }}>
            <h3 className="text-base font-bold" style={{ color: "#1A2B4A" }}>Summary</h3>
            <span className="text-base font-semibold" style={{ color: "#1A2B4A" }}>סיכום</span>
          </div>

          {summarySections.length === 0 && (
            <p className="text-sm italic" style={{ color: "#CBD5E1" }}>No summary sections yet.</p>
          )}

          <div className="space-y-5">
            {summarySections.map((section, idx) => {
              const isCopied = section.source === "copied";
              return (
                <div key={section.id} className="rounded-xl p-4 space-y-3"
                  style={{ border: "1px solid #E2E8F0", backgroundColor: isCopied ? "#F8FAFC" : "#F5F3FF" }}>

                  {/* Date header */}
                  <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <span className="text-xs font-semibold" style={{ color: "#94A3B8" }}>
                      {idx === 0 ? "Review date:" : `Visit ${idx + 1}:`}
                    </span>
                    <span className="text-xs font-bold" style={{ color: "#1A2B4A" }}>
                      {section.date || "—"}
                    </span>
                    {isCopied ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto"
                        style={{ backgroundColor: "#F1F5F9", color: "#94A3B8" }}>Previous — Read-only</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto"
                        style={{ backgroundColor: "#EDE9FE", color: "#7C3AED" }}>New</span>
                    )}
                  </div>

                  {/* English reference */}
                  {section.textEN.trim() && (
                    <div className="rounded-xl px-4 py-3"
                      style={{ backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
                        style={{ color: "#94A3B8" }}>English Reference</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#475569" }}>
                        {section.textEN}
                      </p>
                    </div>
                  )}

                  {/* Hebrew */}
                  <label className="block text-xs font-semibold uppercase tracking-wide"
                    style={{ color: isCopied ? "#94A3B8" : "#64748B" }}>
                    Hebrew / עברית{isCopied ? " (locked)" : ""}
                  </label>
                  {isCopied ? (
                    <p className="text-sm leading-relaxed px-4 py-3 rounded-xl whitespace-pre-wrap"
                      style={{ color: "#1A2B4A", direction: "rtl", textAlign: "right",
                        backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", minHeight: "4rem" }}>
                      {section.textHE || "—"}
                    </p>
                  ) : (
                    <textarea
                      dir="rtl" rows={5}
                      value={section.textHE}
                      onChange={e => setSummarySections(prev => prev.map(s =>
                        s.id === section.id ? { ...s, textHE: e.target.value } : s
                      ))}
                      placeholder="הכנס סיכום בעברית"
                      className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none resize-none transition-colors duration-150"
                      style={{ borderColor: "#E2E8F0", color: "#1A2B4A", direction: "rtl",
                        textAlign: "right", fontSize: 16, lineHeight: 1.7 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hebrew Plan — per step */}
        <div className="bg-white rounded-2xl border p-5 mb-4"
          style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.05)" }}>
          <div className="flex items-baseline justify-between pb-3 mb-4"
            style={{ borderBottom: "2px solid #1A2B4A" }}>
            <h3 className="text-base font-bold" style={{ color: "#1A2B4A" }}>Plan</h3>
            <span className="text-base font-semibold" style={{ color: "#1A2B4A" }}>תכנית</span>
          </div>
          {planSteps.length === 0 && (
            <p className="text-sm italic" style={{ color: "#CBD5E1" }}>No plan steps.</p>
          )}
          <div className="flex flex-col gap-4">
            {planSteps.map((step, idx) => {
              const isCopied = step.source === "copied";
              return (
                <div key={step.id} className="rounded-xl p-4 space-y-2"
                  style={{ border: "1px solid #E2E8F0", backgroundColor: isCopied ? "#F8FAFC" : "#FAFBFC" }}>
                  <div className="flex items-center justify-between gap-2 pb-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: isCopied ? "#F1F5F9" : "#EDE9FE", color: isCopied ? "#94A3B8" : "#7C3AED" }}>
                      {idx + 1}
                    </span>
                    {isCopied && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "#F1F5F9", color: "#94A3B8" }}>
                        Previous — Read-only
                      </span>
                    )}
                    {!isCopied && (
                      <button type="button"
                        onClick={() => setPlanSteps(prev => prev.filter(s => s.id !== step.id))}
                        className="ml-auto text-xs transition-colors duration-150"
                        style={{ color: "#CBD5E1", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#BE123C")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#CBD5E1")}>
                        Remove
                      </button>
                    )}
                  </div>
                  {step.textEN.trim() && (
                    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#94A3B8" }}>English Reference</p>
                      <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>{step.textEN}</p>
                    </div>
                  )}
                  <label className="block text-xs font-semibold uppercase tracking-wide"
                    style={{ color: isCopied ? "#94A3B8" : "#64748B" }}>
                    Hebrew / עברית{isCopied ? " (locked)" : ""}
                  </label>
                  {isCopied ? (
                    <p className="text-sm leading-relaxed px-4 py-3 rounded-xl"
                      style={{ color: "#1A2B4A", direction: "rtl", textAlign: "right",
                        backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0", minHeight: "3rem" }}>
                      {step.textHE || "—"}
                    </p>
                  ) : (
                    <textarea dir="rtl" rows={3}
                      value={step.textHE}
                      onChange={e => setPlanSteps(prev => prev.map(s =>
                        s.id === step.id ? { ...s, textHE: e.target.value } : s
                      ))}
                      placeholder={`שלב ${idx + 1}`}
                      className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none resize-none transition-colors duration-150"
                      style={{ borderColor: "#E2E8F0", color: "#1A2B4A", direction: "rtl", textAlign: "right", fontSize: 16, lineHeight: 1.7 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl px-4 py-3 mb-4"
          style={{ backgroundColor: "#EDE9FE", border: "1px solid #DDD6FE" }}>
          <p className="text-sm" style={{ color: "#7C3AED" }}>
            Only the Hebrew sections above can be edited. English text is shown for reference only.
          </p>
        </div>
      </div>

      {/* Sticky bottom bar — mobile only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white px-4 pt-3"
        style={{ borderTop: "1px solid #E2E8F0", boxShadow: "0 -4px 24px rgb(0 0 0/0.08)",
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        {savedMsg        && <p className="text-sm font-semibold text-center mb-2.5" style={{ color: "#0D9488" }}>Draft saved ✓</p>}
        {saveInternalDone && <p className="text-sm font-semibold text-center mb-2.5" style={{ color: "#0D9488" }}>Saved to All Letters ✓</p>}
        {(finishError || saveInternalError) && (
          <p className="text-xs font-semibold text-center mb-2" style={{ color: "#BE123C" }}>
            {finishError || saveInternalError}
          </p>
        )}
        <div className="flex gap-2 mb-2">
          <button onClick={handleSaveDraft} disabled={saving || savingInternal || finishing}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-all duration-150 active:scale-95"
            style={{ backgroundColor: "white", color: "#1A2B4A", borderColor: "#E2E8F0",
              opacity: (saving||savingInternal||finishing) ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button onClick={handleFinishReview} disabled={finishing || savingInternal}
            className="flex-[2] py-3 rounded-xl text-sm font-semibold border transition-all duration-150 active:scale-95"
            style={{ backgroundColor: "#7C3AED", color: "#fff", borderColor: "#7C3AED",
              opacity: (finishing||savingInternal) ? 0.7 : 1 }}>
            {finishing ? "Finishing…" : "Finish Review"}
          </button>
        </div>
        <button onClick={handleSaveInternal} disabled={savingInternal || saving || finishing}
          className="w-full py-3 rounded-xl text-sm font-semibold border transition-all duration-150 active:scale-95"
          style={{ backgroundColor: "white", color: "#475569", borderColor: "#94A3B8",
            opacity: (savingInternal||saving||finishing) ? 0.7 : 1 }}>
          {savingInternal ? "Saving…" : "Save Letter to All Letters"}
        </button>
      </div>
    </div>
  );
}
